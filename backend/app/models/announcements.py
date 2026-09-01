"""Eʼlonlar (T-020, ADM-12).

Eʼlon — bir tomonlama xabar: maktab yoki ustoz oilalarga eʼlon beradi,
javob kutilmaydi (javob kerak boʻlsa murojaat bor).

Auditoriya uch xil:

  school  — butun maktab. Faqat `announcements.publish` huquqi borga.
  class   — bitta sinf. Ustoz oʻzi dars beradigan yoki rahbarlik
            qiladigan sinfiga bera oladi.
  subject — ustozning fani: u shu fandan dars beradigan BARCHA sinflar.

`subject` auditoriyasi eʼlon berilgan PAYTDA sinflarga yoyiladi va
`announcement_classes` ga yoziladi. Sabab: jadval oʻzgaruvchan — ustoz
keyinchalik boshqa sinfga oʻtsa, eski eʼlon «koʻchib» yurmasligi kerak.
Kim koʻrishi eʼlon berilgan paytda qatʼiylashadi, xuddi qogʻozdagi
eʼlon taxtasidagi kabi.
"""

import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class AnnouncementAudience(enum.StrEnum):
    SCHOOL = "school"
    CLASS = "class"
    SUBJECT = "subject"


class Announcement(Entity):
    __tablename__ = "announcements"
    __table_args__ = (
        # Roʻyxat har doim yangisidan boshlanadi.
        Index("ix_announcements_created", "created_at"),
    )

    author_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    audience: Mapped[str] = mapped_column(String(16), nullable=False)
    #: `subject` auditoriyasida qaysi fan tanlangani — koʻrsatish uchun.
    #: Haqiqiy qamrov `announcement_classes` da.
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id")
    )

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(4000), nullable=False)
    important: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    #: Eʼlon berilgan paytda nechta odamga (vasiy + oʻquvchi hisobi)
    #: yetkazilgani. ADM-12: yuborishdan oldin koʻrsatiladi, yuborilgach
    #: shu yerda qoladi.
    recipients_count: Mapped[int] = mapped_column(default=0, nullable=False)


class AnnouncementClass(Entity):
    """Eʼlon qamrab olgan sinflar — eʼlon berilgan paytdagi holat."""

    __tablename__ = "announcement_classes"
    __table_args__ = (
        UniqueConstraint("announcement_id", "class_id"),
        Index("ix_announcement_classes_class", "class_id"),
    )

    announcement_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("announcements.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
