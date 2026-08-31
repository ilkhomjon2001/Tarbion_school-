"""Maʼlumotnoma sxemalari (T-008, T-009).

Roʻyxat va kartochka ALOHIDA (X-6): roʻyxatda tugʻilgan sana, telefon
va vasiy maʼlumoti yoʻq — ular faqat bitta oʻquvchi kartochkasida va
faqat huquqi borga.
"""

import uuid
from datetime import date

from pydantic import BaseModel, Field


class SubjectOut(BaseModel):
    id: uuid.UUID
    name: str
    short_name: str


class ClassOut(BaseModel):
    id: uuid.UUID
    name: str
    academic_year: str
    homeroom_teacher: str | None
    student_count: int


class ClassSubjectOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    weekly_hours: int


class StudentListRowOut(BaseModel):
    """Roʻyxatdagi qator — shaxsiy maʼlumotsiz (X-6)."""

    id: uuid.UUID
    full_name: str
    class_name: str | None
    is_archived: bool


class GuardianOut(BaseModel):
    user_id: uuid.UUID
    full_name: str
    relation: str
    phone: str | None


class StudentCardOut(BaseModel):
    """Bitta oʻquvchi — shaxsiy maʼlumot SHU YERDA."""

    id: uuid.UUID
    last_name: str
    first_name: str
    middle_name: str | None
    full_name: str
    birth_date: date | None
    class_id: uuid.UUID | None
    class_name: str | None
    is_archived: bool
    guardians: list[GuardianOut]


class StudentCreateIn(BaseModel):
    last_name: str = Field(min_length=1, max_length=80)
    first_name: str = Field(min_length=1, max_length=80)
    middle_name: str | None = Field(default=None, max_length=80)
    birth_date: date | None = None
    class_id: uuid.UUID | None = None


class StudentMoveIn(BaseModel):
    """`class_id: null` — sinfdan chiqarish (hali biriktirilmagan)."""

    class_id: uuid.UUID | None = None


class StudentArchiveIn(BaseModel):
    """Sabab majburiy: "nega ketdi" hisoboti shundan chiqadi."""

    reason: str = Field(min_length=2, max_length=200)


class StaffOut(BaseModel):
    """Xodim qatori. Telefon va manzil YOʻQ (X-6)."""

    user_id: uuid.UUID
    login: str
    full_name: str
    roles: list[str]
    subjects: list[str]
    subject_ids: list[uuid.UUID]
    is_active: bool


class StaffCreateIn(BaseModel):
    last_name: str = Field(min_length=1, max_length=80)
    first_name: str = Field(min_length=1, max_length=80)
    middle_name: str | None = Field(default=None, max_length=80)
    #: `teacher`, `homeroom_teacher`, `academic`, `admin`, `director`.
    roles: list[str] = Field(min_length=1)
    phone: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=120)
    subject_ids: list[uuid.UUID] = Field(default_factory=list)


class StaffCreatedOut(BaseModel):
    """Login va boshlangʻich parol BIR MARTA qaytadi.

    Bazada faqat xesh saqlanadi — parolni keyin tiklab boʻlmaydi, faqat
    yangisini berish mumkin. Shu sabab administrator uni oʻsha zahoti
    egasiga yetkazadi.
    """

    user_id: uuid.UUID
    login: str
    full_name: str
    initial_password: str


class StaffSubjectsIn(BaseModel):
    """Toʻliq roʻyxat — qoʻshish/olib tashlash emas."""

    subject_ids: list[uuid.UUID]


class PasswordResetOut(BaseModel):
    login: str
    new_password: str
