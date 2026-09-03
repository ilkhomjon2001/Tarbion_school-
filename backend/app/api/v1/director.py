"""Rahbariyat hisobotlari (DIR-01…DIR-04).

Faqat oʻqish: rahbariyat maʼlumot kiritmaydi. Barcha raqam bazadan
hisoblanadi — hech qayerda toʻqilgan qiymat yoʻq.

Kirish huquqi: direktor, administrator, super administrator va oʻquv
boʻlimi. Ustoz va ota-ona bu boʻlimga kira olmaydi (CLAUDE.md 7-qoida —
tekshiruv serverda, frontendda yashirish himoya emas).

Hisob-kitob `services/director_service.py` da — davomat foizi va
oʻrtacha baho jurnal/davomat servislari bilan BIR XIL formulada
(audit Y5/O26).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.v1.deps import require_roles
from app.core.db import SessionDep
from app.models import RoleName
from app.schemas.director import (
    AttendancePoint,
    ClassRowOut,
    DirectorOverviewOut,
    TeacherRowOut,
)
from app.services import director_service

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

PeriodDays = Annotated[int, Query(ge=1, le=365, description="Necha kunlik davr")]


@router.get("/overview", response_model=DirectorOverviewOut)
async def overview(session: SessionDep, days: PeriodDays = 30) -> DirectorOverviewOut:
    """DIR-01: umumiy koʻrsatkichlar — oxirgi `days` kun, bugundan orqaga."""
    data = await director_service.overview(session, days=days)
    return DirectorOverviewOut(
        total_students=data.total_students,
        total_teachers=data.total_teachers,
        total_classes=data.total_classes,
        attendance_percent=data.attendance_percent,
        average_grade=data.average_grade,
        lessons_conducted=data.lessons_conducted,
        attendance_trend=[
            AttendancePoint(date=day.isoformat(), percent=pct) for day, pct in data.trend
        ],
    )


@router.get("/classes", response_model=list[ClassRowOut])
async def classes(session: SessionDep) -> list[ClassRowOut]:
    """DIR-03: sinflar kesimi — oʻquvchi soni, davomat, oʻrtacha baho."""
    return [
        ClassRowOut(
            id=r.id,
            name=r.name,
            homeroom_teacher_name=r.homeroom_teacher_name,
            student_count=r.student_count,
            attendance_percent=r.attendance_percent,
            average_grade=r.average_grade,
        )
        for r in await director_service.classes(session)
    ]


@router.get("/teachers", response_model=list[TeacherRowOut])
async def teachers(session: SessionDep) -> list[TeacherRowOut]:
    """DIR-04: ustozlar faoliyati — yuklama, oʻtilgan dars, qoʻyilgan baho."""
    return [
        TeacherRowOut(
            id=r.id,
            full_name=r.full_name,
            short_name=r.short_name,
            subjects=r.subjects,
            homeroom_class_name=r.homeroom_class_name,
            weekly_hours=r.weekly_hours,
            lessons_conducted=r.lessons_conducted,
            average_grade_given=r.average_grade_given,
            grades_given=r.grades_given,
            exams_held=r.exams_held,
            homework_given=r.homework_given,
            lessons_with_attendance=r.lessons_with_attendance,
        )
        for r in await director_service.teachers(session)
    ]
