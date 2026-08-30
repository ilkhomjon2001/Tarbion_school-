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
from app.core.timeutil import utcnow

# argon2id, OWASP tavsiya etgan minimumdan yuqori parametrlar.
# 64 MiB xotira / 3 iteratsiya — VPS uchun ~50-80ms, brute-force uchun qimmat.
_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2, hash_len=32)

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


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
