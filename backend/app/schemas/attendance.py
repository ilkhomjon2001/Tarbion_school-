"""Davomat sxemalari (T-013). TZ: DAV-01, DAV-03, DAV-06.

Kirish va chiqish sxemalari ALOHIDA (X-5): `AttendanceMarkIn` da faqat
ustoz oʻzgartira oladigan maydonlar bor. `marked_by_id`, `marked_at`
yoki `is_archived` yuborib boʻlmaydi — ular serverda qoʻyiladi.
"""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

AttendanceStatusLiteral = Literal["present", "absent", "excused", "late"]


class AttendanceRowIn(BaseModel):
    student_id: uuid.UUID
    status: AttendanceStatusLiteral
    note: str | None = Field(default=None, max_length=300)


class AttendanceMarkIn(BaseModel):
    """Butun sinf bitta soʻrovda."""

    rows: list[AttendanceRowIn] = Field(min_length=1, max_length=60)
    # Oʻtilgan mavzu davomat bilan birga saqlanadi (JUR-01). `None` —
    # mavzuga tegilmaydi; boʻsh qator — mavzu oʻchiriladi.
    topic: str | None = Field(default=None, max_length=200)


class AttendanceMarkOut(BaseModel):
    """Nima oʻzgargani — ustozga "saqlandi" dan koʻra aniqroq javob."""

    created: int
    updated: int
    unchanged: int


class StudentRowOut(BaseModel):
    """Roʻyxatdagi bitta oʻquvchi va uning holati.

    Telefon, manzil va hujjat maydonlari ATAYLAB yoʻq (X-6): bu roʻyxat
    endpointi, shaxsiy maʼlumot faqat bitta oʻquvchi kartochkasida.
    """

    student_id: uuid.UUID
    full_name: str
    status: AttendanceStatusLiteral | None = None
    note: str | None = None


class LessonAttendanceOut(BaseModel):
    lesson_id: uuid.UUID
    class_name: str
    subject_name: str
    lesson_date: date
    period: int
    room: str | None
    starts_at: datetime
    ends_at: datetime
    topic: str | None
    marked_at: datetime | None
    #: DAV-03: ustoz hali tahrirlay oladimi va qachongacha.
    editable: bool
    edit_deadline: datetime
    students: list[StudentRowOut]


class TeacherLessonOut(BaseModel):
    id: uuid.UUID
    class_name: str
    subject_name: str
    period: int
    room: str | None
    starts_at: datetime
    ends_at: datetime
    topic: str | None
    marked: bool
    editable: bool
    #: "22/25 belgilandi" koʻrsatish uchun.
    student_count: int
    present_count: int


class AttendanceStatOut(BaseModel):
    total: int
    present: int
    absent: int
    excused: int
    late: int
    percent: float


class StudentStatOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    stat: AttendanceStatOut
