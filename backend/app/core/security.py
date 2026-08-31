"""Parol xeshlash va JWT.

NFR-06: parollar argon2 bilan xeshlanadi, ochiq saqlanmaydi.
"""

import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings
from app.core.exceptions import ValidationError
from app.core.timeutil import utcnow

# argon2id, OWASP tavsiya etgan minimumdan yuqori parametrlar.
# 64 MiB xotira / 3 iteratsiya — VPS uchun ~50-80ms, brute-force uchun qimmat.
_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2, hash_len=32)

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


#: Foydalanuvchi topilmaganda solishtiriladigan soxta xesh.
#:
#: Modul yuklanganda BIR MARTA hisoblanadi. Maqsad — javob vaqtini
#: tenglashtirish: mavjud login uchun argon2 ~80 ms ishlaydi, mavjud
#: boʻlmagani uchun esa hech narsa ishlamasa javob ~1 ms da qaytardi va
#: hujumchi shu farqdan qaysi loginlar borligini aniqlab olardi
#: (user enumeration).
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(32))


def verify_password_constant_time(password: str, password_hash: str | None) -> bool:
    """Parolni tekshiradi; xesh yoʻq boʻlsa ham argon2 ishlaydi.

    `password_hash=None` — bunday login yoʻq. Shunda soxta xesh bilan
    solishtiriladi: natija har doim `False`, lekin sarflangan vaqt
    haqiqiy tekshiruvnikiga teng.
    """
    if password_hash is None:
        # Natija ataylab tashlab yuboriladi — bizga faqat sarflangan
        # vaqt kerak.
        verify_password(password, _DUMMY_HASH)
        return False
    return verify_password(password, password_hash)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    return True


def needs_rehash(password_hash: str) -> bool:
    """Parametrlar kuchaytirilgan bo'lsa, keyingi muvaffaqiyatli kirishda
    xesh jimgina yangilanadi."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def create_token(
    subject: uuid.UUID,
    token_type: TokenType,
    *,
    roles: list[str] | None = None,
    jti: uuid.UUID | None = None,
    family_id: uuid.UUID | None = None,
) -> tuple[str, uuid.UUID]:
    """JWT yaratadi. (token, jti) qaytaradi."""
    now = utcnow()
    ttl = (
        timedelta(minutes=settings.access_token_ttl_minutes)
        if token_type == "access"  # noqa: S105 — parol emas, token turi
        else timedelta(days=settings.refresh_token_ttl_days)
    )
    token_id = jti or uuid.uuid4()

    payload: dict[str, Any] = {
        "sub": str(subject),
        "typ": token_type,
        "jti": str(token_id),
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    if token_type == "access":  # noqa: S105 — parol emas, token turi
        # Rollar faqat access tokenda — refresh token bilan huquq oshirib
        # bo'lmaydi, har yangilashda baza qayta o'qiladi.
        payload["roles"] = roles or []
    if family_id is not None:
        payload["fam"] = str(family_id)

    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), token_id


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Tokenni tekshiradi. Xato bo'lsa jwt.PyJWTError ko'taradi."""
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["exp", "iat", "sub", "jti"]},
    )
    if payload.get("typ") != expected_type:
        raise jwt.InvalidTokenError("token turi mos emas")
    return payload


def hash_token(token: str) -> str:
    """Refresh tokenni bazaga saqlash uchun xeshlaydi.

    Baza o'g'irlansa ham tokenlar ishlatib bo'lmaydi. Parol emas, yuqori
    entropiyali qiymat bo'lgani uchun sha256 yetarli (argon2 shart emas).
    """
    return hashlib.sha256(token.encode()).hexdigest()


def compare_digest(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


def generate_numeric_code(digits: int = 6) -> str:
    """Bir martalik tasdiq kodi (AUT-02)."""
    return "".join(secrets.choice("0123456789") for _ in range(digits))


#: Administrator hisob ochganda beriladigan boshlang'ich parol uzunligi.
#: Loyiha egasining talabi: 5 xonali raqam — ustozga og'zaki aytish oson.
INITIAL_PASSWORD_DIGITS = 5

#: Foydalanuvchi o'zi tanlaydigan parol uchun eng kam uzunlik. Boshlang'ich
#: paroldan uzunroq: u vaqtinchalik, bu esa doimiy.
MIN_PASSWORD_LENGTH = 8


def generate_initial_password() -> str:
    """Yangi hisob uchun 5 xonali parol.

    OGOHLANTIRISH: 5 xonali raqam — atigi 100 000 variant. Bu parol
    FAQAT birinchi kirish uchun: hisob `must_change_password=True` bilan
    yaratiladi va foydalanuvchi kirgan zahoti parolni almashtiradi.
    Uni doimiy parol sifatida qoldirmang.

    Himoya `login_attempts` bloklashiga tayanadi (5 urinish → 15 daqiqa).

    Birinchi raqam ham tasodifiy — "0" bilan boshlanadigan parollar ham
    chiqadi va bu ataylab: birinchi raqamni cheklash variantlar sonini
    kamaytirardi.
    """
    return generate_numeric_code(INITIAL_PASSWORD_DIGITS)


def validate_new_password(password: str) -> None:
    """Foydalanuvchi o'zi tanlagan parolni tekshiradi.

    Faqat uzunlik: murakkablik talablari (katta harf, belgi) odamlarni
    `Parol1!` yozishga majbur qiladi va amalda kuch qo'shmaydi.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"Parol kamida {MIN_PASSWORD_LENGTH} belgidan iborat boʻlishi kerak.")
    if password.isdigit():
        raise ValidationError("Parol faqat raqamlardan iborat boʻlmasin.")
