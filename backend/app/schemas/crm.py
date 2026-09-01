"""CRM sxemalari. In/Out ALOHIDA (X-5) — model hech qachon qaytarilmaydi.

Lid roʻyxati faqat `students.manage` huquqi borga ochiladi, shuning
uchun telefon raqami javobda bor — bu X-6 dagi «ochiq roʻyxat» emas.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class LeadIn(BaseModel):
    parent_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=4, max_length=20)
    child_name: str | None = Field(default=None, max_length=120)
    child_birth_year: int | None = Field(default=None, ge=1990, le=2030)
    source: str = "boshqa"
    note: str | None = Field(default=None, max_length=500)
    assigned_to_id: uuid.UUID | None = None


class LeadUpdate(BaseModel):
    """PATCH — faqat berilgan maydonlar oʻzgaradi."""

    parent_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, min_length=4, max_length=20)
    child_name: str | None = Field(default=None, max_length=120)
    child_birth_year: int | None = Field(default=None, ge=1990, le=2030)
    source: str | None = None
    status: str | None = None
    note: str | None = Field(default=None, max_length=500)
    assigned_to_id: uuid.UUID | None = None
    student_id: uuid.UUID | None = None


class LeadOut(BaseModel):
    id: uuid.UUID
    parent_name: str
    phone: str
    child_name: str | None
    child_birth_year: int | None
    source: str
    status: str
    note: str | None
    assigned_to_id: uuid.UUID | None
    assigned_to_name: str | None
    student_id: uuid.UUID | None
    created_at: datetime


class LeadCallIn(BaseModel):
    result: str
    note: str | None = Field(default=None, max_length=500)
    #: Berilmasa — hozirgi vaqt.
    called_at: datetime | None = None


class LeadCallOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    called_at: datetime
    result: str
    note: str | None
    created_by_id: uuid.UUID | None
    created_by_name: str | None


class CallFeedOut(BaseModel):
    """Umumiy qoʻngʻiroqlar jurnali qatori — lid maʼlumoti bilan."""

    id: uuid.UUID
    lead_id: uuid.UUID
    called_at: datetime
    result: str
    note: str | None
    created_by_name: str | None
    lead_parent_name: str
    lead_phone: str
    lead_status: str


class LeadSummaryOut(BaseModel):
    """Dashboard uchun: har status boʻyicha faol lidlar soni."""

    counts: dict[str, int]
    total: int


class CrmContractOut(BaseModel):
    """Shartnomalar roʻyxati qatori — mavjud TuitionContract dan, faqat oʻqish."""

    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_name: str | None
    monthly_fee: int
    starts_on: date
    is_archived: bool
    note: str | None
    created_at: datetime
