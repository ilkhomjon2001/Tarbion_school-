"""Dars jadvali sxemalari (T-011). TZ: ADM-08, ADM-09."""

import uuid
from datetime import date

from pydantic import BaseModel, Field


class ScheduleEntryOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_name: str
    teacher_id: uuid.UUID
    teacher_name: str
    weekday: int
    period: int
    room: str | None


class ScheduleEntryIn(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID
    #: 1 = dushanba … 7 = yakshanba (ISO).
    weekday: int = Field(ge=1, le=7)
    period: int = Field(ge=1, le=10)
    room: str | None = Field(default=None, max_length=30)


class ScheduleEntryUpdateIn(BaseModel):
    """Faqat ustoz va xona. Sinf, fan yoki vaqt oʻzgarsa — bu boshqa dars."""

    teacher_id: uuid.UUID | None = None
    room: str | None = Field(default=None, max_length=30)


class TeacherLoadOut(BaseModel):
    teacher_id: uuid.UUID
    full_name: str
    subjects: list[str]
    weekly_hours: int
    classes: list[str]


# ─────────────── Jadval istisnolari (ADM-10) ───────────────


class LessonCancelIn(BaseModel):
    """Sabab majburiy: «dars boʻlmadi» oʻzi oilaga javob emas."""

    reason: str = Field(min_length=3, max_length=300)


class LessonSubstituteIn(BaseModel):
    teacher_id: uuid.UUID
    note: str | None = Field(default=None, max_length=300)


class LessonMoveIn(BaseModel):
    period: int = Field(ge=1, le=10)
    room: str | None = Field(default=None, max_length=30)
    note: str | None = Field(default=None, max_length=300)


class LessonExceptionOut(BaseModel):
    lesson_id: uuid.UUID
    lesson_date: date
    period: int
    class_name: str
    subject_name: str
    teacher_name: str
    room: str | None
    is_cancelled: bool
    cancel_reason: str | None
    is_substituted: bool
    exception_note: str | None
