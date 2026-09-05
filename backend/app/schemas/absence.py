"""Sababli qoldirish arizasi sxemalari (DAV-04).

Kirish va chiqish alohida (X-5). `created_by_id` kirishda YOʻQ — u
serverda tokendan olinadi, aks holda vasiy boshqa odam nomidan ariza
yozib qoʻyardi.
"""

import uuid
from datetime import date

from pydantic import BaseModel, Field


class AbsenceCreateIn(BaseModel):
    student_id: uuid.UUID
    date_from: date
    date_to: date
    #: TZ «matn va fayl» deydi — matn majburiy, fayl ixtiyoriy.
    reason: str = Field(min_length=5, max_length=2000)
    file_id: uuid.UUID | None = None


class AbsenceDecideIn(BaseModel):
    approve: bool
    #: Rad etishda majburiy — uzunlik servisda tekshiriladi, chunki
    #: shart `approve` ga bogʻliq.
    note: str | None = Field(default=None, max_length=500)


class AbsenceOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_name: str | None
    date_from: date
    date_to: date
    reason: str
    status: str
    created_by_name: str
    created_at: str
    decided_by_name: str | None
    decision_note: str | None
    #: Tasdiqlanganda nechta dars «sababli» ga oʻtdi.
    marked_lessons: int
    file_name: str | None
    #: Imzolangan havola — faqat bitta ariza soʻralganda toʻldiriladi (X-7).
    file_url: str | None
    can_decide: bool
