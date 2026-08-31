"""Murojaatlar va yozishmalar (T-025). TZ: MUR-01…MUR-06.

Uch xil foydalanuvchi bitta jadvalni koʻradi, lekin HAR XIL kesimda:

    ota-ona   → faqat oʻzi yozgan murojaatlar
    ustoz     → faqat oʻziga biriktirilganlari
    admin/direktor → hammasi

Shu sabab kirish nazorati `services/appeals_service.py` da, soʻrov
darajasida (`WHERE author_id = ...`) — ro'yxatni olib, keyin filtrlash
emas. CLAUDE.md 6-qoida.

TZ'da murojaat "mavzuga qarab masʼulga yoʻnaltiriladi" deyilgan; loyiha
egasining soʻroviga koʻra ota-ona toʻgʻridan-toʻgʻri KIMGA yozishini
tanlaydi (`AppealTarget`).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class AppealTarget(enum.StrEnum):
    """Murojaat kimga yoʻnaltirilgan."""

    MANAGEMENT = "management"
    HOMEROOM = "homeroom"
    SUBJECT_TEACHER = "subject_teacher"


APPEAL_TARGET_LABELS_UZ: dict[str, str] = {
    AppealTarget.MANAGEMENT.value: "Rahbariyat",
    AppealTarget.HOMEROOM.value: "Sinf rahbari",
    AppealTarget.SUBJECT_TEACHER.value: "Fan oʻqituvchisi",
}


class AppealStatus(enum.StrEnum):
    NEW = "new"
    IN_REVIEW = "in_review"
    ANSWERED = "answered"
    CLOSED = "closed"


APPEAL_STATUS_LABELS_UZ: dict[str, str] = {
    AppealStatus.NEW.value: "Yangi",
    AppealStatus.IN_REVIEW.value: "Koʻrib chiqilmoqda",
    AppealStatus.ANSWERED.value: "Javob berildi",
    AppealStatus.CLOSED.value: "Yopilgan",
}


class ContactKind(enum.StrEnum):
    """Administratorning ichki suhbat qaydi turi (ADM-16)."""

    PHONE = "phone"
    IN_PERSON = "in_person"
    ONLINE = "online"


CONTACT_KIND_LABELS_UZ: dict[str, str] = {
    ContactKind.PHONE.value: "Telefon",
    ContactKind.IN_PERSON.value: "Yuzma-yuz",
    ContactKind.ONLINE.value: "Onlayn",
}


class Appeal(Entity):
    """Maktab va oila oʻrtasidagi bitta yozishma.

    Ikki yoʻl bilan boshlanadi:

      · ota-ona yozadi (MUR-01) — odatiy holat;
      · maktab birinchi boʻlib yozadi (ADM-16) — administrator telefon
        suhbatini qayd qiladi yoki oʻzi savol beradi.

    Ikkinchi holatda ham `author_id` OTA-ONA boʻlib qoladi: yozishma
    oilaga tegishli, ota-ona uni oʻz kabinetida koʻradi va javob yozadi.
    Kim ochgani `created_by_id` da — bu ikkisi aralashtirilsa,
    «maktab ota-ona nomidan gapirdi» degan yozuv paydo boʻlardi.
    """

    __tablename__ = "appeals"
    __table_args__ = (
        # Ustoz/direktor kabineti: «menga kelgan ochiq murojaatlar».
        Index("ix_appeals_assignee_status", "assignee_id", "status"),
        # Ota-ona kabineti: «mening murojaatlarim, oxirgisi tepada».
        Index("ix_appeals_author_activity", "author_id", "last_message_at"),
        # MUR-04: muddati oʻtayotganlarni topish.
        Index("ix_appeals_status_due", "status", "due_at"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    # Yozishmaning OILA tomoni (vasiy hisobi). Vasiy hisobi arxivlansa ham
    # murojaat qoladi — yozishma tarixi hisobotda kerak.
    author_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    # Yozishmani kim ochgan. `NULL` — ota-ona oʻzi ochgan (odatiy holat).
    # Toʻldirilgan boʻlsa — maktab xodimi ochgan, va bu faktni yashirmaymiz:
    # ota-ona kabinetida «Maktab boshladi» deb koʻrsatiladi.
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    target: Mapped[str] = mapped_column(String(20), nullable=False)
    # Masʼul xodim. `NULL` boʻlishi mumkin: rahbariyatga kelgan murojaat
    # hali kimgadir biriktirilmagan boʻlishi mumkin — u holda uni
    # administrator taqsimlaydi.
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # Faqat `subject_teacher` uchun toʻldiriladi.
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default=AppealStatus.NEW.value, server_default="new", nullable=False
    )

    # MUR-04: MAKTAB javob berish muddati. Ota-ona savol berganda
    # qoʻyiladi va keyin oʻzgarmaydi — aks holda "muddati oʻtdi" hisoboti
    # maʼnosini yoʻqotardi.
    #
    # Maktab oʻzi boshlagan yozishmada `NULL`: maktabning oʻz savoliga
    # javob berish muddati boʻlmaydi. Ota-ona javob yozgan payt muddat
    # qoʻyiladi (`add_message`).
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Oxirgi xabar vaqti — denormalizatsiya. Roʻyxatni faollik boʻyicha
    # saralash uchun har safar `appeal_messages` ga subquery urish kerak
    # boʻlardi; kirish qutisi eng koʻp ochiladigan ekran, shuning uchun
    # bu ustun ataylab saqlanadi.
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )


class AppealMessage(Entity):
    """Yozishmadagi bitta xabar.

    `Entity` (arxivlanadigan), `AppendOnly` emas: haqoratli xabarni
    administrator yashira olishi kerak. Yashirish ≠ oʻchirish — yozuv
    bazada qoladi va `audit_log` ga tushadi.
    """

    __tablename__ = "appeal_messages"
    __table_args__ = (Index("ix_appeal_messages_thread", "appeal_id", "created_at"),)

    appeal_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("appeals.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)


class AppealNote(Entity):
    """Administratorning ICHKI qaydi: telefon, yuzma-yuz yoki onlayn suhbat.

    XAVFSIZLIK: bu yozuv ota-onaga ham, ustozga ham koʻrsatilmaydi. U
    maktabning ichki kuzatuvi ("otasi bilan telefonda gaplashildi, toʻlovni
    kelasi haftaga suradi"). Shu sabab qaydlar `AppealOut` ichida emas,
    ALOHIDA endpointda va faqat administratorga.
    """

    __tablename__ = "appeal_notes"
    __table_args__ = (
        Index("ix_appeal_notes_thread", "appeal_id", "created_at"),
        # Reyting 1..5. Chegara BAZADA: bu qiymat keyinchalik ustozlar
        # faoliyati hisobotiga tushadi va u yerda 0 yoki 9 chiqsa
        # oʻrtacha koʻrsatkich buziladi.
        CheckConstraint(
            "teacher_rating IS NULL OR teacher_rating BETWEEN 1 AND 5",
            name="teacher_rating_range",
        ),
    )

    appeal_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("appeals.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    # Suhbat muayyan ustoz haqida boʻlsa — kim haqida va qanday baholandi.
    # Administrator kabinetidagi mavjud forma aynan shuni soʻraydi:
    # «ota-ona darsdagi shovqindan norozi» kabi qayd ustozga bogʻlanadi.
    about_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    teacher_rating: Mapped[int | None] = mapped_column(nullable=True)
    teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
