"""Tarbiya/psixologiya sxemalari."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class WellbeingNoteOut(BaseModel):
    id: uuid.UUID
    kind: str
    tone: str
    text: str
    author_name: str
    subject_name: str | None
    created_at: datetime


class WellbeingNoteCreateIn(BaseModel):
    student_id: uuid.UUID
    kind: str
    tone: str
    text: str = Field(min_length=5, max_length=2000)
    subject_id: uuid.UUID | None = None
