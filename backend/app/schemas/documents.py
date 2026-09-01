"""Maʼlumotnomalar sxemalari."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_name: str | None
    #: Chop etiladigan matn uchun — «tugʻilgan yili: 2013».
    birth_year: int | None
    doc_type: str
    requested_by: str
    status: str
    number: str | None
    issued_at: datetime | None
    recipient: str | None
    copies: int
    extra_text: str | None
    created_at: datetime


class DocumentCreateIn(BaseModel):
    student_id: uuid.UUID
    doc_type: str
    requested_by: str = Field(default="", max_length=120)


class DocumentIssueIn(BaseModel):
    recipient: str = Field(default="", max_length=200)
    copies: int = Field(default=1, ge=1, le=10)
    extra_text: str | None = Field(default=None, max_length=500)
