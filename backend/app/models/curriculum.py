"""Oʻquv rejalari (metodik baza) — oʻquv boʻlimi yuklaydigan CRUD modul.

Reja Excel shablonda tayyorlanadi, import qilinadi (qoralama), koʻrib
chiqilgach «joriy» qilinadi — shu paytdan ustozlar kabinetida koʻrinadi.
Bir (fan, yil, sinf) uchun bitta JORIY reja; yangisi joriy qilinganda
eskisi arxivlanadi (CLAUDE.md 1-qoida — hech narsa oʻchirilmaydi).

Darslar JSONB'da: tuzilma ustoz kabinetidagi kartochka/modal koʻrinishi
bilan bir xil (title, type, model, maqsad[], lugat[], nazariya[], ...).
"""

import enum
import uuid

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class CurriculumStatus(enum.StrEnum):
    QORALAMA = "qoralama"
    JORIY = "joriy"
    ARXIV = "arxiv"


CURRICULUM_STATUS_LABELS_UZ: dict[str, str] = {
    CurriculumStatus.QORALAMA.value: "Qoralama",
    CurriculumStatus.JORIY.value: "Joriy",
    CurriculumStatus.ARXIV.value: "Arxiv",
}

#: Dastur yillari — «1-yil», «2-yil» (oʻquv markaz dasturi bosqichi).
PROGRAM_YEARS = ("1-yil", "2-yil")


class CurriculumPlan(Entity):
    __tablename__ = "curriculum_plans"
    __table_args__ = (
        Index("ix_curriculum_lookup", "fan", "yil", "sinf", "status"),
    )

    #: Fan nomi matn koʻrinishida — reja fanlar maʼlumotnomasidan
    #: mustaqil yashaydi (fan keyin qoʻshilsa ham reja tayyor turadi).
    fan: Mapped[str] = mapped_column(String(80), nullable=False)
    yil: Mapped[str] = mapped_column(String(10), nullable=False)
    sinf: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(12),
        default=CurriculumStatus.QORALAMA.value,
        # Bazada ham default turadi — model uni EʼLON QILISHI kerak,
        # aks holda `alembic check` har safar «farq bor» deb yiqiladi
        # va haqiqiy sxema oʻzgarishi shu shovqin ichida koʻrinmay
        # qoladi.
        server_default=CurriculumStatus.QORALAMA.value,
        nullable=False,
    )
    #: Yuklangan fayl nomi — «qayerdan kelgan» izi.
    source_name: Mapped[str | None] = mapped_column(String(200))
    #: [{chorak, title, type, model, maqsad[], lugat[], nazariya[], ...}]
    lessons: Mapped[list] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
