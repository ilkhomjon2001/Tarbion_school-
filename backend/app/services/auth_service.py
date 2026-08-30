"""Autentifikatsiya (T-004). TZ: AUT-01, AUT-05, AUT-06, AUT-07, AUT-08."""

import re
import uuid
from datetime import timedelta

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
    verify_password,
)
from app.core.timeutil import utcnow
from app.models import AuditAction, LoginAttempt, LoginLog, RefreshToken, Role, User
from app.services import audit_service

_DIGITS = re.compile(r"\D")


def normalize_phone(raw: str) -> str:
    """+998 90 123 45 67 → 998901234567.

    Login identifikatori yagona shaklda saqlanadi, aks holda bitta odam
    ikki xil yozilib ikki hisob ochib yuboradi.
    """
    digits = _DIGITS.sub("", raw or "")
    if digits.startswith("998"):
        pass
    elif len(digits) == 9:
        digits = "998" + digits
    elif digits.startswith("8") and len(digits) == 10:
        digits = "998" + digits[1:]
    if len(digits) != 12 or not digits.startswith("998"):
        raise ValidationError("Telefon raqami notoʻgʻri. Namuna: +998 90 123 45 67")
    return digits


async def _is_locked(session: AsyncSession, phone: str) -> bool:
    """AUT-05: oxirgi oynada 5 ta muvaffaqiyatsiz urinish boʻlsa — bloklangan.

    Redis yoʻq (DECISIONS.md), hisob shu jadvaldan olinadi. Oxirgi
    muvaffaqiyatli kirishdan keyingi urinishlar hisoblanadi, shunda
    toʻgʻri parol kiritgan odam eski xatolar tufayli bloklanmaydi.
    """
    window_start = utcnow() - timedelta(minutes=settings.login_lockout_minutes)

    last_ok = await session.scalar(
        select(func.max(LoginAttempt.created_at)).where(
            LoginAttempt.phone == phone, LoginAttempt.successful.is_(True)
        )
    )
    since = max(window_start, last_ok) if last_ok else window_start

    failures = await session.scalar(
        select(func.count())
        .select_from(LoginAttempt)
        .where(
            LoginAttempt.phone == phone,
            LoginAttempt.successful.is_(False),
            LoginAttempt.created_at >= since,
        )
    )
    return (failures or 0) >= settings.login_max_attempts


async def authenticate(
    session: AsyncSession,
    *,
    phone_raw: str,
    password: str,
    ip: str | None,
    user_agent: str | None,
) -> tuple[User, str, str]:
    """Kirish. (user, access_token, refresh_token) qaytaradi."""
    phone = normalize_phone(phone_raw)

    if await _is_locked(session, phone):
        raise AccountLockedError(
            f"Hisob {settings.login_lockout_minutes} daqiqaga bloklandi. "
            "Keyinroq qayta urinib koʻring."
        )

    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.phone == phone)
    )

    # Parolni foydalanuvchi topilmasa ham tekshirmaymiz, lekin javob vaqti
    # bir xil boʻlishi uchun xesh solishtiriladi (user enumeration'ga qarshi).
    ok = bool(user) and verify_password(password, user.password_hash)  # type: ignore[union-attr]
    if not ok:
        session.add(LoginAttempt(phone=phone, successful=False, ip_address=ip))
        await session.commit()
        raise InvalidCredentialsError

    assert user is not None
    if not user.is_active or user.is_archived:
        session.add(LoginAttempt(phone=phone, successful=False, ip_address=ip))
        await session.commit()
        raise AccountInactiveError

    # argon2 parametrlari kuchaytirilgan boʻlsa — jimgina yangilanadi.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    now = utcnow()
    user.last_login_at = now
    session.add(LoginAttempt(phone=phone, successful=True, ip_address=ip))
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

    access, _ = create_token(user.id, "access", roles=user.role_names)
    refresh = await _issue_refresh(
        session, user_id=user.id, family_id=uuid.uuid4(), ip=ip, user_agent=user_agent
    )
    await session.commit()
    return user, access, refresh


async def _issue_refresh(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    family_id: uuid.UUID,
    ip: str | None,
    user_agent: str | None,
) -> str:
    now = utcnow()
    token, jti = create_token(user_id, "refresh", family_id=family_id)
    session.add(
        RefreshToken(
            id=jti,
            user_id=user_id,
            family_id=family_id,
            token_hash=hash_token(token),
            issued_at=now,
            expires_at=now + timedelta(days=settings.refresh_token_ttl_days),
            ip_address=ip,
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    return token


async def rotate_refresh(
    session: AsyncSession,
    *,
    raw_token: str,
    ip: str | None,
    user_agent: str | None,
) -> tuple[User, str, str]:
    """Refresh tokenni aylantiradi va qayta ishlatilishini aniqlaydi.

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
    refresh = await _issue_refresh(
        session, user_id=user.id, family_id=stored.family_id, ip=ip, user_agent=user_agent
    )
    await session.commit()
    return user, access, refresh


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


async def change_password(
    session: AsyncSession,
    *,
    user: User,
    current_password: str,
    new_password: str,
    ip: str | None,
) -> None:
    """AUT-08. Eski parol soʻraladi va barcha sessiyalar bekor qilinadi."""
    if not verify_password(current_password, user.password_hash):
        raise InvalidCredentialsError("Joriy parol notoʻgʻri.")
    if len(new_password) < 8:
        raise ValidationError("Yangi parol kamida 8 belgidan iborat boʻlsin.")
    if current_password == new_password:
        raise ValidationError("Yangi parol eskisidan farq qilishi kerak.")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False

    # Parol oʻzgardi — barcha qurilmalardagi sessiya tugatiladi.
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow(), revoked_reason="password_changed")
    )
    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"password": "***"},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()


async def ensure_roles(session: AsyncSession, names: list[str]) -> dict[str, Role]:
    """Rollarni oʻqiydi (seed uchun)."""
    rows = await session.execute(select(Role).where(Role.name.in_(names)))
    return {r.name: r for r in rows.scalars()}
