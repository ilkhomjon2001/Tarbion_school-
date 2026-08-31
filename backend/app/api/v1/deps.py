"""Soʻrov darajasidagi bogʻliqliklar: joriy foydalanuvchi va rol tekshiruvi.

CLAUDE.md 7-qoida: rol tekshiruvi HAR DOIM serverda. Frontenddagi
koʻrinishni boshqarish — qulaylik, himoya emas.
"""

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.db import SessionDep
from app.core.exceptions import (
    AuthRequiredError,
    PasswordChangeRequiredError,
    PermissionDeniedError,
    TwoFactorSetupRequiredError,
)
from app.core.security import decode_token
from app.models import User
from app.services import twofactor_service
from app.services.access import CurrentUser

#: Parol almashtirilmaguncha ochiq qoladigan yoʻllar. Roʻyxat qisqa
#: boʻlishi shart: har qoʻshilgan yoʻl zaif parol bilan ishlatiladigan
#: yuza demakdir.
PASSWORD_CHANGE_ALLOWED = frozenset(
    {
        "/api/v1/auth/me",
        "/api/v1/auth/change-password",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
    }
)

#: 2FA yoqilmaguncha ochiq qoladigan yoʻllar (X-14). Sozlash oqimining
#: oʻzi ochiq boʻlishi shart, aks holda foydalanuvchi 2FA ni yoqa
#: olmasdan qulflanib qolardi.
TWO_FACTOR_ALLOWED = PASSWORD_CHANGE_ALLOWED | {
    "/api/v1/auth/2fa",
    "/api/v1/auth/2fa/setup",
    "/api/v1/auth/2fa/enable",
}


def _bearer(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthRequiredError("Kirish tokeni yuborilmadi")
    return token


async def current_user(request: Request, session: SessionDep) -> CurrentUser:
    """Access tokendan foydalanuvchi.

    Rollar TOKENDAN emas, BAZADAN oʻqiladi: admin rolni olib qoʻygan
    boʻlsa, eski token bilan eski huquq ishlab ketmasin. Token faqat
    «kim ekanini» tasdiqlaydi.
    """
    try:
        payload = decode_token(_bearer(request), "access")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise AuthRequiredError("Token yaroqsiz yoki muddati oʻtgan") from exc

    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    if user is None or not user.is_active or user.is_archived:
        raise AuthRequiredError("Hisob faol emas")

    # Boshlangʻich parol — 5 xonali raqam, atigi 100 000 variant. U
    # FAQAT birinchi kirish uchun. Almashtirilmaguncha API yopiq:
    # aks holda ustoz oʻsha zaif parol bilan butun yil ishlab yurardi
    # va bitta topilgan parol butun sinf maʼlumotini ochib berardi.
    if user.must_change_password and request.url.path not in PASSWORD_CHANGE_ALLOWED:
        raise PasswordChangeRequiredError

    # X-14: administrator va direktor butun bazani koʻradi — ularning
    # bitta paroli butun maktabni ochib beradi. Ixtiyoriy 2FA — deyarli
    # hech kim yoqmaydigan 2FA, shuning uchun yoqilmaguncha API yopiq.
    # Qolgan rollarda funksiya ochiq, lekin majburiy emas.
    if (
        twofactor_service.is_required(user)
        and not user.two_factor_enabled
        and request.url.path not in TWO_FACTOR_ALLOWED
    ):
        raise TwoFactorSetupRequiredError

    return CurrentUser.from_model(user)


CurrentUserDep = Annotated[CurrentUser, Depends(current_user)]


def require_roles(*roles: str):
    """Berilgan rollardan kamida bittasi boʻlishini talab qiladi."""

    async def guard(user: CurrentUserDep) -> CurrentUser:
        if not user.has(*roles):
            raise PermissionDeniedError("Bu boʻlimga kirish huquqi yoʻq")
        return user

    return guard
