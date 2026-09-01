"""Imtihonlar va dars rejalari — oʻquv boʻlimi moduli.

Imtihon jurnal bahosidan alohida turadi: u alohida oʻtkaziladigan
nazorat (oylik, chorak, yakuniy, sinov) va 0–100 ballda baholanadi.
Jurnal baholariga aralashmaydi — chorak bahosi qanday chiqarilishi
alohida qaror (T-031).

Dars rejasi — ustoz topshiradigan tematik reja ustidan oʻquv
boʻlimining nazorati: topshirildi → tasdiqlandi / qaytarildi.
"""

import enum
import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class ExamKind(enum.StrEnum):
    OYLIK = "oylik"
    CHORAK = "chorak"
    YAKUNIY = "yakuniy"
    SINOV = "sinov"


EXAM_KIND_LABELS_UZ: dict[str, str] = {
    ExamKind.OYLIK.value: "Oylik nazorat",
    ExamKind.CHORAK.value: "Chorak imtihoni",
    ExamKind.YAKUNIY.value: "Yakuniy imtihon",
    ExamKind.SINOV.value: "Sinov imtihoni",
}


class ExamStatus(enum.StrEnum):
    REJADA = "rejada"
    OTKAZILDI = "otkazildi"
    BEKOR = "bekor"


EXAM_STATUS_LABELS_UZ: dict[str, str] = {
    ExamStatus.REJADA.value: "Rejada",
    ExamStatus.OTKAZILDI.value: "Oʻtkazildi",
    ExamStatus.BEKOR.value: "Bekor qilindi",
}


class Exam(Entity):
    __tablename__ = "exams"
    __table_args__ = (Index("ix_exams_date", "exam_date"),)

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ExamStatus.REJADA.value
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class ExamResult(Entity):
    """0–100 ball. Kelmagan oʻquvchida `absent=True` va ball yoʻq."""

    __tablename__ = "exam_results"
    __table_args__ = (UniqueConstraint("exam_id", "student_id"),)

    exam_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    score: Mapped[int | None] = mapped_column()
    absent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class PlanStatus(enum.StrEnum):
    TOPSHIRILDI = "topshirildi"
    TASDIQLANDI = "tasdiqlandi"
    QAYTARILDI = "qaytarildi"


PLAN_STATUS_LABELS_UZ: dict[str, str] = {
    PlanStatus.TOPSHIRILDI.value: "Topshirildi",
    PlanStatus.TASDIQLANDI.value: "Tasdiqlandi",
    PlanStatus.QAYTARILDI.value: "Qaytarildi",
}


class LessonPlan(Entity):
    """Ustozning tematik rejasi ustidan nazorat yozuvi.

    Rejaning oʻzi hozircha qogʻoz/faylda — bu yozuv holatni kuzatadi.
    Fayl biriktirish R2 moduli bilan keladi.
    """

    __tablename__ = "lesson_plans"
    __table_args__ = (
        # Bitta ustoz-fan-sinf-davr uchun bitta yozuv.
        UniqueConstraint("teacher_id", "subject_id", "class_id", "period"),
    )

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    #: «1-chorak», «2026-2027 yillik» — matn, chunki davr shakli maktabniki.
    period: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=PlanStatus.TOPSHIRILDI.value
    )
    #: Qaytarilganda sabab shu yerda.
    comment: Mapped[str | None] = mapped_column(String(300))
