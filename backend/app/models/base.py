"""Barcha modellarning asosi.

CLAUDE.md 1-qoida: hech narsa oʻchirilmaydi. Har bir jadvalda `is_archived`
va `archived_at`. `DELETE` yozilmaydi.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, MetaData, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.ids import uuid7

# Constraint nomlari oldindan belgilanadi — aks holda Alembic autogenerate
# har safar boshqa nom oʻylab topadi va migratsiya diff'i shovqinli boʻladi.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ArchivableMixin:
    is_archived: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False, index=True
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class UUIDPk:
    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, default=uuid7
    )


class Entity(Base, UUIDPk, TimestampMixin, ArchivableMixin):
    """Odatiy domen jadvali: UUIDv7 kalit, vaqt belgilari, arxivlanadi."""

    __abstract__ = True


class AppendOnly(Base, UUIDPk, TimestampMixin):
    """Faqat qoʻshiladigan jadval: audit, jurnal.

    `is_archived` ataylab yoʻq — bu yozuvlar oʻzgartirilmaydi ham,
    arxivlanmaydi ham (NFR-10).
    """

    __abstract__ = True
