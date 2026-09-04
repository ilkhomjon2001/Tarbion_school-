"""Sinf, fan, oʻquvchi, vasiy va biriktirishlar (T-008, T-009).

TZ: ADM-02..ADM-06, ADM-11, AUT-03.
"""

import enum
import uuid
from datetime import date

from sqlalchemy import (
    Date,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Entity


class GuardianRelation(enum.StrEnum):
    FATHER = "father"
    MOTHER = "mother"
    GUARDIAN = "guardian"


class Subject(Entity):
    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    short_name: Mapped[str] = mapped_column(String(20), default="")


class SchoolClass(Entity):
    """Sinf. Jadval nomi `classes` — `class` Python'da kalit soʻz."""

    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("academic_year_id", "name"),)

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(20), nullable=False)  # "11-A"
    #: Sinfning atamasi — «Al-Xorazmiy», «Mirzo Ulugʻbek».
    #:
    #: `name` dan alohida, chunki ikkisi ikki ish qiladi: `name` — sinfning
    #: bir maʼnoli belgisi (oʻquv yili ichida unikal, katta harfda,
    #: jadvalda va hisobotlarda shu ishlatiladi), `title` — maktab bergan
    #: nom. Atama almashishi mumkin, sinfning oʻzi esa oʻsha-oʻsha qoladi.
    title: Mapped[str | None] = mapped_column(String(80))
    homeroom_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )


class ClassSubject(Entity):
    """Sinfda oʻqitiladigan fan va haftalik soati (ADM-03)."""

    __tablename__ = "class_subjects"
    __table_args__ = (UniqueConstraint("class_id", "subject_id"),)

    class_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    weekly_hours: Mapped[int] = mapped_column(default=1, nullable=False)


class TeacherSubject(Entity):
    """Ustoz qaysi fanni oʻqitishi (ADM-04)."""

    __tablename__ = "teacher_subjects"
    __table_args__ = (UniqueConstraint("teacher_id", "subject_id"),)

    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )


class Student(Entity):
    """ADM-05. Arxivlangan oʻquvchi roʻyxatlarda koʻrinmaydi, hisobotda qoladi."""

    __tablename__ = "students"
    __table_args__ = (
        Index("ix_students_class_active", "class_id", "is_archived"),
        # Takroriy oʻquvchini aniqlash uchun (T-010 import tekshiruvi).
        Index("ix_students_identity", "last_name", "first_name", "birth_date"),
    )

    # Oʻquvchining oʻz hisobi. 1-bosqichda majburiy emas — oʻquvchi kabineti
    # 2-bosqichda (T-034), lekin bogʻlanish hozirdan bor, keyin migratsiya
    # qayta yozilmasin.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, unique=True
    )
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("classes.id"), nullable=True
    )

    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(80))
    birth_date: Mapped[date | None] = mapped_column(Date)

    #: Oldingi oʻqigan joyi — koʻchib kelgan oʻquvchi uchun. 0 va
    #: 1-sinfda boʻsh qoladi: ular birinchi marta maktabga kelgan.
    previous_school: Mapped[str | None] = mapped_column(String(200))

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name, self.middle_name or ""]
        return " ".join(p for p in parts if p).strip()


class Guardian(Entity):
    """AUT-03: bir vasiyda bir nechta farzand, bir oʻquvchida bir nechta vasiy.

    Bu jadval 6-domen qoidasining manbai: ota-ona faqat shu yerdagi
    bogʻlanish orqali koʻrinadigan oʻquvchilarni koʻra oladi.
    """

    __tablename__ = "guardians"
    __table_args__ = (
        UniqueConstraint("student_id", "user_id"),
        Index("ix_guardians_user", "user_id", "is_archived"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    relation: Mapped[str] = mapped_column(String(20), nullable=False)
    # Asosiy vasiy — xabarnoma birinchi navbatda shunga ketadi.
    is_primary: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)

    student: Mapped[Student] = relationship(lazy="joined")


class CafeteriaMenuItem(Entity):
    """Oshxona haftalik menyusi — bitta qator = bitta taom (OTA-08).

    Haftalik shablon (jadvalga oʻxshash): hafta kuni + tartib + taom.
    Yangi hafta yozilganda eski qatorlar arxivlanadi — tarix qoladi
    (CLAUDE.md 1-qoida).
    """

    __tablename__ = "cafeteria_menu_items"
    __table_args__ = (Index("ix_cafeteria_menu_day", "weekday", "is_archived"),)

    #: 1 = dushanba … 7 = yakshanba.
    weekday: Mapped[int] = mapped_column(nullable=False)
    position: Mapped[int] = mapped_column(nullable=False, default=0)
    dish: Mapped[str] = mapped_column(String(120), nullable=False)


class SchoolSettings(Entity):
    """Maktab rekvizitlari — bitta qator (singleton).

    Kvitansiya sarlavhasi, hujjat shablonlari va sozlamalar ekrani shu
    yerdan oladi. Tarix uchun eski qator arxivlanadi, yangisi yoziladi.
    """

    __tablename__ = "school_settings"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    address: Mapped[str] = mapped_column(
        String(200), default="", server_default="", nullable=False
    )
    phone: Mapped[str] = mapped_column(
        String(40), default="", server_default="", nullable=False
    )
    director_name: Mapped[str] = mapped_column(
        String(120), default="", server_default="", nullable=False
    )

    # ── Bank rekvizitlari ──
    #
    # Shartnomaning 5-bandida («Yakuniy rekvizitlar») turadi va
    # kvitansiyada ham chiqishi kerak: ota-ona pulni qayerga
    # oʻtkazishini shu yerdan koʻradi. Ilgari ular faqat qogʻozda edi
    # va tizim shartnoma chiqara olmasdi.
    #
    # Hammasi matn: ИНН va MFO raqamga oʻxshaydi, lekin ular
    # identifikator — bosh nolni yoʻqotmasin («00450»).
    tax_id: Mapped[str] = mapped_column(
        String(20), default="", server_default="", nullable=False
    )
    bank_account: Mapped[str] = mapped_column(
        String(30), default="", server_default="", nullable=False
    )
    bank_code: Mapped[str] = mapped_column(
        String(10), default="", server_default="", nullable=False
    )
    bank_name: Mapped[str] = mapped_column(
        String(120), default="", server_default="", nullable=False
    )

    #: DAV-05: davomat belgilangandan keyin vasiyga xabar qancha
    #: kechikib ketadi. Sukut boʻyicha 30 daqiqa — TZ talabi.
    #:
    #: Kechikish ATAYLAB bor: ustoz darsning boshida «kelmadi» deb
    #: belgilab, keyin kech qolgan bolani «keldi» ga tuzatadi. Xabar
    #: darhol ketsa, ota-ona bolasi sinfda oʻtirganida «kelmadi» degan
    #: xabar olardi va tizimga ishonchi yoʻqolardi.
    attendance_notify_delay_minutes: Mapped[int] = mapped_column(
        default=30, server_default="30", nullable=False
    )
