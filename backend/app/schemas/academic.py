"""Oʻquv yili, chorak, taʼtil, qoʻngʻiroq sxemalari (T-007).

Choraklar va qoʻngʻiroqlar YAXLIT yoziladi (`TermsIn`, `BellsIn`):
qoplanishni faqat butun toʻplam ustidan tekshirib boʻladi.
"""

import uuid
from datetime import date, time

from pydantic import BaseModel, Field


class AcademicYearOut(BaseModel):
    id: uuid.UUID
    name: str
    starts_on: date
    ends_on: date
    is_current: bool


class AcademicYearCreateIn(BaseModel):
    name: str = Field(min_length=4, max_length=20)  # "2026-2027"
    starts_on: date
    ends_on: date
    make_current: bool = False


class AcademicYearUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=4, max_length=20)
    starts_on: date | None = None
    ends_on: date | None = None


class TermOut(BaseModel):
    id: uuid.UUID
    index: int
    name: str
    starts_on: date
    ends_on: date


class TermIn(BaseModel):
    index: int = Field(ge=1, le=4)
    name: str = Field(min_length=1, max_length=40)
    starts_on: date
    ends_on: date


class TermsIn(BaseModel):
    """Roʻyxatdan chiqib qolgan chorak arxivlanadi (CLAUDE.md 1-qoida)."""

    terms: list[TermIn] = Field(min_length=1, max_length=4)


class HolidayOut(BaseModel):
    id: uuid.UUID
    day: date
    title: str


class HolidayIn(BaseModel):
    day: date
    title: str = Field(min_length=2, max_length=120)


class BellOut(BaseModel):
    id: uuid.UUID
    period: int
    starts_at: time
    ends_at: time


class BellIn(BaseModel):
    period: int = Field(ge=1, le=8)
    starts_at: time
    ends_at: time


class BellsIn(BaseModel):
    bells: list[BellIn] = Field(min_length=1, max_length=8)
