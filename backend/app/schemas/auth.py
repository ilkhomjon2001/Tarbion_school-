"""Auth sxemalari (T-004). TZ: AUT-01, AUT-04."""

import uuid
from typing import Literal

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
    #: Oʻquvchi roli uchun (T-034): kabinet oʻz maʼlumotini shu id bilan
    #: soʻraydi. Server baribir `access.py` orqali tekshiradi — bu qulaylik.
    student_id: uuid.UUID | None = None
    class_id: uuid.UUID | None = None
    class_name: str | None = None


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


# ─────────────────── Ikki bosqichli tasdiqlash (X-14) ───────────────────


class TwoFactorRequiredOut(BaseModel):
    """Parol toʻgʻri, lekin kod kerak.

    Access token BERILMAYDI: parolni bilgan, kodi yoʻq odam hech
    qanday token olmasin.
    """

    two_factor_required: Literal[True] = True
    challenge_token: str
    #: Tiklash kodi ham qabul qilinishini interfeys aytib tursin.
    recovery_available: bool


class TwoFactorVerifyIn(BaseModel):
    challenge_token: str
    #: TOTP kodi yoki tiklash kodi — ikkalasi bitta maydonda.
    code: str = Field(min_length=6, max_length=16)


class TwoFactorSetupOut(BaseModel):
    """Sekret BIR MARTA qaytadi — keyin uni hech qayerdan olib boʻlmaydi."""

    secret: str
    #: `otpauth://` — QR ni frontend chizadi.
    uri: str


class TwoFactorEnableIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class TwoFactorDisableIn(BaseModel):
    password: str = Field(min_length=1)
    code: str = Field(min_length=6, max_length=16)


class RecoveryCodesIn(BaseModel):
    password: str = Field(min_length=1)


class RecoveryCodesOut(BaseModel):
    """Kodlar BIR MARTA koʻrsatiladi — bazada faqat xeshi qoladi."""

    codes: list[str]


class TwoFactorStatusOut(BaseModel):
    enabled: bool
    #: Rol boʻyicha majburiymi (X-14).
    required: bool
    unused_recovery_codes: int
