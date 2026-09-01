"""CRM moduli: lidlar va qoʻngʻiroqlar jurnali.

Lid — maktabga qiziqish bildirgan oila. Telefon ATAYLAB unique emas:
bir oila ikki bola uchun ikki marta murojaat qilishi mumkin. Yopiq
holatlardan (`qabul_qilindi`, `yo_qoldi`) qaytish yoʻq — voronka
statistikasi orqaga «oqib» ketmasin.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class LeadSource(enum.StrEnum):
    INSTAGRAM = "instagram"
    TELEGRAM = "telegram"
    TAVSIYA = "tavsiya"
    SAYT = "sayt"
    BOSHQA = "boshqa"


LEAD_SOURCE_LABELS_UZ: dict[str, str] = {
    LeadSource.INSTAGRAM.value: "Instagram",
    LeadSource.TELEGRAM.value: "Telegram",
    LeadSource.TAVSIYA.value: "Tavsiya",
    LeadSource.SAYT.value: "Sayt",
    LeadSource.BOSHQA.value: "Boshqa",
}


class LeadStatus(enum.StrEnum):
    YANGI = "yangi"
    ALOQADA = "aloqada"
    TASHRIF = "tashrif"
    QABUL_QILINDI = "qabul_qilindi"
    YO_QOLDI = "yo_qoldi"


LEAD_STATUS_LABELS_UZ: dict[str, str] = {
    LeadStatus.YANGI.value: "Yangi",
    LeadStatus.ALOQADA.value: "Aloqada",
    LeadStatus.TASHRIF.value: "Tashrif",
    LeadStatus.QABUL_QILINDI.value: "Qabul qilindi",
    LeadStatus.YO_QOLDI.value: "Yoʻqoldi",
}

#: Yakuniy holatlar — bulardan boshqa holatga oʻtish yoʻq (409).
LEAD_CLOSED_STATUSES = frozenset(
    {LeadStatus.QABUL_QILINDI.value, LeadStatus.YO_QOLDI.value}
)


class CallResult(enum.StrEnum):
    JAVOB_BERDI = "javob_berdi"
    KOTARILMADI = "kotarilmadi"
    BAND = "band"
    KEYIN_QAYTARAMAN = "keyin_qaytaraman"


CALL_RESULT_LABELS_UZ: dict[str, str] = {
    CallResult.JAVOB_BERDI.value: "Javob berdi",
    CallResult.KOTARILMADI.value: "Koʻtarilmadi",
    CallResult.BAND.value: "Band",
    CallResult.KEYIN_QAYTARAMAN.value: "Keyin qaytaraman",
}


class Lead(Entity):
    """Qiziqish bildirgan oila (CRM voronkasi)."""

    __tablename__ = "leads"
    __table_args__ = (
        Index("ix_leads_status", "status", "is_archived"),
        # Roʻyxatda telefon boʻyicha qidiruv boʻladi; unique EMAS.
        Index("ix_leads_phone", "phone"),
    )

    parent_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    child_name: Mapped[str | None] = mapped_column(String(120))
    child_birth_year: Mapped[int | None] = mapped_column()
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default=LeadSource.BOSHQA.value
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=LeadStatus.YANGI.value
    )
    note: Mapped[str | None] = mapped_column(String(500))
    #: Masʼul xodim — qaysi administrator olib boradi.
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id")
    )
    #: Qabul qilinganda yaratilgan oʻquvchi bilan bogʻlanadi.
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id")
    )


class LeadCall(Entity):
    """Lid boʻyicha bitta qoʻngʻiroq yozuvi."""

    __tablename__ = "lead_calls"
    __table_args__ = (
        Index("ix_lead_calls_lead", "lead_id", "called_at"),
        # Umumiy jurnal: barcha lidlar boʻylab, sana boʻyicha.
        Index("ix_lead_calls_called_at", "called_at"),
    )

    lead_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("leads.id"), nullable=False
    )
    #: Qoʻngʻiroq vaqti — UTC da (3-qoida), koʻrsatishda Asia/Tashkent.
    called_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    result: Mapped[str] = mapped_column(String(24), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id")
    )
