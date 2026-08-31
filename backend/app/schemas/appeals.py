"""Murojaat sxemalari (MUR-01…MUR-06).

X-5: kirish va chiqish sxemalari ALOHIDA. Ota-ona `{"status": "closed"}`
yoki `{"author_id": "..."}` yuborib holatni yoki muallifni oʻzgartira
olmasligi kerak — `AppealCreateIn` da bunday maydonlar yoʻq.

X-6: roʻyxatda shaxsiy maʼlumot yoʻq — ota-onaning telefoni, manzili
qaytmaydi, faqat ism-familiya.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import AppealStatus, AppealTarget, ContactKind


class AppealMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    body: str
    created_at: datetime


class AppealOut(BaseModel):
    """Roʻyxat va kartochka uchun umumiy koʻrinish.

    `messages` roʻyxatda boʻsh keladi va faqat bitta murojaat ochilganda
    toʻldiriladi: 100 ta murojaatning barcha yozishmasini bir soʻrovda
    yuborish ham sekin, ham keraksiz.
    """

    id: uuid.UUID
    target: AppealTarget
    status: AppealStatus
    title: str

    student_id: uuid.UUID
    student_name: str
    class_name: str | None

    author_id: uuid.UUID
    author_name: str
    assignee_id: uuid.UUID | None
    assignee_name: str | None
    subject_name: str | None

    # Yozishmani kim ochgan. `None` — ota-ona oʻzi. Toʻldirilgan boʻlsa
    # maktab boshlagan (ADM-16) va bu ota-onaga ham koʻrsatiladi: kim
    # yozganini yashirish yozishmani tushunarsiz qilardi.
    created_by_id: uuid.UUID | None = None
    created_by_name: str | None = None

    created_at: datetime
    due_at: datetime | None
    closed_at: datetime | None
    last_message_at: datetime | None
    message_count: int = 0

    messages: list[AppealMessageOut] = Field(default_factory=list)


class AppealCreateIn(BaseModel):
    student_id: uuid.UUID
    target: AppealTarget
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=3, max_length=4000)
    subject_id: uuid.UUID | None = None
    # Ota-ona tanlagan fan oʻqituvchisi. Server buni TEKSHIRADI — tanlangan
    # xodim shu bolaga dars bermasa soʻrov rad etiladi.
    assignee_id: uuid.UUID | None = None
    # ADM-16: maktab yozishmani boshlaganda — yozishma tegishli vasiy
    # hisobi. Ota-ona yuborsa EʼTIBORGA OLINMAYDI, aks holda u boshqa
    # oila nomidan yozishma ochib yuborardi.
    author_id: uuid.UUID | None = None


class MessageCreateIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class StatusUpdateIn(BaseModel):
    status: AppealStatus


class AssignIn(BaseModel):
    assignee_id: uuid.UUID


class AppealNoteOut(BaseModel):
    """ICHKI qayd — faqat administrator va rahbariyat javobida chiqadi."""

    id: uuid.UUID
    appeal_id: uuid.UUID
    kind: ContactKind
    summary: str
    author_id: uuid.UUID
    author_name: str
    created_at: datetime

    # Suhbat muayyan ustoz haqida boʻlsa.
    about_teacher_id: uuid.UUID | None = None
    about_teacher_name: str | None = None
    teacher_rating: int | None = None
    teacher_comment: str | None = None


class AppealNoteCreateIn(BaseModel):
    kind: ContactKind
    summary: str = Field(min_length=3, max_length=2000)
    about_teacher_id: uuid.UUID | None = None
    # 1..5. Chegara bazada ham bor — bu qiymat keyin ustozlar faoliyati
    # hisobotiga tushadi.
    teacher_rating: int | None = Field(default=None, ge=1, le=5)
    teacher_comment: str | None = Field(default=None, max_length=2000)


class AppealSummaryOut(BaseModel):
    """Kirish qutisi boshidagi raqamlar — foydalanuvchi kesimida."""

    total: int
    new: int
    open: int
    overdue: int


class ClassAppealStatOut(BaseModel):
    """MUR-06: qaysi sinfda murojaat koʻp."""

    class_name: str
    total: int
    open: int
    to_management: int
    to_teachers: int
    overdue: int


class AppealAssigneeOut(BaseModel):
    """Ota-ona murojaat yozayotganda tanlaydigan fan oʻqituvchisi.

    Roʻyxat SERVERDA quriladi — bolaning darslaridan. Frontend butun
    xodimlar roʻyxatini olib, oʻzi filtrlashi notoʻgʻri boʻlardi: bu
    maktabning butun kadrlar tarkibini ota-onaga koʻrsatardi (X-6).
    """

    id: uuid.UUID
    full_name: str
    subject_id: uuid.UUID
    subject_name: str


class AppealChildOut(BaseModel):
    """Ota-onaning bitta farzandi va unga yozish mumkin boʻlgan xodimlar."""

    student_id: uuid.UUID
    full_name: str
    class_name: str | None
    homeroom_teacher_name: str | None
    teachers: list[AppealAssigneeOut] = Field(default_factory=list)


class AppealOptionsOut(BaseModel):
    """MUR-01 formasi uchun kerak boʻlgan hamma narsa — BITTA soʻrovda.

    Aks holda forma ochilganda uch-toʻrt soʻrov ketardi: farzandlar, sinf
    rahbari, fan oʻqituvchilari, fanlar.
    """

    children: list[AppealChildOut] = Field(default_factory=list)


class GuardianOptionOut(BaseModel):
    """Oʻquvchining vasiy hisobi — yozishma kimga borishini tanlash uchun."""

    id: uuid.UUID
    full_name: str
    relation: str
    is_primary: bool


class StudentSearchOut(BaseModel):
    """ADM-16 qidiruvi. X-6: telefon, manzil va hujjat raqami yoʻq."""

    student_id: uuid.UUID
    full_name: str
    class_name: str | None
    guardians: list[GuardianOptionOut] = Field(default_factory=list)
