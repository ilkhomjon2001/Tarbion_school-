"""Uy vazifasi va baholash (T-032, T-033).

TZ: UYV-01..UYV-07, JUR-02, JUR-03, JUR-07.

Eslatma: TASKS.md boʻyicha bu 2-bosqich. Loyiha egasining soʻroviga koʻra
ustoz paneli bilan birga erta qilindi (docs/DECISIONS.md ga qara).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Entity
from app.models.school import Student


class SubmissionStatus(enum.StrEnum):
    ASSIGNED = "assigned"  # berilgan, hali topshirilmagan
    SUBMITTED = "submitted"  # topshirilgan, tekshirilmagan
    LATE = "late"  # UYV-04: muddatdan keyin topshirilgan
    GRADED = "graded"  # baholangan
    RETURNED = "returned"  # UYV-03: qayta ishlash uchun qaytarilgan


SUBMISSION_LABELS_UZ: dict[str, str] = {
    SubmissionStatus.ASSIGNED.value: "Topshirilmagan",
    SubmissionStatus.SUBMITTED.value: "Tekshirilmagan",
    SubmissionStatus.LATE.value: "Kechikkan",
    SubmissionStatus.GRADED.value: "Baholangan",
    SubmissionStatus.RETURNED.value: "Qaytarilgan",
}


class GradeKind(enum.StrEnum):
    """JUR-03: baho turlari. Har birining vazni sozlanadi."""

    CURRENT = "current"  # joriy
    CONTROL = "control"  # nazorat ishi
    TERM = "term"  # chorak
    ANNUAL = "annual"  # yillik


class GradingScale(enum.StrEnum):
    """JUR-02: baholash tizimi sozlanadi — 5 ballik yoki 100 ballik."""

    FIVE = "five"
    HUNDRED = "hundred"


SCALE_MAX: dict[str, int] = {GradingScale.FIVE.value: 5, GradingScale.HUNDRED.value: 100}


class Homework(Entity):
    """UYV-01: ustoz uy vazifasini beradi — matn, ilova fayl, muddat."""

    __tablename__ = "homework"
    __table_args__ = (
        Index("ix_homework_teacher_due", "teacher_id", "due_at"),
        Index("ix_homework_class_due", "class_id", "due_at"),
    )

    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("lessons.id"), nullable=True
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # UYV-04: muddatdan keyin topshirishga ruxsat beriladimi.
    allow_late: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)

    # JUR-02: shu vazifa uchun baholash shkalasi va maksimal ball.
    grading_scale: Mapped[str] = mapped_column(
        String(10), default=GradingScale.FIVE.value, server_default="five", nullable=False
    )
    max_score: Mapped[int] = mapped_column(default=5, server_default="5", nullable=False)
    # JUR-03: chorak bahosini hisoblashdagi vazni.
    weight: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)

    # CLAUDE.md 10-qoida: fayl bazada saqlanmaydi, faqat R2 kaliti.
    attachment_key: Mapped[str | None] = mapped_column(String(300))
    attachment_name: Mapped[str | None] = mapped_column(String(200))


class HomeworkSubmission(Entity):
    """UYV-02: oʻquvchi topshiradi. UYV-03: ustoz baholaydi yoki qaytaradi.

    Vazifa berilganda har bir oʻquvchi uchun bitta yozuv yaratiladi
    (status=assigned) — shunda "kim topshirmadi" soʻrovi LEFT JOIN'siz
    ishlaydi va UYV-05 xabarnomasi oson topiladi.
    """

    __tablename__ = "homework_submissions"
    __table_args__ = (
        UniqueConstraint("homework_id", "student_id"),
        # UYV-06: "tekshirilmagan ishlar", eng eskisidan boshlab.
        Index("ix_submissions_status_time", "status", "submitted_at"),
        Index("ix_submissions_student", "student_id", "status"),
        CheckConstraint("score IS NULL OR score >= 0", name="score_non_negative"),
    )

    homework_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("homework.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(12),
        default=SubmissionStatus.ASSIGNED.value,
        server_default="assigned",
        nullable=False,
    )
    answer_text: Mapped[str | None] = mapped_column(Text)
    attachment_key: Mapped[str | None] = mapped_column(String(300))
    attachment_name: Mapped[str | None] = mapped_column(String(200))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- Baholash ---
    score: Mapped[int | None] = mapped_column(nullable=True)
    teacher_comment: Mapped[str | None] = mapped_column(Text)
    graded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    student: Mapped[Student] = relationship(lazy="joined")


class Grade(Entity):
    """JUR-01: elektron jurnal bahosi — sinf × fan × sana kesimida.

    Uy vazifasi bahosi ham shu yerga tushadi (`submission_id` toʻldiriladi),
    shunda chorak bahosi (JUR-04) bitta manbadan hisoblanadi.
    """

    __tablename__ = "grades"
    __table_args__ = (
        Index("ix_grades_student_subject", "student_id", "subject_id", "created_at"),
        Index("ix_grades_lesson", "lesson_id"),
        CheckConstraint("value >= 0", name="grade_non_negative"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("lessons.id"), nullable=True
    )
    submission_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("homework_submissions.id"), nullable=True, unique=True
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    kind: Mapped[str] = mapped_column(
        String(10), default=GradeKind.CURRENT.value, server_default="current", nullable=False
    )
    value: Mapped[int] = mapped_column(nullable=False)
    max_value: Mapped[int] = mapped_column(default=5, server_default="5", nullable=False)
    weight: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    comment: Mapped[str | None] = mapped_column(String(300))
