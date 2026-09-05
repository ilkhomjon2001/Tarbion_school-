"""Oʻquv rejalari sxemalari (X-5: In/Out alohida)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


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


# ─────────── Qidiruv, ustoz rejasi, versiyalar (MET-05…MET-07) ───────────


class SearchHitOut(BaseModel):
    plan_id: uuid.UUID
    fan: str
    yil: str
    sinf: str
    chorak: int
    #: Reja ichidagi dars tartibi — kartochkani ochish uchun.
    index: int
    title: str
    #: «mavzu», «atama» yoki «jihoz» — nima uchun topildi.
    matched_in: str


class PlanCreateIn(BaseModel):
    """MET-06: ustoz oʻz rejasini qoʻshadi. Reja QORALAMA boʻlib tugʻiladi."""

    fan: str = Field(min_length=1, max_length=80)
    yil: str = Field(min_length=1, max_length=10)
    sinf: str = Field(min_length=1, max_length=20)
    #: Dars kartochkalari — shablondagi tuzilma.
    lessons: list[dict] = Field(min_length=1, max_length=200)


class LessonCardIn(BaseModel):
    """Kartochkaning YUBORILGAN maydonlari oʻzgaradi, qolgani tegilmaydi.

    `chorak` va `type` bu yerda yoʻq: chorak darsning rejadagi oʻrnini
    belgilaydi va uni oʻzgartirish butun rejani qayta tartiblashni
    talab qilardi — bunday oʻzgarish Excel orqali qilinadi.
    """

    title: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=120)
    natija: str | None = Field(default=None, max_length=500)
    video: str | None = Field(default=None, max_length=500)

    maqsad: list[str] | None = Field(default=None, max_length=30)
    lugat: list[str] | None = Field(default=None, max_length=50)
    jihoz: list[str] | None = Field(default=None, max_length=30)
    baholash: list[str] | None = Field(default=None, max_length=20)
    uyga: list[str] | None = Field(default=None, max_length=20)
    resurslar: list[str] | None = Field(default=None, max_length=20)

    #: MET-03 ilovalari — `{"id": "<file_id>"}` roʻyxati. Nom serverda
    #: `stored_files` dan olinadi, yuborilganiga ishonilmaydi.
    files: list[dict] | None = Field(default=None, max_length=10)
