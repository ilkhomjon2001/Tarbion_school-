"""Dars jadvali va konkret darslar (T-011, T-012).

TZ: ADM-08, ADM-09.

Muhim: davomat va baho JADVALGA emas, DARSGA (`lessons`) bogʻlanadi.
Jadval keyin oʻzgarsa, oʻtgan darslar va ulardagi davomat oʻzgarmaydi.
"""

import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Entity
from app.models.school import SchoolClass, Subject


class ScheduleEntry(Entity):
    """ADM-08: sinf + fan + ustoz + hafta kuni + para + xona.

    ADM-09 (toʻqnashuv nazorati) qisman bazada kafolatlanadi: quyidagi ikki
    qisman-unique indeks bitta ustoz yoki bitta xonani ayni vaqtda ikki joyga
    qoʻyishga yoʻl qoʻymaydi. Servis qatlami bundan tashqari tushunarli
    xato matnini qaytaradi — lekin poyga holatida ham baza ushlab qoladi.
    """

    __tablename__ = "schedule_entries"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 1 AND 7", name="weekday_range"),
        CheckConstraint("period BETWEEN 1 AND 10", name="period_range"),
        Index(
            "uq_schedule_teacher_slot",
            "academic_year_id",
            "weekday",
            "period",
            "teacher_id",
            unique=True,
            postgresql_where="NOT is_archived",
        ),
        Index(
            "uq_schedule_room_slot",
            "academic_year_id",
            "weekday",
            "period",
            "room",
            unique=True,
            postgresql_where="NOT is_archived AND room IS NOT NULL",
        ),
        Index(
            "uq_schedule_class_slot",
            "academic_year_id",
            "weekday",
            "period",
            "class_id",
            unique=True,
            postgresql_where="NOT is_archived",
        ),
    )

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    weekday: Mapped[int] = mapped_column(nullable=False)  # 1=dushanba .. 7=yakshanba
    period: Mapped[int] = mapped_column(nullable=False)
    room: Mapped[str | None] = mapped_column(String(30))


class Lesson(Entity):
    """Jadval asosida konkret sanaga yaratilgan dars.

    `starts_at` / `ends_at` — UTC. Qoʻngʻiroqlar jadvalidagi mahalliy vaqt
    dars sanasi bilan birlashtirilib hisoblanadi (generatsiya paytida bir
    marta), keyin DAV-03 ning 24 soatlik oynasi shu `ends_at` dan sanaladi.
    """

    __tablename__ = "lessons"
    __table_args__ = (
        # Idempotent generatsiya: bitta sinf-sana-para uchun bitta FAOL
        # dars. Partial — arxivlangan (bekor qilingan jadvaldagi) dars
        # slotni band qilib turmaydi (Y4).
        Index(
            "uq_lessons_slot",
            "class_id",
            "lesson_date",
            "period",
            unique=True,
            postgresql_where=text("NOT is_archived"),
        ),
        Index("ix_lessons_teacher_date", "teacher_id", "lesson_date"),
        Index("ix_lessons_class_date", "class_id", "lesson_date"),
    )

    schedule_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("schedule_entries.id"), nullable=True
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    # ADM-10: ustozni vaqtincha almashtirish — jadvaldagi emas, shu yerdagi
    # ustoz haqiqiy dars beruvchi hisoblanadi.
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    lesson_date: Mapped[date] = mapped_column(Date, nullable=False)
    period: Mapped[int] = mapped_column(nullable=False)
    room: Mapped[str | None] = mapped_column(String(30))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    topic: Mapped[str | None] = mapped_column(String(200))

    # ── ADM-10: muayyan sanaga jadval istisnosi ──
    #
    # Bekor qilingan dars ARXIVLANMAYDI. Sabab: generatsiya
    # `is_archived = false` boʻyicha tekshiradi, arxivlangani esa slotni
    # boʻshatadi (Y4) va keyingi generatsiya darsni QAYTA yaratardi.
    # Shuning uchun dars joyida qoladi, faqat «bekor qilingan» deb
    # belgilanadi — davomat ham, baho ham olinmaydi.
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(String(300))

    #: Ustoz vaqtincha almashtirilganmi. `teacher_id` ning oʻzi jadvaldan
    #: farq qilishi bilan ham bilinardi, lekin jadval keyin oʻzgarsa bu
    #: taqqoslash yolgʻon gapira boshlaydi — shuning uchun aniq bayroq.
    is_substituted: Mapped[bool] = mapped_column(
        default=False, server_default="false", nullable=False
    )
    #: Almashtirish yoki koʻchirish izohi — jadvalda koʻrinadi.
    exception_note: Mapped[str | None] = mapped_column(String(300))

    @property
    def is_cancelled(self) -> bool:
        return self.cancelled_at is not None
    # Davomat belgilanganmi — ustoz bosh sahifasida "22/25 belgilangan"
    # koʻrsatish uchun. Har safar COUNT qilmaslik uchun shu yerda saqlanadi.
    attendance_marked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    school_class: Mapped[SchoolClass] = relationship(lazy="joined")
    subject: Mapped[Subject] = relationship(lazy="joined")

    def teacher_can_edit_attendance(self, now: datetime, window_hours: int) -> bool:
        """DAV-03: dars TUGAGANIDAN keyin 24 soat davomida ustoz tahrirlaydi."""
        return (now - self.ends_at).total_seconds() <= window_hours * 3600


class BellTimeRef:
    """Qoʻngʻiroq vaqtini dars sanasi bilan birlashtirish uchun yordamchi."""

    __slots__ = ("period", "starts_at", "ends_at")

    def __init__(self, period: int, starts_at: time, ends_at: time) -> None:
        self.period = period
        self.starts_at = starts_at
        self.ends_at = ends_at
