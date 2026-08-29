"""Oʻquv yili, choraklar, taʼtillar, qoʻngʻiroqlar jadvali (T-007).

TZ: ADM-01, ADM-07.
"""

import uuid
from datetime import date, time

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class AcademicYear(Entity):
    __tablename__ = "academic_years"
    __table_args__ = (
        CheckConstraint("ends_on > starts_on", name="year_dates_ordered"),
        # Faqat bitta oʻquv yili "joriy" boʻla oladi (T-007 qabul mezoni).
        Index(
            "uq_academic_years_single_current",
            "is_current",
            unique=True,
            postgresql_where="is_current",
        ),
    )

    name: Mapped[str] = mapped_column(String(20), nullable=False)  # "2026-2027"
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    is_current: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)


class Term(Entity):
    """Chorak."""

    __tablename__ = "terms"
    __table_args__ = (
        CheckConstraint("ends_on > starts_on", name="term_dates_ordered"),
        UniqueConstraint("academic_year_id", "index"),
        # Choraklar sanasi bir-birini qoplamaydi — bazada kafolatlanadi,
        # servisdagi tekshiruvga tayanib qolinmaydi.
        Index("ix_terms_year_range", "academic_year_id", "starts_on", "ends_on"),
    )

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    index: Mapped[int] = mapped_column(nullable=False)  # 1..4
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)


class Holiday(Entity):
    """Taʼtil yoki bayram — bu kunlarda dars generatsiya qilinmaydi (T-012)."""

    __tablename__ = "holidays"
    __table_args__ = (UniqueConstraint("academic_year_id", "day"),)

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)


class BellSchedule(Entity):
    """ADM-07: para raqami, boshlanish va tugash vaqti.

    Vaqt mahalliy (Asia/Tashkent) saqlanadi — bu kun ichidagi jadval, sana
    emas. UTC ga oʻgirish `timeutil.combine_local` orqali dars sanasi bilan
    birga qilinadi.
    """

    __tablename__ = "bell_schedule"
    __table_args__ = (
        UniqueConstraint("academic_year_id", "period"),
        CheckConstraint("ends_at > starts_at", name="bell_times_ordered"),
    )

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    period: Mapped[int] = mapped_column(nullable=False)  # 1..8
    starts_at: Mapped[time] = mapped_column(Time, nullable=False)
    ends_at: Mapped[time] = mapped_column(Time, nullable=False)
