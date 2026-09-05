"""Sababli qoldirish arizasi (DAV-04).

TZ: «Vasiy sababli qoldirish uchun ariza yuboradi (matn va fayl).
Sinf rahbari tasdiqlaydi yoki rad etadi.»

Ariza OʻCHIRILMAYDI va tahrirlanmaydi — u davomat oʻzgarishining
asosi. Vasiy fikridan qaytsa arizani bekor qiladi, yozuv esa qoladi
(CLAUDE.md 1-qoida): «nega bu kun sababli boʻlib qoldi» savoliga
javob shu yerda turishi kerak.
"""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class AbsenceStatus(enum.StrEnum):
    PENDING = "kutilmoqda"
    APPROVED = "tasdiqlangan"
    REJECTED = "rad_etilgan"
    CANCELLED = "bekor_qilingan"


ABSENCE_STATUS_LABELS_UZ: dict[str, str] = {
    AbsenceStatus.PENDING.value: "Koʻrib chiqilmoqda",
    AbsenceStatus.APPROVED.value: "Tasdiqlangan",
    AbsenceStatus.REJECTED.value: "Rad etilgan",
    AbsenceStatus.CANCELLED.value: "Bekor qilingan",
}


class AbsenceRequest(Entity):
    __tablename__ = "absence_requests"
    __table_args__ = (
        Index("ix_absence_student_range", "student_id", "date_from", "date_to"),
        Index("ix_absence_status", "status", "created_at"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    #: Arizani kim yozgan — vasiy yoki uning nomidan administrator.
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

    #: Ilova — spravka surati yoki PDF. Majburiy emas (TZ «matn va
    #: fayl» deydi, faylsiz ariza ham qabul qilinadi).
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("stored_files.id"), nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(16),
        default=AbsenceStatus.PENDING.value,
        server_default=AbsenceStatus.PENDING.value,
        nullable=False,
    )
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Rad etilganda sabab MAJBURIY — «rad etildi» oʻzi javob emas.
    decision_note: Mapped[str | None] = mapped_column(String(500))

    #: Tasdiqlanganda nechta dars «sababli» ga oʻtdi — hisobot uchun.
    marked_lessons: Mapped[int] = mapped_column(
        default=0, server_default="0", nullable=False
    )
