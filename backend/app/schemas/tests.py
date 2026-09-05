"""Test sxemalari (TST-01…TST-05).

Ustoz va oʻquvchi koʻrinishi ALOHIDA sxemada. `OptionForStudentOut` da
`is_correct` maydoni umuman YOʻQ — servis uni soʻrovga qoʻshmaydi va
sxema ham qabul qilmaydi. Ikki qatlam: bittasi unutilsa ikkinchisi
ushlab qoladi (X-5).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TestOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_name: str
    title: str
    description: str
    status: str
    duration_minutes: int
    attempts_allowed: int
    shuffle: bool
    opens_at: datetime
    closes_at: datetime
    question_count: int
    max_score: int
    submitted_count: int
    total_students: int
    average_percent: float | None


class TestCreateIn(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    duration_minutes: int = Field(default=30, ge=1, le=300)
    attempts_allowed: int = Field(default=1, ge=1, le=10)
    shuffle: bool = True
    opens_at: datetime
    closes_at: datetime


class TestStatusIn(BaseModel):
    status: str


# ─────────────────────────── Savollar ───────────────────────────


class OptionOut(BaseModel):
    """Ustoz koʻrinishi — toʻgʻri javob bilan."""

    id: uuid.UUID
    text: str
    is_correct: bool


class QuestionOut(BaseModel):
    id: uuid.UUID
    position: int
    text: str
    kind: str
    points: int
    options: list[OptionOut]


class OptionForStudentOut(BaseModel):
    """Oʻquvchi koʻrinishi — `is_correct` maydoni YOʻQ."""

    id: uuid.UUID
    text: str


class QuestionForStudentOut(BaseModel):
    id: uuid.UUID
    position: int
    text: str
    kind: str
    points: int
    options: list[OptionForStudentOut]


class OptionIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    is_correct: bool = False


class QuestionIn(BaseModel):
    text: str = Field(min_length=2, max_length=2000)
    kind: str = "single"
    points: int = Field(default=1, ge=1, le=20)
    options: list[OptionIn] = Field(min_length=2, max_length=8)


# ─────────────────────────── Urinish ───────────────────────────


class AttemptOut(BaseModel):
    id: uuid.UUID
    test_id: uuid.UUID
    student_id: uuid.UUID
    full_name: str
    attempt_no: int
    started_at: datetime
    submitted_at: datetime | None
    score: int | None
    max_score: int
    percent: float | None


class AttemptStartOut(BaseModel):
    """Urinish boshlanganda savollar bilan qaytadi — toʻgʻri javobsiz."""

    attempt_id: uuid.UUID
    attempt_no: int
    attempts_allowed: int
    started_at: datetime
    duration_minutes: int
    closes_at: datetime
    questions: list[QuestionForStudentOut]


class AnswerIn(BaseModel):
    question_id: uuid.UUID
    #: Tanlangan variant id lari. `single` da bitta, `multiple` da bir nechta.
    selected: list[uuid.UUID] = Field(default_factory=list, max_length=8)


class SubmitAttemptIn(BaseModel):
    answers: list[AnswerIn]


class QuestionImportOut(BaseModel):
    """TST-06: nechta savol qoʻshildi va nima tashlandi.

    Ogohlantirish YOʻQOLMASIN: 60 ta savolli fayldan 3 tasi tashlansa
    va bu jimgina oʻtsa, ustoz testni toʻliq deb oʻylaydi.
    """

    added: int
    warnings: list[str]
