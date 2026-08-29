"""Foydalanuvchi, rol, sessiya va kirish jurnali (T-003, T-004).

TZ: AUT-01, AUT-04, AUT-05, AUT-06, AUT-07.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import INET, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AppendOnly, Base, Entity, UUIDPk


class RoleName(str, enum.Enum):
    STUDENT = "student"
    PARENT = "parent"
    TEACHER = "teacher"
    HOMEROOM_TEACHER = "homeroom_teacher"
    ADMIN = "admin"
    DIRECTOR = "director"
    SUPERADMIN = "superadmin"


class Role(Base, UUIDPk):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(200), default="")


class User(Entity):
    """AUT-07: foydalanuvchi oʻchirilmaydi, faqat faolsizlantiriladi/arxivlanadi."""

    __tablename__ = "users"

    # Login identifikatori. Faqat raqamlar, +998 bilan normallashtiriladi.
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(80), nullable=True)

    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    telegram_id: Mapped[int | None] = mapped_column(nullable=True, index=True)

    is_active: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    # Parol majburiy almashtirilishi kerakmi (hisob admin tomonidan yaratilganda).
    must_change_password: Mapped[bool] = mapped_column(
        default=False, server_default="false", nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    roles: Mapped[list[Role]] = relationship(
        secondary="user_roles", lazy="selectin", order_by=Role.name
    )

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name, self.middle_name or ""]
        return " ".join(p for p in parts if p).strip()

    @property
    def short_name(self) -> str:
        """"Aliyev S." koʻrinishi — jadval ustunlariga sigʻishi uchun."""
        initial = f"{self.first_name[0]}." if self.first_name else ""
        return f"{self.last_name} {initial}".strip()

    @property
    def role_names(self) -> list[str]:
        return [r.name for r in self.roles]


class UserRole(Base):
    """AUT-04: bir foydalanuvchi bir nechta rolga ega boʻlishi mumkin."""

    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )


class RefreshToken(Base, UUIDPk):
    """Refresh token sessiyasi — aylantirish va qayta ishlatishni aniqlash bilan.

    Token ochiq saqlanmaydi, faqat sha256 xeshi. Har yangilashda eski token
    bekor qilinadi va yangisi beriladi (rotation). Bekor qilingan token
    qaytadan kelsa — oʻgʻirlangan deb hisoblanadi va butun "oila" (family)
    bekor qilinadi, ya'ni oʻgʻri ham, egasi ham chiqarib yuboriladi.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        Index("ix_refresh_tokens_user_active", "user_id", "revoked_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Bitta qurilmadagi ketma-ket tokenlar bitta oilaga tegishli.
    family_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(String(40))

    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(INET)


class LoginAttempt(AppendOnly):
    """AUT-05: ketma-ket 5 marta notoʻgʻri parol → 15 daqiqa blok.

    Redis ishlatilmaydi (DECISIONS.md), shuning uchun hisoblash shu jadvaldan.
    """

    __tablename__ = "login_attempts"
    __table_args__ = (Index("ix_login_attempts_phone_time", "phone", "created_at"),)

    # Foydalanuvchi topilmasa ham yoziladi, shuning uchun user_id emas, phone.
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    successful: Mapped[bool] = mapped_column(nullable=False)
    ip_address: Mapped[str | None] = mapped_column(INET)


class LoginLog(AppendOnly):
    """AUT-06: har bir kirish urinishi (sana, IP, qurilma) jurnalga yoziladi."""

    __tablename__ = "login_log"
    __table_args__ = (Index("ix_login_log_user_time", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(255))
