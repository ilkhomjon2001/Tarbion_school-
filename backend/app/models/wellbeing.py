"""Tarbiyaviy va psixologik qaydlar.

TZ'da bu boʻlim YOʻQ — loyiha egasining soʻroviga koʻra qoʻshilgan
(docs/DECISIONS.md). Bu loyihadagi ENG NOZIK maʼlumot: bolaning xulqi
va ruhiy holati haqidagi yozuv baho emas, u sizib chiqsa bolaga yillar
davomida ergashib yuradi.

Shu sababli qoidalar baho-davomatnikidan qattiqroq:

  · yozuv turi ikkita: `behavior` (ustoz/sinf rahbari) va `psychology`
    (faqat psixolog roli bor xodim — hozircha rahbariyat);
  · psixologik yozuvni ODDIY USTOZ KOʻRMAYDI, hatto oʻz sinfiniki ham.
    U faqat vasiy, sinf rahbari va rahbariyatga koʻrinadi;
  · har yozuv audit_log ga tushadi, oʻchirilmaydi — arxivlanadi.
"""

import enum
import uuid

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class WellbeingKind(enum.StrEnum):
    BEHAVIOR = "behavior"
    PSYCHOLOGY = "psychology"


class WellbeingTone(enum.StrEnum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    ATTENTION = "attention"


TONE_LABELS_UZ: dict[str, str] = {
    WellbeingTone.POSITIVE.value: "Ijobiy",
    WellbeingTone.NEUTRAL.value: "Odatiy",
    WellbeingTone.ATTENTION.value: "Eʼtibor talab qiladi",
}


class WellbeingNote(Entity):
    __tablename__ = "wellbeing_notes"
    __table_args__ = (
        # Bola kartochkasi: bitta oʻquvchining yozuvlari, yangisidan.
        Index("ix_wellbeing_student_created", "student_id", "created_at"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    tone: Mapped[str] = mapped_column(String(16), nullable=False)
    #: Fan oʻqituvchisi yozgan boʻlsa — qaysi fan nomidan.
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("subjects.id")
    )
    text: Mapped[str] = mapped_column(String(2000), nullable=False)
