"""Rahbariyat hisobotlari (DIR-01…DIR-04).

Faqat oʻqish: rahbariyat maʼlumot kiritmaydi. Barcha raqam bazadan
hisoblanadi — hech qayerda toʻqilgan qiymat yoʻq.

Kirish huquqi: direktor, administrator, super administrator va oʻquv
boʻlimi. Ustoz va ota-ona bu boʻlimga kira olmaydi (CLAUDE.md 7-qoida —
tekshiruv serverda, frontendda yashirish himoya emas).
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Numeric, cast, distinct, func, select

from app.api.v1.deps import require_roles
from app.core.db import SessionDep
from app.models import (
    AttendanceRecord,
    AttendanceStatus,
    Grade,
    Lesson,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    User,
)
from app.schemas.director import (
    AttendancePoint,
    ClassRowOut,
    DirectorOverviewOut,
    TeacherRowOut,
)

router = APIRouter(
    prefix="/director",
    tags=["director"],
    dependencies=[
        Depends(
            require_roles(
                RoleName.DIRECTOR.value,
                RoleName.ADMIN.value,
                RoleName.SUPERADMIN.value,
                RoleName.ACADEMIC.value,
            )
        )
    ],
)

# «Kelgan» — darsda boʻlgan. Kechikkan ham kelgan hisoblanadi: frontenddagi
# davomat foizi ham aynan shu maʼnoda (`attendanceDaysOf`). Ikki tomonda
# taʼrif farq qilsa, bir xil maʼlumotdan turli foiz chiqadi.
PRESENT_STATUSES = (AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value)

_attended = func.count().filter(AttendanceRecord.status.in_(PRESENT_STATUSES))
_attendance_percent = func.round(
    cast(100.0 * _attended / func.nullif(func.count(AttendanceRecord.id), 0), Numeric), 1
)

PeriodDays = Annotated[int, Query(ge=1, le=365, description="Necha kunlik davr")]


@router.get("/overview", response_model=DirectorOverviewOut)
async def overview(session: SessionDep, days: PeriodDays = 30) -> DirectorOverviewOut:
    """DIR-01: umumiy koʻrsatkichlar.

    `days` — oxirgi necha kunlik davr. Sana bazadagi eng soʻnggi darsdan
    orqaga sanaladi, kalendar «bugun» idan emas: demo maʼlumot 2026-yilga
    tegishli va real sana bilan solishtirilsa boʻsh natija chiqardi.
    """
    last_day = await session.scalar(select(func.max(Lesson.lesson_date)))
    if last_day is None:
        return DirectorOverviewOut(
            total_students=0,
            total_teachers=0,
            total_classes=0,
            attendance_percent=0.0,
            average_grade=0.0,
            lessons_conducted=0,
            attendance_trend=[],
        )
    since = last_day - timedelta(days=days - 1)

    total_students = await session.scalar(
        select(func.count()).select_from(Student).where(Student.is_archived.is_(False))
    )
    total_classes = await session.scalar(
        select(func.count()).select_from(SchoolClass).where(SchoolClass.is_archived.is_(False))
    )
    # Ustoz — darsi bor xodim. Rol boʻyicha sanash notoʻgʻri boʻlardi:
    # yuklamasi yoʻq xodim ham «ustoz» roli bilan yuradi.
    total_teachers = await session.scalar(
        select(func.count(distinct(Lesson.teacher_id))).where(Lesson.is_archived.is_(False))
    )
    lessons_conducted = await session.scalar(
        select(func.count())
        .select_from(Lesson)
        .where(Lesson.is_archived.is_(False), Lesson.lesson_date.between(since, last_day))
    )
    attendance_percent = await session.scalar(
        select(_attendance_percent)
        .select_from(AttendanceRecord)
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(Lesson.lesson_date.between(since, last_day))
    )
    average_grade = await session.scalar(
        # K1: vaznli va shkala-normallashgan oʻrtacha — jurnal formulasi bilan bir xil.
        select(func.round(cast(func.sum(Grade.value * Grade.weight * 5.0 / Grade.max_value) / func.sum(Grade.weight), Numeric), 2)).where(
            Grade.is_archived.is_(False)
        )
    )

    trend_rows = (
        await session.execute(
            select(Lesson.lesson_date, _attendance_percent)
            .select_from(AttendanceRecord)
            .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
            .where(Lesson.lesson_date.between(since, last_day))
            .group_by(Lesson.lesson_date)
            .order_by(Lesson.lesson_date)
        )
    ).all()

    return DirectorOverviewOut(
        total_students=total_students or 0,
        total_teachers=total_teachers or 0,
        total_classes=total_classes or 0,
        attendance_percent=float(attendance_percent or 0),
        average_grade=float(average_grade or 0),
        lessons_conducted=lessons_conducted or 0,
        attendance_trend=[
            AttendancePoint(date=day.isoformat(), percent=float(pct or 0))
            for day, pct in trend_rows
        ],
    )


@router.get("/classes", response_model=list[ClassRowOut])
async def classes(session: SessionDep) -> list[ClassRowOut]:
    """DIR-03: sinflar kesimi — oʻquvchi soni, davomat, oʻrtacha baho."""
    homeroom = User.__table__.alias("homeroom")

    counts = (
        select(Student.class_id.label("class_id"), func.count().label("student_count"))
        .where(Student.is_archived.is_(False))
        .group_by(Student.class_id)
        .subquery()
    )
    attendance = (
        select(Lesson.class_id.label("class_id"), _attendance_percent.label("percent"))
        .select_from(AttendanceRecord)
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .group_by(Lesson.class_id)
        .subquery()
    )
    grades = (
        select(
            Lesson.class_id.label("class_id"),
            (func.sum(Grade.value * Grade.weight * 5.0 / Grade.max_value) / func.sum(Grade.weight)).label("avg_grade"),
        )
        .select_from(Grade)
        .join(Lesson, Lesson.id == Grade.lesson_id)
        .where(Grade.is_archived.is_(False))
        .group_by(Lesson.class_id)
        .subquery()
    )

    rows = (
        await session.execute(
            select(
                SchoolClass.id,
                SchoolClass.name,
                homeroom.c.last_name,
                homeroom.c.first_name,
                func.coalesce(counts.c.student_count, 0),
                func.coalesce(attendance.c.percent, 0.0),
                func.round(cast(func.coalesce(grades.c.avg_grade, 0.0), Numeric), 2),
            )
            .select_from(SchoolClass)
            .outerjoin(homeroom, homeroom.c.id == SchoolClass.homeroom_teacher_id)
            .outerjoin(counts, counts.c.class_id == SchoolClass.id)
            .outerjoin(attendance, attendance.c.class_id == SchoolClass.id)
            .outerjoin(grades, grades.c.class_id == SchoolClass.id)
            .where(SchoolClass.is_archived.is_(False))
            .order_by(SchoolClass.name)
        )
    ).all()

    return [
        ClassRowOut(
            id=class_id,
            name=name,
            homeroom_teacher_name=f"{last} {first}" if last else None,
            student_count=count,
            attendance_percent=float(percent or 0),
            average_grade=float(avg_grade or 0),
        )
        for class_id, name, last, first, count, percent, avg_grade in rows
    ]


@router.get("/teachers", response_model=list[TeacherRowOut])
async def teachers(session: SessionDep) -> list[TeacherRowOut]:
    """DIR-04: ustozlar faoliyati — yuklama, oʻtilgan dars, qoʻyilgan baho."""
    # Haftalik yuklama — jadvaldagi slotlar soni. Darslar bir necha haftaga
    # tarqalgani uchun `count(*)` emas, noyob jadval yozuvlari sanaladi.
    lessons = (
        select(
            Lesson.teacher_id.label("teacher_id"),
            func.count().label("conducted"),
            func.count(distinct(Lesson.schedule_entry_id)).label("weekly"),
        )
        .where(Lesson.is_archived.is_(False))
        .group_by(Lesson.teacher_id)
        .subquery()
    )
    given = (
        select(
            Grade.teacher_id.label("teacher_id"),
            func.count().label("grade_count"),
            (func.sum(Grade.value * Grade.weight * 5.0 / Grade.max_value) / func.sum(Grade.weight)).label("avg_value"),
        )
        .where(Grade.is_archived.is_(False))
        .group_by(Grade.teacher_id)
        .subquery()
    )
    subjects = (
        select(
            TeacherSubject.teacher_id.label("teacher_id"),
            func.array_agg(distinct(Subject.name)).label("names"),
        )
        .join(Subject, Subject.id == TeacherSubject.subject_id)
        .where(TeacherSubject.is_archived.is_(False))
        .group_by(TeacherSubject.teacher_id)
        .subquery()
    )
    homeroom = (
        select(
            SchoolClass.homeroom_teacher_id.label("teacher_id"),
            func.min(SchoolClass.name).label("class_name"),
        )
        .where(SchoolClass.is_archived.is_(False))
        .group_by(SchoolClass.homeroom_teacher_id)
        .subquery()
    )

    rows = (
        await session.execute(
            select(
                User.id,
                User.last_name,
                User.first_name,
                User.middle_name,
                subjects.c.names,
                homeroom.c.class_name,
                func.coalesce(lessons.c.weekly, 0),
                func.coalesce(lessons.c.conducted, 0),
                func.round(cast(func.coalesce(given.c.avg_value, 0.0), Numeric), 2),
                func.coalesce(given.c.grade_count, 0),
            )
            .select_from(User)
            # INNER JOIN: darsi yoʻq xodim ustozlar roʻyxatida chiqmaydi.
            .join(lessons, lessons.c.teacher_id == User.id)
            .outerjoin(subjects, subjects.c.teacher_id == User.id)
            .outerjoin(homeroom, homeroom.c.teacher_id == User.id)
            .outerjoin(given, given.c.teacher_id == User.id)
            .where(User.is_archived.is_(False))
            .order_by(User.last_name, User.first_name)
        )
    ).all()

    out: list[TeacherRowOut] = []
    for row in rows:
        (
            user_id,
            last,
            first,
            middle,
            subject_names,
            class_name,
            weekly,
            conducted,
            avg_value,
            grade_count,
        ) = row
        out.append(
            TeacherRowOut(
                id=user_id,
                full_name=" ".join(p for p in (last, first, middle) if p),
                short_name=f"{last} {first[0]}." if first else last,
                subjects=sorted(subject_names or []),
                homeroom_class_name=class_name,
                weekly_hours=weekly or 0,
                lessons_conducted=conducted or 0,
                average_grade_given=float(avg_value or 0),
                grades_given=grade_count or 0,
            )
        )
    return out
