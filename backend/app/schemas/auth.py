"""Auth sxemalari (T-004). TZ: AUT-01, AUT-04."""

import uuid

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    # Login `familiya.ism` shaklida (app/core/naming.py). Katta-kichik
    # harf farq qilmaydi — servisda kichik harfga keltiriladi.
    login: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    login: str
    full_name: str
    short_name: str
    roles: list[str]
    must_change_password: bool
    #: Qaysi kabinet ochiladi (T-005).
    cabinet: str = "student"
    #: Menyuda koʻrinadigan boʻlimlar. Frontend shu roʻyxatdan chizadi —
    #: oʻzi hisoblamaydi, aks holda server bilan farq qilib qolardi.
    sections: list[str] = []
    #: Qaysi amallarni bajara oladi. Tugmalarni yashirish uchun; haqiqiy
    #: tekshiruv baribir serverda (CLAUDE.md 7-qoida).
    permissions: list[str] = []


class TokenOut(BaseModel):
    """Refresh token javob tanasida QAYTMAYDI — httpOnly cookie'da ketadi."""

    access_token: str
    token_type: str = "bearer"  # noqa: S105 — sxema qiymati, parol emas
    user: UserOut


class ChangePasswordIn(BaseModel):
    """Parolni almashtirish (AUT-08).

    Eski parol soʻraladi — ochiq qolgan sessiyani topgan odam hisobni
    butunlay egallab olmasin.
    """

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
