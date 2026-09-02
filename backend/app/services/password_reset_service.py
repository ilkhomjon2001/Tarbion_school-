"""Parolni tiklash (T-006, AUT-02).

Ikki yoʻl, bitta jadval:

  1. **Telefon → Telegram kodi.** Ota-onada raqam bor va Telegram
     ulangan boʻlsa, 6 raqamli kod yuboriladi. Odam kodni va yangi
     parolni kiritadi.
  2. **Administrator qoʻlda tiklaydi.** Kanal boʻlmaganda (Telegram
     ulanmagan) va xodimlar uchun — ularda telefon yoʻq. Soʻrov
     administrator navbatiga tushadi.

TZ shu ikkinchi yoʻlni ATAYLAB talab qiladi: bot ishlamay qolsa yoki
odam Telegramdan foydalanmasa, tizimga kirishning yoʻli butunlay
yopilib qolmasin.

──────────────────────────────────────────────────────────────────────
Nega javob har doim bir xil

`request_by_phone` hech qachon «bunday raqam yoʻq» demaydi. Aks holda
istalgan odam raqamlarni sinab, qaysi biri maktabda roʻyxatda ekanini
aniqlab olardi — bu voyaga yetmaganlarning oilalari roʻyxati. Raqam
topilmasa ham soxta xesh hisoblanadi, javob vaqti ham tenglashadi.

Kod XESHLANGAN saqlanadi va urinishlar sanaladi: 6 raqam atigi million
variant, cheklovsiz uni bir necha daqiqada topib boʻlardi.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidResetCodeError, NotFoundError
from app.core.phone import mask_phone, normalize_phone
from app.core.security import (
    generate_numeric_code,
    hash_password,
    validate_new_password,
    verify_password_constant_time,
)
from app.core.timeutil import utcnow
from app.models import (
    AuditAction,
    PasswordResetRequest,
    Permission,
    ResetChannel,
    User,
)
from app.services import audit_service, outbox_service, permissions, user_service
from app.services.access import CurrentUser

#: Kod necha raqamdan iborat (AUT-02).
CODE_DIGITS = 6

#: Kod qancha yashaydi. Uzunroq muddat — oʻgʻirlangan telefonda
#: ochilgan xabarning uzoqroq ishlashi degani.
CODE_TTL = timedelta(minutes=10)

#: Bitta hisob uchun soʻrovlar orasidagi eng kam vaqt (AUT-02).
#: Bu odamni ham himoya qiladi: kimdir uning raqamini bilib, tinmay
#: soʻrov yuborsa telefoni xabarga koʻmilib ketardi.
COOLDOWN = timedelta(minutes=3)

#: Notoʻgʻri kod necha marta kiritilsa soʻrov yopiladi.
MAX_ATTEMPTS = 5

#: Xabar turi — `notification_preferences` da oʻchirib boʻlmaydi
#: (`outbox_service.MAJBURIY_TURLAR` ga qoʻshilgan).
KIND = "password_reset"


@dataclass(frozen=True, slots=True)
class QueueRow:
    """Administrator navbatidagi bitta soʻrov."""

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    login: str
    roles: list[str]
    phone_masked: str
    created_at: object


async def _oxirgi_sorov(session: AsyncSession, user_id: uuid.UUID) -> PasswordResetRequest | None:
    return await session.scalar(
        select(PasswordResetRequest)
        .where(PasswordResetRequest.user_id == user_id)
        .order_by(PasswordResetRequest.created_at.desc())
        .limit(1)
    )


async def _yarat(
    session: AsyncSession, user: User, ip: str | None
) -> PasswordResetRequest | None:
    """Soʻrov yozadi. Cheklov ishlasa `None`.

    Telegram ulangan boʻlsa kod yaratiladi va navbatga qoʻyiladi;
    boʻlmasa `manual` — administrator koʻradi.
    """
    oxirgi = await _oxirgi_sorov(session, user.id)
    if oxirgi is not None and utcnow() - oxirgi.created_at < COOLDOWN:
        return None

    if user.telegram_id is None:
        sorov = PasswordResetRequest(
            user_id=user.id,
            channel=ResetChannel.MANUAL.value,
            attempts=0,
            requested_ip=ip,
        )
        session.add(sorov)
        return sorov

    kod = generate_numeric_code(CODE_DIGITS)
    sorov = PasswordResetRequest(
        user_id=user.id,
        channel=ResetChannel.TELEGRAM.value,
        code_hash=hash_password(kod),
        expires_at=utcnow() + CODE_TTL,
        attempts=0,
        requested_ip=ip,
    )
    session.add(sorov)

    # Xabar navbat orqali ketadi: Telegram javob bermasa ham soʻrov
    # saqlanadi va worker keyinroq yetkazadi (T-018).
    daqiqa = int(CODE_TTL.total_seconds() // 60)
    await outbox_service.enqueue(
        session,
        user_id=user.id,
        kind=KIND,
        title="Parolni tiklash",
        body=(
            f"Tasdiqlash kodi: {kod}\n\n"
            f"Kod {daqiqa} daqiqa amal qiladi va bir marta ishlaydi.\n"
            "Agar bu soʻrovni siz yubormagan boʻlsangiz — hech kimga aytmang "
            "va maktab administratoriga xabar bering."
        ),
    )
    return sorov


async def request_by_phone(session: AsyncSession, *, phone: str, ip: str | None = None) -> None:
    """Telefon boʻyicha tiklash soʻrovi. Javob HAR DOIM bir xil.

    Raqam topilmasa ham soxta xesh hisoblanadi — javob vaqti bir xil
    boʻlsin, aks holda kechikish farqi raqamning bazada borligini
    oshkor qilardi.
    """
    normal = normalize_phone(phone)
    if normal is None:
        verify_password_constant_time("x", None)
        return

    user = await session.scalar(
        select(User).where(User.phone == normal, User.is_archived.is_(False))
    )
    if user is None:
        verify_password_constant_time("x", None)
        return

    await _yarat(session, user, ip)
    await session.commit()


async def request_by_login(session: AsyncSession, *, login: str, ip: str | None = None) -> None:
    """Login boʻyicha soʻrov — xodimlar uchun.

    Ustoz va maʼmuriyatda telefon yoʻq (hisoblari login bilan
    ochilgan), shuning uchun ular uchun yoʻl har doim `manual`:
    administrator yangi parol beradi.
    """
    user = await session.scalar(
        select(User).where(User.login == login.strip().lower(), User.is_archived.is_(False))
    )
    if user is None:
        verify_password_constant_time("x", None)
        return

    oxirgi = await _oxirgi_sorov(session, user.id)
    if oxirgi is not None and utcnow() - oxirgi.created_at < COOLDOWN:
        return

    session.add(
        PasswordResetRequest(
            user_id=user.id,
            channel=ResetChannel.MANUAL.value,
            attempts=0,
            requested_ip=ip,
        )
    )
    await session.commit()


async def confirm(
    session: AsyncSession, *, phone: str, code: str, new_password: str, ip: str | None = None
) -> None:
    """Kodni tekshiradi va yangi parolni oʻrnatadi.

    Xato holatlarining hammasi BIR XIL xabar beradi: «kod notoʻgʻri
    yoki muddati oʻtgan». Ajratilsa hujumchi qaysi raqamda faol soʻrov
    borligini bilib olardi.
    """
    # Parol qoidasi kod tekshiruvidan OLDIN: odam kodni toʻgʻri kiritib,
    # keyin «parol qisqa» xabarini olsa, kod allaqachon yonib ketgan
    # boʻlardi va qaytadan soʻrashga toʻgʻri kelardi.
    validate_new_password(new_password)

    normal = normalize_phone(phone)
    if normal is None:
        verify_password_constant_time(code, None)
        raise InvalidResetCodeError

    user = await session.scalar(
        select(User).where(User.phone == normal, User.is_archived.is_(False))
    )
    if user is None:
        verify_password_constant_time(code, None)
        raise InvalidResetCodeError

    sorov = await session.scalar(
        select(PasswordResetRequest)
        .where(
            PasswordResetRequest.user_id == user.id,
            PasswordResetRequest.channel == ResetChannel.TELEGRAM.value,
            PasswordResetRequest.used_at.is_(None),
            PasswordResetRequest.is_archived.is_(False),
        )
        .order_by(PasswordResetRequest.created_at.desc())
        .limit(1)
    )
    if sorov is None or sorov.code_hash is None:
        verify_password_constant_time(code, None)
        raise InvalidResetCodeError

    if sorov.expires_at is not None and sorov.expires_at < utcnow():
        raise InvalidResetCodeError

    if sorov.attempts >= MAX_ATTEMPTS:
        raise InvalidResetCodeError

    if not verify_password_constant_time(code, sorov.code_hash):
        sorov.attempts += 1
        await session.commit()
        raise InvalidResetCodeError

    # Kod bir marta ishlaydi: ikkinchi urinishda `used_at` toʻlgan
    # boʻladi va soʻrov yuqoridagi filtrga tushmaydi.
    sorov.used_at = utcnow()
    user.password_hash = hash_password(new_password)
    user.must_change_password = False

    # AUT-08: parol oʻzgardi — barcha qurilmalardagi sessiya oʻladi.
    # Hisob egallangan boʻlsa oʻgʻrining refresh tokeni ishlamasin.
    await user_service.revoke_all_sessions(session, user.id, reason="password_reset")

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"password_reset_by_code": True},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()


async def pending(session: AsyncSession, actor: CurrentUser) -> list[QueueRow]:
    """Administrator navbati: hal qilinmagan qoʻlda tiklash soʻrovlari."""
    await permissions.assert_permission(session, actor, Permission.USERS_RESET_PASSWORD)

    rows = await session.execute(
        select(PasswordResetRequest, User)
        .join(User, User.id == PasswordResetRequest.user_id)
        .where(
            PasswordResetRequest.channel == ResetChannel.MANUAL.value,
            PasswordResetRequest.resolved_at.is_(None),
            PasswordResetRequest.is_archived.is_(False),
        )
        .order_by(PasswordResetRequest.created_at)
    )
    return [
        QueueRow(
            id=r.id,
            user_id=u.id,
            full_name=u.full_name,
            login=u.login,
            roles=sorted(u.role_names),
            phone_masked=mask_phone(u.phone),
            created_at=r.created_at,
        )
        for r, u in rows.all()
    ]


async def resolve(
    session: AsyncSession, *, actor: CurrentUser, request_id: uuid.UUID, ip: str | None = None
) -> tuple[str, str]:
    """Administrator soʻrovni hal qiladi. Qaytaradi: `(login, yangi parol)`.

    Parol FAQAT shu javobda koʻrinadi — u hech qayerda saqlanmaydi va
    logga tushmaydi (X-10). Administrator uni odamga oʻzi yetkazadi.
    """
    sorov = await session.get(PasswordResetRequest, request_id)
    if sorov is None or sorov.resolved_at is not None:
        raise NotFoundError("Soʻrov topilmadi yoki allaqachon hal qilingan.")

    # Huquq tekshiruvi `user_service.reset_password` ichida ham bor —
    # bu yerda ataylab takrorlanmaydi.
    parol = await user_service.reset_password(
        session, actor=actor, user_id=sorov.user_id, ip=ip
    )

    sorov.resolved_by_id = actor.id
    sorov.resolved_at = utcnow()

    user = await session.get(User, sorov.user_id)
    await session.commit()
    return (user.login if user else "", parol)
