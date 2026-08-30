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
from app.core.exceptions import AuthRequiredError, PermissionDeniedError
from app.core.security import decode_token
from app.models import User
from app.services.access import CurrentUser


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

    return CurrentUser.from_model(user)


CurrentUserDep = Annotated[CurrentUser, Depends(current_user)]


def require_roles(*roles: str):
    """Berilgan rollardan kamida bittasi boʻlishini talab qiladi."""

    async def guard(user: CurrentUserDep) -> CurrentUser:
        if not user.has(*roles):
            raise PermissionDeniedError("Bu boʻlimga kirish huquqi yoʻq")
        return user

    return guard
