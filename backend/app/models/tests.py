"""Testlar — savollar banki, test ishlash, avtomatik tekshiruv.

TZ: TST-01…TST-05.

Ikkita qaror modulni belgilaydi:

1. **Javob variantlari alohida jadvalda** (`test_options`), JSON emas.
   Sabab xavfsizlik: `is_correct` ustunini soʻrovga QOʻSHMASLIK bilan
   toʻgʻri javob oʻquvchiga umuman yuborilmaydi. JSON boʻlganda butun
   ustun kelardi va uni sxemada kesib tashlashga tayanishga toʻgʻri
   kelardi — bitta unutilgan joy butun testni ochib berardi.

2. **Urinish (`test_attempts`) — oʻzi hisob birligi.** Ball urinishda
   saqlanadi, testda emas: TST-03 boʻyicha bir necha urinish boʻlishi
   mumkin va har birining natijasi kerak.
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
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Entity


class TestStatus(enum.StrEnum):
    DRAFT = "draft"  # tuzilmoqda, oʻquvchiga koʻrinmaydi
    PUBLISHED = "published"  # eʼlon qilingan
    CLOSED = "closed"  # yakunlangan, yangi urinish qabul qilinmaydi


TEST_STATUS_LABELS_UZ: dict[str, str] = {
    TestStatus.DRAFT.value: "Qoralama",
    TestStatus.PUBLISHED.value: "Faol",
    TestStatus.CLOSED.value: "Yakunlangan",
}


class QuestionKind(enum.StrEnum):
    """TST-02: savol turlari."""

    SINGLE = "single"  # bitta toʻgʻri javob
    MULTIPLE = "multiple"  # bir nechta toʻgʻri javob


QUESTION_KIND_LABELS_UZ: dict[str, str] = {
    QuestionKind.SINGLE.value: "Bitta javob",
    QuestionKind.MULTIPLE.value: "Bir nechta javob",
}


class Test(Entity):
    """TST-03: test va uning parametrlari."""

    __tablename__ = "tests"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="test_duration_positive"),
        CheckConstraint("attempts_allowed > 0", name="test_attempts_positive"),
        CheckConstraint("closes_at > opens_at", name="test_window_ordered"),
        Index("ix_tests_class_status", "class_id", "status"),
        Index("ix_tests_teacher", "teacher_id", "status"),
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
    status: Mapped[str] = mapped_column(
        String(12), default=TestStatus.DRAFT.value, server_default="draft", nullable=False
    )

    duration_minutes: Mapped[int] = mapped_column(default=30, server_default="30", nullable=False)
    #: TST-03: har oʻquvchiga nechta urinish.
    attempts_allowed: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)
    #: TST-03: savollar tasodifiy tartibda chiqsinmi.
    shuffle: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)

    opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closes_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class TestQuestion(Entity):
    """TST-01, TST-02: savollar banki."""

    __tablename__ = "test_questions"
    __table_args__ = (Index("ix_test_questions_test", "test_id", "position"),)

    test_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("tests.id"), nullable=False
    )
    position: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(
        String(10), default=QuestionKind.SINGLE.value, server_default="single", nullable=False
    )
    points: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)

    options: Mapped[list["TestOption"]] = relationship(
        back_populates="question", order_by="TestOption.position"
    )


class TestOption(Entity):
    """Javob varianti.

    `is_correct` — oʻquvchiga hech qachon yuborilmaydi. Uni soʻrovga
    qoʻshmaslik bilan taʼminlanadi (`test_service._student_questions`).
    """

    __tablename__ = "test_options"
    __table_args__ = (Index("ix_test_options_question", "question_id", "position"),)

    question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("test_questions.id"), nullable=False
    )
    position: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)

    question: Mapped[TestQuestion] = relationship(back_populates="options")


class TestAttempt(Entity):
    """Oʻquvchining bitta urinishi (TST-04).

    Ball SHU YERDA: bir necha urinish boʻlishi mumkin va har birining
    natijasi kerak (TST-05 tahlili).
    """

    __tablename__ = "test_attempts"
    __table_args__ = (
        UniqueConstraint("test_id", "student_id", "attempt_no"),
        Index("ix_attempts_test_student", "test_id", "student_id"),
        CheckConstraint("score IS NULL OR score >= 0", name="attempt_score_non_negative"),
    )

    test_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("tests.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    attempt_no: Mapped[int] = mapped_column(default=1, server_default="1", nullable=False)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    score: Mapped[int | None] = mapped_column(nullable=True)
    max_score: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)


class TestAnswer(Entity):
    """Bitta savolga berilgan javob va avtomatik tekshiruv natijasi."""

    __tablename__ = "test_answers"
    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id"),
        Index("ix_test_answers_question", "question_id"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("test_attempts.id"), nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("test_questions.id"), nullable=False
    )
    #: Tanlangan variant id lari. Bitta savolda bir nechta boʻlishi
    #: mumkin (`multiple`), shuning uchun massiv — alohida jadval bu
    #: yerda ortiqcha boʻlardi.
    selected: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(PgUUID(as_uuid=True)), nullable=False, default=list
    )
    is_correct: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    points_awarded: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
