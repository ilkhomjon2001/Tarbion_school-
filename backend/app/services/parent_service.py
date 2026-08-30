"""Ota-ona kabineti (T-016). TZ: OTA-01, OTA-02, OTA-03.

Butun modul bitta qoidaga bogʻlangan: **ota-ona faqat oʻz farzandini
koʻradi** (CLAUDE.md 6-qoida, X-1). Tekshiruv shu yerda emas,
`access.py` da va SOʻROV darajasida — `WHERE student_id IN (...)`.

Nega alohida modul: ota-ona `student_id` ni bilishi shart emas va uni
oʻylab topa olmasligi kerak. Shuning uchun kabinet har doim "mening
farzandlarim" roʻyxatidan boshlanadi va id lar shu roʻyxatdan olinadi.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AttendanceRecord,
    Guardian,
    Lesson,
    SchoolClass,
    Student,
    Subject,
)
from app.services.access import CurrentUser, assert_can_view_student


@dataclass(frozen=True, slots=True)
class ChildRow:
    student_id: uuid.UUID
    full_name: str
    short_name: str
    class_name: str
    relation: str


@dataclass(frozen=True, slots=True)
class LessonStatus:
    period: int
    subject: str
    status: str
    note: str | None


@dataclass(frozen=True, slots=True)
class DayAttendance:
    day: date
    lessons: list[LessonStatus]


async def my_children(session: AsyncSession, user: CurrentUser) -> list[ChildRow]:
    """Vasiyning farzandlari (OTA-02).

    Faqat `guardians` jadvalidagi bogʻlanish orqali. Ota-ona boshqa
    yoʻl bilan bolaga yeta olmaydi.
    """
    rows = await session.execute(
        select(Student, SchoolClass.name, Guardian.relation)
        .join(Guardian, Guardian.student_id == Student.id)
        .join(SchoolClass, SchoolClass.id == Student.class_id)
        .where(
            Guardian.user_id == user.id,
            Guardian.is_archived.is_(False),
            Student.is_archived.is_(False),
        )
        .order_by(Student.last_name, Student.first_name)
    )
    return [
        ChildRow(
            student_id=s.id,
            full_name=f"{s.last_name} {s.first_name}"
            + (f" {s.middle_name}" if s.middle_name else ""),
            short_name=s.first_name,
            class_name=class_name,
            relation=relation,
        )
        for s, class_name, relation in rows.all()
    ]


async def child_attendance(
    session: AsyncSession,
    user: CurrentUser,
    student_id: uuid.UUID,
    *,
    date_from: date,
    date_to: date,
) -> list[DayAttendance]:
    """Farzandning kunma-kun davomati (OTA-03, kalendar uchun).

    Bitta soʻrov: har kun uchun alohida soʻralsa oylik kalendar 30 marta
    bazaga borardi.

    Faqat DAVOMAT BELGILANGAN darslar qaytadi. Ustoz hali belgilamagan
    dars kalendarga tushmaydi — «kelmadi» deb koʻrsatib, ota-onani
    bekorga xavotirga solmaslik uchun.
    """
    # X-1: id URL dan kelgan — ruxsat SOʻROVDAN OLDIN tekshiriladi.
    await assert_can_view_student(session, user, student_id)

    rows = await session.execute(
        select(
            Lesson.lesson_date,
            Lesson.period,
            Subject.name,
            AttendanceRecord.status,
            AttendanceRecord.note,
        )
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .join(Subject, Subject.id == Lesson.subject_id)
        .where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.is_archived.is_(False),
            Lesson.lesson_date >= date_from,
            Lesson.lesson_date <= date_to,
        )
        .order_by(Lesson.lesson_date, Lesson.period)
    )

    kunlar: dict[date, list[LessonStatus]] = {}
    for lesson_date, period, subject, status, note in rows.all():
        kunlar.setdefault(lesson_date, []).append(
            LessonStatus(period=period, subject=subject, status=status, note=note)
        )

    return [DayAttendance(day=d, lessons=ls) for d, ls in sorted(kunlar.items())]
