"""Autentifikatsiya (T-004). TZ: AUT-01, AUT-05, AUT-06, AUT-07, AUT-08."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    AccountInactiveError,
    AccountLockedError,
    InvalidCredentialsError,
    ValidationError,
)
from app.core.security import (
    create_token,
    hash_password,
    hash_token,
    needs_rehash,
    verify_password_constant_time,
)
from app.core.timeutil import utcnow
from app.models import AuditAction, LoginAttempt, LoginLog, RefreshToken, Role, User
from app.services import audit_service


def normalize_login(raw: str) -> str:
    """Kiritilgan loginni yagona shaklga keltiradi.

    Odamlar loginni katta harf bilan yoki boʻshliq bilan yozadi. Bazada
    login kichik harfda saqlanadi, shuning uchun solishtirishdan oldin
    ham shunga keltiriladi — aks holda `Aliyev.Sardor` kira olmasdi.
    """
    login = (raw or "").strip().lower()
    if not login:
        raise ValidationError("Login kiritilmadi.")
    return login


async def _ip_is_locked(session: AsyncSession, ip: str | None) -> bool:
    """Bitta IP dan koʻp TURLI login boʻyicha xato — parol purkash.

    Login boʻyicha bloklash yolgʻiz yetarli emas: hujumchi bitta
    ommabop parolni ("12345") 500 ta login boʻyicha sinasa, hech bir
    hisob 5 ta chegaraga yetmaydi va hech kim bloklanmaydi.

    Lekin XATOLAR SONINI sanash ham notoʻgʻri boʻlardi: butun maktab
    bitta NAT ortidan chiqadi va oʻquv yili boshida 500 kishi parolini
    xato terib, barchani bloklab qoʻyardi.

    Shu sababli TURLI loginlar soni sanaladi. Oddiy foydalanuvchi
    oʻzining bitta loginida adashadi; hujumchi esa oʻnlab login boʻyicha
    urinadi. Bu ikkisini ajratadigan yagona ishonchli belgi.
    """
    if not ip:
        return False

    window_start = utcnow() - timedelta(minutes=settings.login_attempt_window_minutes)
    turli_loginlar = await session.scalar(
        select(func.count(func.distinct(LoginAttempt.login))).where(
            LoginAttempt.ip_address == ip,
            LoginAttempt.successful.is_(False),
            LoginAttempt.created_at >= window_start,
        )
    )
    return (turli_loginlar or 0) >= settings.login_max_logins_per_ip


async def _is_locked(session: AsyncSession, login: str) -> bool:
    """AUT-05: oxirgi oynada 5 ta muvaffaqiyatsiz urinish boʻlsa — bloklangan.

    Redis yoʻq (DECISIONS.md), hisob shu jadvaldan olinadi. Oxirgi
    muvaffaqiyatli kirishdan keyingi urinishlar hisoblanadi, shunda
    toʻgʻri parol kiritgan odam eski xatolar tufayli bloklanmaydi.
    """
    window_start = utcnow() - timedelta(minutes=settings.login_lockout_minutes)

    last_ok = await session.scalar(
        select(func.max(LoginAttempt.created_at)).where(
            LoginAttempt.login == login, LoginAttempt.successful.is_(True)
        )
    )
    since = max(window_start, last_ok) if last_ok else window_start

    failures = await session.scalar(
        select(func.count())
        .select_from(LoginAttempt)
        .where(
            LoginAttempt.login == login,
            LoginAttempt.successful.is_(False),
            LoginAttempt.created_at >= since,
        )
    )
    return (failures or 0) >= settings.login_max_attempts


async def authenticate(
    session: AsyncSession,
    *,
    login_raw: str,
    password: str,
    ip: str | None,
    user_agent: str | None,
    remember: bool = True,
) -> tuple[User, str, str]:
    """Kirish. (user, access_token, refresh_token) qaytaradi."""
    login = normalize_login(login_raw)

    if await _is_locked(session, login) or await _ip_is_locked(session, ip):
        # Xabar ikkala holatda bir xil: qaysi biri ishlaganini aytish
        # hujumchiga login mavjudligini bildirardi (X-3 ruhida).
        raise AccountLockedError(
            f"Juda koʻp urinish. {settings.login_lockout_minutes} daqiqadan soʻng "
            "qayta urinib koʻring."
        )

    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.login == login)
    )

    # Foydalanuvchi topilmasa ham argon2 ISHLAYDI — soxta xesh bilan.
    # Aks holda mavjud login ~80 ms, mavjud boʻlmagani ~1 ms da javob
    # qaytarardi va hujumchi shu farqdan loginlar roʻyxatini yigʻib
    # olardi (user enumeration).
    ok = verify_password_constant_time(password, user.password_hash if user else None)
    if not ok:
        session.add(LoginAttempt(login=login, successful=False, ip_address=ip))
        await session.commit()
        raise InvalidCredentialsError

    assert user is not None
    if not user.is_active or user.is_archived:
        session.add(LoginAttempt(login=login, successful=False, ip_address=ip))
        await session.commit()
        raise AccountInactiveError

    # argon2 parametrlari kuchaytirilgan boʻlsa — jimgina yangilanadi.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    now = utcnow()
    user.last_login_at = now
    session.add(LoginAttempt(login=login, successful=True, ip_address=ip))
    # AUT-06: har kirish jurnalga.
    session.add(LoginLog(user_id=user.id, ip_address=ip, user_agent=(user_agent or "")[:255]))
    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.LOGIN,
        actor_id=user.id,
        ip=ip,
    )

    await session.commit()
    return user, *await issue_session(
        session, user, ip=ip, user_agent=user_agent, remember=remember
    )


#: «Eslab qolish» belgilanmagan sessiyaning yashash muddati.
#:
#: 12 soat — bir ish kuni va ozgina zaxira. Sozlamaga chiqarilmadi:
#: bu xavfsizlik qarori, muhitga qarab oʻzgaradigan narsa emas. Uzun
#: qilib qoʻyish «eslab qolmang» degan tanlovni maʼnosiz qilardi.
VAQTINCHALIK_TTL = timedelta(hours=12)


async def issue_session(
    session: AsyncSession,
    user: User,
    *,
    ip: str | None,
    user_agent: str | None,
    remember: bool = True,
) -> tuple[str, str]:
    """Access va refresh token beradi.

    Alohida funksiya: 2FA yoqilgan boʻlsa tokenlar kirish paytida emas,
    KOD TASDIQLANGANDAN keyin beriladi (`twofactor_service`).
    """
    access, _ = create_token(user.id, "access", roles=user.role_names)
    refresh = await _issue_refresh(
        session,
        user_id=user.id,
        family_id=uuid.uuid4(),
        ip=ip,
        user_agent=user_agent,
        remember=remember,
    )
    await session.commit()
    return access, refresh


async def _issue_refresh(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    family_id: uuid.UUID,
    ip: str | None,
    user_agent: str | None,
    remember: bool = True,
) -> str:
    now = utcnow()
    token, jti = create_token(user_id, "refresh", family_id=family_id)
    umr = timedelta(days=settings.refresh_token_ttl_days) if remember else VAQTINCHALIK_TTL
    session.add(
        RefreshToken(
            id=jti,
            user_id=user_id,
            family_id=family_id,
            token_hash=hash_token(token),
            issued_at=now,
            expires_at=now + umr,
            ip_address=ip,
            user_agent=(user_agent or "")[:255] or None,
            remember=remember,
        )
    )
    return token


async def rotate_refresh(
    session: AsyncSession,
    *,
    raw_token: str,
    ip: str | None,
    user_agent: str | None,
) -> tuple[User, str, str, bool]:
    """Refresh tokenni aylantiradi va qayta ishlatilishini aniqlaydi.

    Toʻrtinchi qiymat — sessiya «eslab qolingan»mi. Router uni cookie
    uchun ishlatadi: vaqtinchalik sessiyaga `max_age` qoʻyilmaydi.

    Bekor qilingan token qaytadan kelsa — oʻgʻirlangan deb hisoblanadi va
    butun oila bekor qilinadi. Bu OWASP tavsiya etgan "refresh token reuse
    detection" — token oʻgʻirlangan holatda zarar oynasi qisqaradi.
    """
    from jwt import PyJWTError

    from app.core.exceptions import AuthRequiredError
    from app.core.security import decode_token

    try:
        # Natija kerak emas — imzo, muddat va turi tekshirilsa yetarli.
        # Kimning tokeni ekani bazadagi yozuvdan aniqlanadi, JWT ichidan emas.
        decode_token(raw_token, "refresh")
    except PyJWTError as exc:
        raise AuthRequiredError from exc

    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    )
    if stored is None:
        raise AuthRequiredError

    if stored.revoked_at is not None:
        # Qayta ishlatish aniqlandi — butun oilani bekor qilamiz.
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == stored.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow(), revoked_reason="reuse_detected")
        )
        audit_service.record(
            session,
            object_type="refresh_token",
            object_id=stored.id,
            action="reuse_detected",
            actor_id=stored.user_id,
            ip=ip,
        )
        await session.commit()
        raise AuthRequiredError("Sessiya xavfsizlik sababli tugatildi. Qaytadan kiring.")

    if stored.expires_at <= utcnow():
        raise AuthRequiredError

    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.id == stored.user_id)
    )
    if user is None or not user.is_active or user.is_archived:
        raise AccountInactiveError

    stored.revoked_at = utcnow()
    stored.revoked_reason = "rotated"

    # Rollar bazadan qayta oʻqiladi — admin rolni olib qoʻygan boʻlsa,
    # yangilashda darhol kuchga kiradi.
    access, _ = create_token(user.id, "access", roles=user.role_names)
    # `stored.remember` UZATILISHI SHART: usiz vaqtinchalik sessiya
    # birinchi yangilanishdayoq 30 kunlik doimiy sessiyaga aylanib
    # ketardi va «eslab qolmang» degan tanlov maʼnosiz boʻlardi.
    refresh = await _issue_refresh(
        session,
        user_id=user.id,
        family_id=stored.family_id,
        ip=ip,
        user_agent=user_agent,
        remember=stored.remember,
    )
    await session.commit()
    return user, access, refresh, stored.remember


async def revoke_session(session: AsyncSession, *, raw_token: str | None) -> None:
    """Chiqish. Token yoʻq boʻlsa ham xato bermaydi (idempotent)."""
    if not raw_token:
        return
    stored = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    )
    if stored and stored.revoked_at is None:
        stored.revoked_at = utcnow()
        stored.revoked_reason = "logout"
        audit_service.record(
            session,
            object_type="user",
            object_id=stored.user_id,
            action=AuditAction.LOGOUT,
            actor_id=stored.user_id,
        )
    await session.commit()


# ───────────────────── Faol qurilmalar (AUT-09 kengaytmasi) ─────────────────────
#
# Loyiha egasining soʻrovi (2026-08-29): maktab va umumiy
# kompyuterlarda hisob ochiq qolib ketmasin. Odam oʻz sessiyalarini
# koʻrsin va begonasini bekor qila olsin.
#
# Bitta qurilma = bitta `family_id`. Aylantirish har 15 daqiqada yangi
# token beradi, lekin oila bir xil qoladi — shuning uchun roʻyxat
# tokenlar boʻyicha emas, OILALAR boʻyicha tuziladi. Aks holda bitta
# telefon roʻyxatda oʻnlab qator boʻlib chiqardi.


@dataclass(frozen=True, slots=True)
class DeviceSession:
    family_id: uuid.UUID
    user_agent: str | None
    ip_address: str | None
    issued_at: datetime
    expires_at: datetime
    remember: bool
    current: bool


async def list_sessions(
    session: AsyncSession, *, user_id: uuid.UUID, current_raw_token: str | None = None
) -> list[DeviceSession]:
    """Foydalanuvchining FAOL sessiyalari, qurilma boʻyicha.

    X-1: `user_id` doim soʻrov darajasida — bu yerga faqat oʻz
    sessiyalari tushadi va boshqa odamnikini koʻrishning yoʻli yoʻq.
    """
    joriy_hash = hash_token(current_raw_token) if current_raw_token else None

    rows = (
        await session.execute(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > utcnow(),
            )
            .order_by(RefreshToken.family_id, RefreshToken.issued_at.desc())
        )
    ).scalars()

    # Har oiladan faqat ENG YANGI token qoladi.
    korilgan: dict[uuid.UUID, DeviceSession] = {}
    for t in rows:
        if t.family_id in korilgan:
            continue
        korilgan[t.family_id] = DeviceSession(
            family_id=t.family_id,
            user_agent=t.user_agent,
            ip_address=str(t.ip_address) if t.ip_address else None,
            issued_at=t.issued_at,
            expires_at=t.expires_at,
            remember=t.remember,
            current=joriy_hash is not None and t.token_hash == joriy_hash,
        )

    # Joriy qurilma birinchi, qolgani yangiligi boʻyicha.
    return sorted(korilgan.values(), key=lambda s: (not s.current, -s.issued_at.timestamp()))


async def revoke_family(
    session: AsyncSession, *, user_id: uuid.UUID, family_id: uuid.UUID, ip: str | None = None
) -> bool:
    """Bitta qurilmani chiqaradi. Oʻzinikini emasligini bilib boʻlmaydi.

    `user_id` shartda TURADI: usiz boshqa odamning `family_id` sini
    topib, uni tizimdan chiqarib yuborish mumkin boʻlardi.
    """
    natija = await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=utcnow(), revoked_reason="revoked_by_user")
    )
    if natija.rowcount:
        audit_service.record(
            session,
            object_type="user",
            object_id=user_id,
            action=AuditAction.LOGOUT,
            old={"session": str(family_id)},
            new={"revoked": True},
            actor_id=user_id,
            ip=ip,
        )
    await session.commit()
    return bool(natija.rowcount)


async def revoke_other_sessions(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    current_raw_token: str | None,
    ip: str | None = None,
) -> int:
    """Joriy qurilmadan tashqari HAMMASINI chiqaradi.

    Aynan shu tugma parol oʻgʻirlangan deb gumon qilinganda bosiladi,
    shuning uchun u bitta amalda ishlashi kerak — foydalanuvchi
    roʻyxatdan bittalab tanlab oʻtirmasin.
    """
    shartlar = [
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    ]
    if current_raw_token:
        joriy = await session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(current_raw_token))
        )
        if joriy is not None:
            shartlar.append(RefreshToken.family_id != joriy.family_id)

    natija = await session.execute(
        update(RefreshToken)
        .where(*shartlar)
        .values(revoked_at=utcnow(), revoked_reason="revoked_others")
    )
    if natija.rowcount:
        audit_service.record(
            session,
            object_type="user",
            object_id=user_id,
            action=AuditAction.LOGOUT,
            new={"revoked_others": natija.rowcount},
            actor_id=user_id,
            ip=ip,
        )
    await session.commit()
    return natija.rowcount


async def ensure_roles(session: AsyncSession, names: list[str]) -> dict[str, Role]:
    """Rollarni oʻqiydi (seed uchun)."""
    rows = await session.execute(select(Role).where(Role.name.in_(names)))
    return {r.name: r for r in rows.scalars()}
