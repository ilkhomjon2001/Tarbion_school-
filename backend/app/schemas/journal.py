"""Jurnal va uy vazifasi sxemalari (JUR-01…JUR-07, UYV-01…UYV-07).

Kirish va chiqish ALOHIDA (X-5). `GradeIn` da faqat ustoz oʻzgartira
oladigan maydonlar bor: `teacher_id`, `lesson_id` va `max_value`
serverda qoʻyiladi — aks holda ustoz oʻzini boshqa birov qilib
koʻrsatishi yoki 100 ballik baho yozib yuborishi mumkin edi.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

GradeKindLiteral = str


# ─────────────────────────── Baho ───────────────────────────


class GradeOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    value: int
    max_value: int
    kind: str
    weight: int
    comment: str | None
    lesson_id: uuid.UUID | None
    lesson_date: date | None


class JournalStudentOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    #: `null` — davomat hali belgilanmagan.
    attendance: str | None
    #: 3-qoida: kelmagan yoki sababli oʻquvchiga baho qoʻyilmaydi.
    gradable: bool
    block_reason: str | None
    grade: GradeOut | None


class LessonJournalOut(BaseModel):
    lesson_id: uuid.UUID
    class_name: str
    subject_name: str
    lesson_date: date
    period: int
    topic: str | None
    #: DAV-03 oynasi baho uchun ham amal qiladi.
    editable: bool
    max_value: int
    students: list[JournalStudentOut]


class GradeIn(BaseModel):
    student_id: uuid.UUID
    #: `null` — bahoni olib tashlash (xato qoʻyilgan boʻlsa).
    value: int | None = Field(default=None, ge=0, le=100)
    comment: str | None = Field(default=None, max_length=300)


class LessonGradesIn(BaseModel):
    rows: list[GradeIn]
    kind: str = "current"
    weight: int = Field(default=1, ge=1, le=10)


class ClassJournalRowOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    #: sana (`YYYY-MM-DD`) → baho.
    grades: dict[str, int]
    #: 4-qoida: fan ustoziga `null`.
    average: float | None


class ClassJournalOut(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    dates: list[date]
    rows: list[ClassJournalRowOut]
    #: Oʻrtacha koʻrsatiladimi — frontend ustunni shunga qarab chizadi.
    shows_average: bool


class StudentSubjectGradesOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    grades: list[GradeOut]
    average: float | None


# ─────────────────────────── Uy vazifasi ───────────────────────────


class HomeworkOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_name: str
    title: str
    description: str
    due_at: datetime
    allow_late: bool
    max_score: int
    weight: int
    total_count: int
    submitted_count: int
    graded_count: int


class HomeworkCreateIn(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=5000)
    due_at: datetime
    lesson_id: uuid.UUID | None = None
    allow_late: bool = True
    max_score: int = Field(default=5, ge=1, le=100)
    weight: int = Field(default=1, ge=1, le=10)


class SubmissionOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    full_name: str
    status: str
    submitted_at: datetime | None
    answer_text: str | None
    attachment_name: str | None
    score: int | None
    teacher_comment: str | None


class SubmissionListOut(BaseModel):
    homework_id: uuid.UUID
    title: str
    max_score: int
    due_at: datetime
    rows: list[SubmissionOut]


class GradeSubmissionIn(BaseModel):
    score: int = Field(ge=0, le=100)
    comment: str | None = Field(default=None, max_length=2000)


class ReturnSubmissionIn(BaseModel):
    """UYV-03: izoh majburiy — nima notoʻgʻri ekani aytilmasa vazifa foydasiz."""

    comment: str = Field(min_length=3, max_length=2000)


class StudentHomeworkOut(BaseModel):
    submission_id: uuid.UUID
    homework_id: uuid.UUID
    subject_name: str
    title: str
    description: str
    due_at: datetime
    status: str
    submitted_at: datetime | None
    score: int | None
    max_score: int
    teacher_comment: str | None


class SubmitIn(BaseModel):
    answer_text: str | None = Field(default=None, max_length=10000)
