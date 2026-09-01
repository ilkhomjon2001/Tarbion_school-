"""Soʻrovnomalar — ota-onalar ustozlarni baholaydi.

Administrator soʻrovnoma tuzadi (savollar 1–5 shkalada), faollashtiradi;
ota-ona farzandiga dars beradigan har bir ustozni baholaydi. Natija
ustoz kesimida jamlanadi.

Ikkita qatʼiy qoida:

  · **Anonimlik.** Natijalarda ota-onaning kimligi KOʻRSATILMAYDI —
    aks holda hech kim ochiq yozmaydi. Lekin javob egasi bazada
    saqlanadi: bitta odam bitta ustozga bir marta javob beradi
    (unique cheklov shuni ushlaydi).
  · **Yopilgan soʻrovnoma oʻzgarmaydi.** Savolni keyin oʻzgartirish
    berilgan javoblarni maʼnosiz qilardi — faol yoki yopiq
    soʻrovnomaning savollari tahrirlanmaydi.
"""

import enum
import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class SurveyStatus(enum.StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


SURVEY_STATUS_LABELS_UZ: dict[str, str] = {
    SurveyStatus.DRAFT.value: "Qoralama",
    SurveyStatus.ACTIVE.value: "Faol",
    SurveyStatus.CLOSED.value: "Yopilgan",
}


class Survey(Entity):
    __tablename__ = "surveys"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=SurveyStatus.DRAFT.value
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class SurveyQuestion(Entity):
    __tablename__ = "survey_questions"
    __table_args__ = (UniqueConstraint("survey_id", "position"),)

    survey_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("surveys.id"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(nullable=False)


class SurveyResponse(Entity):
    """Bitta ota-onaning bitta ustoz haqidagi javobi."""

    __tablename__ = "survey_responses"
    __table_args__ = (
        # Bir odam — bir ustozga bir marta.
        UniqueConstraint("survey_id", "teacher_id", "respondent_id"),
        Index("ix_survey_responses_teacher", "survey_id", "teacher_id"),
    )

    survey_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("surveys.id"), nullable=False
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    respondent_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    #: Natijada sinf nomi koʻrsatiladi («7-A ota-onasi») — ism emas.
    class_name: Mapped[str | None] = mapped_column(String(20))
    comment: Mapped[str | None] = mapped_column(String(500))


class SurveyScore(Entity):
    __tablename__ = "survey_scores"
    __table_args__ = (UniqueConstraint("response_id", "question_id"),)

    response_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("survey_responses.id"), nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("survey_questions.id"), nullable=False
    )
    score: Mapped[int] = mapped_column(nullable=False)
