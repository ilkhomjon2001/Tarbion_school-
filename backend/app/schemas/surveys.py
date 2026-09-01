"""Soʻrovnoma sxemalari.

Natija sxemasida ota-onaning kimligi YOʻQ — anonimlik sxema
darajasida kafolatlanadi (X-5 ruhi).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SurveyQuestionOut(BaseModel):
    id: uuid.UUID
    text: str
    position: int


class SurveyOut(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    questions: list[SurveyQuestionOut]
    response_count: int
    created_at: datetime


class SurveyCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    questions: list[str] = Field(min_length=1, max_length=15)


class TeacherToRateOut(BaseModel):
    teacher_id: uuid.UUID
    teacher_name: str
    subjects: list[str]
    class_name: str
    answered: bool


class ActiveSurveyOut(BaseModel):
    """Ota-ona koʻradigan faol soʻrovnoma — u yoʻq boʻlsa `survey=None`."""

    survey: SurveyOut | None
    teachers: list[TeacherToRateOut]


class RespondIn(BaseModel):
    teacher_id: uuid.UUID
    #: savol id → 1..5
    scores: dict[uuid.UUID, int]
    comment: str | None = Field(default=None, max_length=500)


class SurveyQuestionAvgOut(BaseModel):
    text: str
    average: float


class SurveyCommentOut(BaseModel):
    class_name: str
    text: str


class TeacherResultOut(BaseModel):
    teacher_id: uuid.UUID
    teacher_name: str
    response_count: int
    average: float
    distribution: dict[int, int]
    criteria: list[SurveyQuestionAvgOut]
    comments: list[SurveyCommentOut]
