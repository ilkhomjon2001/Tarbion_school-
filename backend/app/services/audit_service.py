"""Audit yozuvi (NFR-10, DAV-07, JUR-07).

Baho, davomat va hisob oʻzgarishlarining har biri shu yerdan oʻtadi.
Yozuv commit qilinmaydi — chaqiruvchi tranzaksiyaning bir qismi boʻladi,
shunda "oʻzgarish saqlandi, audit yozilmadi" holati boʻlmaydi.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

# Auditda hech qachon chiqmasligi kerak boʻlgan maydonlar.
_REDACTED = {"password", "password_hash", "token", "token_hash", "secret"}


def _clean(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not payload:
        return None
    return {
        k: ("***" if k in _REDACTED else _jsonable(v))
        for k, v in payload.items()
    }


def _jsonable(value: Any) -> Any:
    """JSONB ga tushadigan koʻrinishga keltiradi."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def record(
    session: AsyncSession,
    *,
    object_type: str,
    action: str,
    object_id: uuid.UUID | None = None,
    old: dict[str, Any] | None = None,
    new: dict[str, Any] | None = None,
    actor_id: uuid.UUID | None = None,
    ip: str | None = None,
) -> None:
    """Audit yozuvini sessiyaga qoʻshadi (flush/commit chaqiruvchida)."""
    session.add(
        AuditLog(
            object_type=object_type,
            object_id=object_id,
            action=action,
            old_value=_clean(old),
            new_value=_clean(new),
            actor_id=actor_id,
            ip_address=ip,
        )
    )


def diff(before: dict[str, Any], after: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Faqat oʻzgargan maydonlarni qaytaradi.

    Butun obyektni yozish audit jadvalini keraksiz shishiradi va "nima
    oʻzgardi" degan savolga javob berishni qiyinlashtiradi.
    """
    changed = [k for k in after if before.get(k) != after[k]]
    return {k: before.get(k) for k in changed}, {k: after[k] for k in changed}
