"""Oʻquvchi dossieri sxemalari (rahbar/administrator kartochkasi).

X-5: chiqish sxemasi alohida — modelga keyin qoʻshilgan ustun oʻz-oʻzidan
tashqariga chiqmasin.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.school import GuardianOut
from app.schemas.wellbeing import WellbeingNoteOut


class DossierAbsenceOut(BaseModel):
    """Kelmagan yoki kechikkan dars — sababi bilan."""

    lesson_date: date
    period: int
    subject_name: str
    status: str
    note: str | None


class DossierConversationOut(BaseModel):
    """Oila bilan suhbat qaydi (ADM-16). Vasiy buni koʻrmaydi."""

    id: uuid.UUID
    appeal_id: uuid.UUID
    created_at: datetime
    kind: str
    summary: str
    author_name: str


class DossierMonthOut(BaseModel):
    year: int
    month: int
    amount: int
    covered: int
    status: str
    overdue: bool


class DossierFinanceOut(BaseModel):
    """Moliya — obyektiv yozuv. Baholovchi qayd ATAYLAB yoʻq.

    `monthly_fee` `null` boʻlishi mumkin: shartnoma hali tuzilmagan.
    Nol emas — nol «bepul oʻqiydi» degani boʻlardi.
    """

    monthly_fee: int | None
    charged: int
    paid: int
    balance: int
    months: list[DossierMonthOut]


class StudentDossierOut(BaseModel):
    id: uuid.UUID
    full_name: str
    birth_date: date | None
    class_name: str | None
    is_archived: bool
    guardians: list[GuardianOut]

    #: Davomat sanogʻi qaysi oʻquv yili boʻyicha. `null` — yil belgilanmagan.
    year_name: str | None
    attendance_counts: dict[str, int]
    absences: list[DossierAbsenceOut]

    wellbeing: list[WellbeingNoteOut]
    conversations: list[DossierConversationOut]
    finance: DossierFinanceOut
