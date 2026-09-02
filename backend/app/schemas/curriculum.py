"""Oʻquv rejalari sxemalari (X-5: In/Out alohida)."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class PlanRowOut(BaseModel):
    id: uuid.UUID
    fan: str
    yil: str
    sinf: str
    status: str
    darslar_soni: int
    source_name: str | None
    created_at: datetime


class ImportOut(BaseModel):
    plan: PlanRowOut
    warnings: list[str]


class PlanLessonsOut(BaseModel):
    """Reja darslari — kartochka koʻrinishi uchun toʻliq JSON."""

    id: uuid.UUID
    fan: str
    yil: str
    sinf: str
    status: str
    lessons: list[dict]


class PublishedCatalogOut(BaseModel):
    """fan → yil → sinf → darslar soni."""

    fanlar: dict[str, dict[str, dict[str, int]]]
