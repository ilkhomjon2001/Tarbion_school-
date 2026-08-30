"""Auth sxemalari (T-004). TZ: AUT-01, AUT-04."""

import uuid

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    # Telefon istalgan koʻrinishda kelishi mumkin (+998 90 111 22 33),
    # servisda normallashtiriladi.
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    full_name: str
    short_name: str
    roles: list[str]
    must_change_password: bool


class TokenOut(BaseModel):
    """Refresh token javob tanasida QAYTMAYDI — httpOnly cookie'da ketadi."""

    access_token: str
    token_type: str = "bearer"  # noqa: S105 — sxema qiymati, parol emas
    user: UserOut
