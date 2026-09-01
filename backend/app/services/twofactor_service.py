"""Ikki bosqichli tasdiqlash (X-14).

Administrator va direktor butun bazani koʻradi — ularning bitta paroli
butun maktabning maʼlumotini ochib beradi. Parol sizib chiqishi esa eng
oddiy hodisa: qayta ishlatilgan parol, fishing, yozib qoʻyilgan qogʻoz.

Funksiya HAMMA uchun ochiq; majburiyligi esa faqat shu ikki rolda.

Uchta qaror:

1. **Majburiy rollar uchun API 2FA yoqilmaguncha yopiq.** Ixtiyoriy
   2FA — deyarli hech kim yoqmaydigan 2FA.

2. **Kirish ikki bosqichda.** Birinchi bosqich parolni tekshiradi va
   qisqa muddatli "challenge" token beradi; access token faqat kod
   tasdiqlangandan keyin chiqadi. Shunda parolni bilgan, lekin kodi
   yoʻq odam hech qanday token olmaydi.

3. **Tiklash kodlari majburiy.** 2FA ni majburiy qilib, telefon
   yoʻqolganda kirish yoʻlini bermaslik — administratorni tizimdan
   butunlay chiqarib yuborish demakdir.
"""

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import totp
from app.core.config import settings
from app.core.exceptions import (
    AuthRequiredError,
    InvalidCredentialsError,
    ValidationError,
)
from app.core.security import hash_token, verify_password
from app.core.timeutil import utcnow
from app.models import AuditAction, RoleName, TwoFactorRecoveryCode, User
from app.services import audit_service

#: 2FA MAJBURIY boʻlgan rollar (X-14).
#:
#: Super administrator ataylab YOʻQ. X-14 aynan administrator va
#: direktorni nomlaydi: ular kundalik ishlaydigan, koʻp va tez-tez
#: kiradigan hisoblar. Super administrator esa loyiha egasining
#: texnik hisobi — u kamdan-kam ishlatiladi va uni majburlash amalda
#: ish jarayonini toʻsadi.
#:
#: U 2FA ni ISTASA yoqadi (`/auth/2fa/setup`) va istagan paytda
#: oʻchiradi — funksiya oʻzi hamma uchun ochiq.
REQUIRED_ROLES = frozenset(
    {
        RoleName.ADMIN.value,
        RoleName.DIRECTOR.value,
    }
)

#: Kirishning ikkinchi bosqichi uchun berilgan vaqt. Qisqa: bu token
#: parolni allaqachon tasdiqlagan va uni uzoq yashatish xavfli.
CHALLENGE_TTL_MINUTES = 5


def is_required(user: User) -> bool:
    """Shu foydalanuvchida 2FA majburiymi.

    `REQUIRE_TWO_FACTOR=false` boʻlsa hech kimga majburiy emas —
    sinov muhiti uchun. Funksiyaning oʻzi ishlaydi: kim yoqsa,
    unga kirishda kod soʻraladi.
    """
    if not settings.require_two_factor:
        return False
    return bool(REQUIRED_ROLES & set(user.role_names))


@dataclass(frozen=True, slots=True)
class SetupResult:
    secret: str
    uri: str


# ─────────────────────────── Sozlash ───────────────────────────


async def begin_setup(session: AsyncSession, user: User) -> SetupResult:
    """Sekret yasaydi va uni SAQLAYDI, lekin hali yoqmaydi.

    Sekret darhol saqlanadi, chunki keyingi qadamda (`enable`) kod shu
    sekret boʻyicha tekshiriladi. `totp_enabled_at` esa boʻsh qoladi —
    ya'ni 2FA hali kuchga kirmagan va foydalanuvchi eski yoʻl bilan
    kira oladi. Yarim sozlangan holatda qulflanib qolmaydi.
    """
    if user.two_factor_enabled:
        raise ValidationError("Ikki bosqichli tasdiqlash allaqachon yoqilgan.")

    sekret = totp.generate_secret()
    user.totp_secret = sekret
    user.totp_last_step = None
    await session.commit()

    return SetupResult(secret=sekret, uri=totp.provisioning_uri(sekret, login=user.login))


async def enable(
    session: AsyncSession, user: User, code: str, *, ip: str | None = None
) -> list[str]:
    """Kodni tekshirib 2FA ni yoqadi va tiklash kodlarini qaytaradi.

    Kodlar javobda BIR MARTA koʻrsatiladi — bazada faqat xeshi qoladi.
    """
    if user.two_factor_enabled:
        raise ValidationError("Ikki bosqichli tasdiqlash allaqachon yoqilgan.")
    if not user.totp_secret:
        raise ValidationError("Avval sozlashni boshlang.")

    qadam = totp.verify(user.totp_secret, code, last_used_step=user.totp_last_step)
    if qadam is None:
        raise InvalidCredentialsError("Kod notoʻgʻri yoki muddati oʻtgan.")

    user.totp_enabled_at = utcnow()
    user.totp_last_step = qadam

    kodlar = await _issue_recovery_codes(session, user)

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"two_factor": "enabled"},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    return kodlar


async def _issue_recovery_codes(session: AsyncSession, user: User) -> list[str]:
    """Eski kodlarni bekor qilib yangilarini beradi."""
    await session.execute(
        update(TwoFactorRecoveryCode)
        .where(
            TwoFactorRecoveryCode.user_id == user.id,
            TwoFactorRecoveryCode.used_at.is_(None),
            TwoFactorRecoveryCode.is_archived.is_(False),
        )
        .values(is_archived=True, archived_at=utcnow())
    )

    kodlar = totp.generate_recovery_codes()
    for kod in kodlar:
        session.add(
            TwoFactorRecoveryCode(
                user_id=user.id,
                code_hash=hash_token(totp.normalize_recovery_code(kod)),
            )
        )
    return kodlar


async def regenerate_recovery_codes(
    session: AsyncSession, user: User, password: str, *, ip: str | None = None
) -> list[str]:
    """Yangi tiklash kodlari. Parol soʻraladi.

    Ochiq qolgan sessiyani topgan odam yangi kodlar yasab, keyin
    ularni ishlatib kira olmasin.
    """
    if not user.two_factor_enabled:
        raise ValidationError("Ikki bosqichli tasdiqlash yoqilmagan.")
    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("Parol notoʻgʻri.")

    kodlar = await _issue_recovery_codes(session, user)
    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"two_factor": "recovery_codes_regenerated"},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    return kodlar


async def disable(
    session: AsyncSession, user: User, password: str, code: str, *, ip: str | None = None
) -> None:
    """2FA ni oʻchiradi. Parol VA kod soʻraladi.

    Ikkalasi ham: parolni bilgan hujumchi 2FA ni oʻchirib tashlay
    olmasin, kodni koʻrgan odam ham.

    Majburiy roldagi foydalanuvchi oʻchira olmaydi — aks holda X-14
    talabini bir bosishda aylanib oʻtish mumkin boʻlardi.
    """
    if is_required(user):
        raise ValidationError(
            "Sizning rolingizda ikki bosqichli tasdiqlash majburiy — oʻchirib boʻlmaydi."
        )
    if not user.two_factor_enabled or not user.totp_secret:
        return

    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("Parol notoʻgʻri.")
    if totp.verify(user.totp_secret, code, last_used_step=user.totp_last_step) is None:
        raise InvalidCredentialsError("Kod notoʻgʻri.")

    user.totp_secret = None
    user.totp_enabled_at = None
    user.totp_last_step = None

    await session.execute(
        update(TwoFactorRecoveryCode)
        .where(
            TwoFactorRecoveryCode.user_id == user.id,
            TwoFactorRecoveryCode.is_archived.is_(False),
        )
        .values(is_archived=True, archived_at=utcnow())
    )

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"two_factor": "disabled"},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()


# ─────────────────── Kirishning ikkinchi bosqichi ───────────────────


def issue_challenge(user: User) -> str:
    """Parol tasdiqlangach beriladigan qisqa muddatli token.

    Bu token BOSHQA HECH NARSAGA yaramaydi: `typ` maydoni `"2fa"` va
    `deps.current_user` faqat `"access"` turini qabul qiladi. Ya'ni
    parolni bilgan, lekin kodi yoʻq odam undan foydalana olmaydi.
    """
    import jwt

    hozir = utcnow()
    payload = {
        "sub": str(user.id),
        "typ": "2fa",
        "jti": str(uuid.uuid4()),
        "iat": int(hozir.timestamp()),
        "exp": int((hozir + timedelta(minutes=CHALLENGE_TTL_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_challenge(token: str) -> uuid.UUID:
    import jwt

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub", "jti"]},
        )
        if payload.get("typ") != "2fa":
            raise AuthRequiredError("Token turi mos emas.")
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise AuthRequiredError("Tasdiqlash muddati tugagan. Qaytadan kiring.") from exc


async def verify_second_factor(
    session: AsyncSession, user: User, code: str, *, ip: str | None = None
) -> None:
    """TOTP kodi yoki tiklash kodi. Xato boʻlsa `401`.

    Ikkalasi bitta maydonda: foydalanuvchi "qaysi turdagi kod
    kiritayapman" deb oʻylab oʻtirmasin.
    """
    if not user.totp_secret:
        raise AuthRequiredError("Ikki bosqichli tasdiqlash sozlanmagan.")

    qadam = totp.verify(user.totp_secret, code, last_used_step=user.totp_last_step)
    if qadam is not None:
        user.totp_last_step = qadam
        await session.commit()
        return

    if await _consume_recovery_code(session, user, code, ip=ip):
        return

    raise InvalidCredentialsError("Kod notoʻgʻri yoki muddati oʻtgan.")


async def _consume_recovery_code(
    session: AsyncSession, user: User, code: str, *, ip: str | None
) -> bool:
    """Tiklash kodini ishlatadi. Kod bir martalik."""
    tozalangan = totp.normalize_recovery_code(code)
    if not tozalangan:
        return False

    row = await session.scalar(
        select(TwoFactorRecoveryCode).where(
            TwoFactorRecoveryCode.user_id == user.id,
            TwoFactorRecoveryCode.code_hash == hash_token(tozalangan),
            TwoFactorRecoveryCode.used_at.is_(None),
            TwoFactorRecoveryCode.is_archived.is_(False),
        )
    )
    if row is None:
        return False

    # Oʻchirilmaydi — "qachon tiklash kodi ishlatildi" savoli javobsiz
    # qolmasin (CLAUDE.md 1-qoida).
    row.used_at = utcnow()
    row.used_ip = ip

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"two_factor": "recovery_code_used"},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    return True


async def unused_recovery_count(session: AsyncSession, user_id: uuid.UUID) -> int:
    rows = await session.execute(
        select(TwoFactorRecoveryCode.id).where(
            TwoFactorRecoveryCode.user_id == user_id,
            TwoFactorRecoveryCode.used_at.is_(None),
            TwoFactorRecoveryCode.is_archived.is_(False),
        )
    )
    return len(list(rows.scalars()))
