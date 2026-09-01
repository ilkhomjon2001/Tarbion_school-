"""Maʼlumotnomalar (spravka) — soʻrov navbati va reyestr.

Ota-ona maʼlumotnoma soʻraydi (hozircha telefon/yuzma-yuz, keyin
kabinetdan), administrator tayyorlab beradi. Berilgan hujjat
REYESTRDA qoladi: raqami, kimga, qachon, kim bergani.

Berilgan yozuv tahrirlanmaydi — qogʻozda chiqqan hujjatning elektron
izi oʻzgarsa, reyestr maʼnosini yoʻqotadi. Xato boʻlsa yangi hujjat
beriladi, eskisi arxivlanadi (1-qoida).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class DocumentType(enum.StrEnum):
    OQUV_JOYI = "oquv_joyi"
    DAROMAD = "daromad"
    HARBIY = "harbiy"
    BAHO_KOCHIRMASI = "baho_kochirmasi"
    TIBBIY = "tibbiy"


DOCUMENT_TYPE_LABELS_UZ: dict[str, str] = {
    DocumentType.OQUV_JOYI.value: "Oʻquv joyi haqida",
    DocumentType.DAROMAD.value: "Daromad uchun",
    DocumentType.HARBIY.value: "Harbiy komissariat uchun",
    DocumentType.BAHO_KOCHIRMASI.value: "Baho koʻchirmasi",
    DocumentType.TIBBIY.value: "Tibbiy maʼlumotnoma (086-U)",
}


class DocumentStatus(enum.StrEnum):
    NEW = "new"
    WAITING = "waiting"
    ISSUED = "issued"


class DocumentRequest(Entity):
    __tablename__ = "document_requests"
    __table_args__ = (
        # Navbat: holati boʻyicha, eskisi birinchi (kim koʻp kutgan).
        Index("ix_document_requests_status", "status", "created_at"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True
    )
    doc_type: Mapped[str] = mapped_column(String(32), nullable=False)
    #: Kim soʻragan — «Otasi», «Onasi (tel. orqali)». Erkin matn: soʻrov
    #: hozircha ogʻzaki keladi.
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=DocumentStatus.NEW.value
    )

    # ── Berilganda toʻladi va shundan keyin oʻzgarmaydi ──
    number: Mapped[str | None] = mapped_column(String(30), unique=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    issued_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id")
    )
    #: Qayerga taqdim etiladi — «Ish joyiga», «Harbiy komissariatga».
    recipient: Mapped[str | None] = mapped_column(String(200))
    copies: Mapped[int] = mapped_column(default=1, nullable=False)
    extra_text: Mapped[str | None] = mapped_column(String(500))
