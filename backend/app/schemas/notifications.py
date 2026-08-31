"""Bildirishnoma sxemalari.

X-5: kirish va chiqish alohida. Kirishda faqat «qaysi yozuvni oʻqilgan
deb belgilash» bor — matn, boʻlim yoki qabul qiluvchi tashqaridan
kelmaydi, ularni servis oʻzi qoʻyadi.

X-6: roʻyxatda shaxsiy maʼlumot yoʻq. Oʻquvchining ismi bor — u
bildirishnomaning maʼnosi («Aliyev Ali darsga kelmadi»), lekin telefon,
manzil yoki hujjat raqami hech qachon.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models import NotificationKind


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: NotificationKind
    kind_label: str

    #: `core/sections.py` dagi boʻlim id si — yon menyudagi sanoq shunga
    #: bogʻlanadi.
    section: str
    link: str

    title: str
    body: str

    student_id: uuid.UUID | None
    student_name: str | None

    created_at: datetime
    read_at: datetime | None


class BadgeOut(BaseModel):
    """Yon menyu uchun: qaysi boʻlimda nechta oʻqilmagan xabar bor."""

    total: int
    #: Boʻlim id → oʻqilmaganlar soni. Nol boʻlgan boʻlim roʻyxatda
    #: boʻlmaydi — frontend uni yoʻq deb qabul qiladi.
    sections: dict[str, int]


class MarkReadIn(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


class MarkAllReadIn(BaseModel):
    #: Berilmasa — hammasi. Berilsa faqat oʻsha boʻlim.
    section: str | None = None


class MarkReadOut(BaseModel):
    updated: int
