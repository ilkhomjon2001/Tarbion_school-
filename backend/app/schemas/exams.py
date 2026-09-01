"""Imtihonlar va dars rejalari sxemalari."""

import uuid
from datetime import date

from pydantic import BaseModel, Field


class ExamStatsOut(BaseModel):
    entered: int
    absent: int
    average: float | None
    highest: int | None
    lowest: int | None
    pass_rate: int | None


class ExamOut(BaseModel):
    id: uuid.UUID
    title: str
    kind: str
    status: str
    subject_id: uuid.UUID
    subject_name: str
    class_id: uuid.UUID
    class_name: str
    exam_date: date
    stats: ExamStatsOut


class ExamCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    kind: str
    subject_id: uuid.UUID
    class_id: uuid.UUID
    exam_date: date


class ExamResultRowOut(BaseModel):
    student_id: uuid.UUID
    student_name: str
    score: int | None
    absent: bool
    recorded: bool


class ScoreItemIn(BaseModel):
    student_id: uuid.UUID
    score: int | None = Field(default=None, ge=0, le=100)
    absent: bool = False


class EnterResultsIn(BaseModel):
    scores: list[ScoreItemIn] = Field(min_length=1)


class PlanOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    teacher_name: str
    subject_name: str
    class_name: str
    period: str
    status: str
    comment: str | None


class PlanCreateIn(BaseModel):
    teacher_id: uuid.UUID
    subject_id: uuid.UUID
    class_id: uuid.UUID
    period: str = Field(min_length=2, max_length=40)


class PlanStatusIn(BaseModel):
    status: str
    comment: str | None = Field(default=None, max_length=300)
