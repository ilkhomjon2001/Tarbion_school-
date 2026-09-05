"""Audit jurnali (T-021). TZ: NFR-10, DAV-07, JUR-07.

Yozuvlar oʻzgartirilmaydi va oʻchirilmaydi — `AppendOnly` dan meros oladi,
`is_archived` ham yoʻq. Bazada UPDATE/DELETE ni toʻsish uchun migratsiyada
qoʻshimcha trigger qoʻyiladi.
"""

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AppendOnly


class AuditAction:
    CREATE = "create"
    UPDATE = "update"
    ARCHIVE = "archive"
    UNARCHIVE = "unarchive"
    LOGIN = "login"
    LOGOUT = "logout"


class AuditLog(AppendOnly):
    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_object", "object_type", "object_id", "created_at"),
        Index("ix_audit_actor", "actor_id", "created_at"),
    )

    object_type: Mapped[str] = mapped_column(String(50), nullable=False)
    object_id: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)

    # Eski va yangi qiymat — faqat oʻzgargan maydonlar, butun obyekt emas.
    old_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    new_value: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    ip_address: Mapped[str | None] = mapped_column(INET)
