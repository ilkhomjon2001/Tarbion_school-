"""Eʼlonlar sxemalari (T-020)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AnnouncementOut(BaseModel):
    id: uuid.UUID
    audience: str
    title: str
    body: str
    important: bool
    author_name: str
    subject_name: str | None
    #: Qamrovdagi sinflar nomlari — «7-A, 7-B». Butun maktab boʻlsa boʻsh.
    class_names: list[str]
    recipients_count: int
    created_at: datetime


class AnnouncementCreateIn(BaseModel):
    audience: str
    title: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2, max_length=4000)
    class_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    important: bool = False


class RecipientsPreviewOut(BaseModel):
    """ADM-12: yuborishdan oldin koʻrsatiladigan son."""

    recipients: int


class TargetOut(BaseModel):
    id: uuid.UUID
    name: str


class TargetsOut(BaseModel):
    """Ustoz eʼlon bera oladigan sinflar va fanlar — jadvalidan."""

    classes: list[TargetOut]
    subjects: list[TargetOut]
