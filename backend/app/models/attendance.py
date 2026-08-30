"""Davomat (T-013). TZ: DAV-01, DAV-03, DAV-06, DAV-07."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class AttendanceStatus(enum.StrEnum):
    """DAV-01: keldi, kelmadi, sababli, kechikdi."""

    PRESENT = "present"
    ABSENT = "absent"
    EXCUSED = "excused"
    LATE = "late"


# Interfeys matnlari — bitta manba, frontend shu kodlarni oladi.
ATTENDANCE_LABELS_UZ: dict[str, str] = {
    AttendanceStatus.PRESENT.value: "Keldi",
    AttendanceStatus.ABSENT.value: "Kelmadi",
    AttendanceStatus.EXCUSED.value: "Sababli",
    AttendanceStatus.LATE.value: "Kechikdi",
}


class AttendanceRecord(Entity):
    __tablename__ = "attendance_records"
    __table_args__ = (
        # Bitta darsda bitta oʻquvchi bitta yozuv.
        UniqueConstraint("lesson_id", "student_id"),
        # DAV-06: foiz hisoblash oʻquvchi va sana kesimida — shu indeks
        # hisobotlarni jadval skanersiz bajaradi.
        Index("ix_attendance_student_status", "student_id", "status"),
        Index("ix_attendance_lesson", "lesson_id"),
    )

    lesson_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    note: Mapped[str | None] = mapped_column(String(300))

    # Kim va qachon belgilagani — audit yozuvidan tashqari, tez koʻrsatish uchun.
    marked_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    marked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
