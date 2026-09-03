"""Rahbariyat hisobotlari — agregatlar BITTA joyda (DIR-01…DIR-04).

Audit Y5/O26: ilgari bu SQL router ichida yashar va formulalari jurnal/
davomat servislari bilan farq qilardi — direktor paneli boshqa raqam
koʻrsatardi. Endi:

  · davomat foizi — `attendance_service.AttendanceStat.percent` bilan
    bir xil taʼrif: (kelgan + kechikkan) / (jami − sababli), arxivlangan
    yozuv va arxivlangan dars maxrajga kirmaydi;
  · oʻrtacha baho — vaznli va 5 ballik shkalaga normallashgan
    (`grade_service._normalized` bilan bir xil formula, SQL koʻrinishda);
  · davr «bugun»dan orqaga sanaladi (`local_today`), bazadagi oxirgi
    darsdan emas;
  · haftalik yuklama — JORIY jadvaldan (`schedule_entries`), butun yil
    boʻyicha yigʻilgan darslardan emas.
"""

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import Numeric, cast, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timeutil import local_day_bounds, local_today
from app.models import (
    AttendanceRecord,
    AttendanceStatus,
    Exam,
    Grade,
    Homework,
    Lesson,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    User,
)

#: «Kelgan» — darsda boʻlgan. Kechikkan ham kelgan hisoblanadi.
PRESENT_STATUSES = (AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value)

_attended = func.count().filter(AttendanceRecord.status.in_(PRESENT_STATUSES))
#: O1: sababli kelmagan maxrajdan chiqadi — kasal bola foizda jazolanmaydi.
_denominator = func.count(AttendanceRecord.id) - func.count().filter(
    AttendanceRecord.status == AttendanceStatus.EXCUSED.value
)
_attendance_percent = func.round(
    cast(100.0 * _attended / func.nullif(_denominator, 0), Numeric), 1
)
#: K1: vaznli va 5 ballik shkalaga normallashgan oʻrtacha.
_avg_grade = func.sum(Grade.value * Grade.weight * 5.0 / Grade.max_value) / func.sum(
    Grade.weight
)

#: Arxivlanmagan davomat yozuvi + arxivlanmagan dars — foiz shu ustidan.
_ATTENDANCE_CLEAN = (
    AttendanceRecord.is_archived.is_(False),
    Lesson.is_archived.is_(False),
)


@dataclass(frozen=True, slots=True)
class OverviewData:
    total_students: int
    total_teachers: int
    total_classes: int
    attendance_percent: float
    average_grade: float
    #: Jadval boʻyicha davr ichidagi darslar. «Oʻtilgan» EMAS: jadvalda
    #: turgani dars oʻtilganini bildirmaydi.
    lessons_planned: int
    #: Shulardan nechtasida davomat belgilangan — dars haqiqatan
    #: oʻtilganining yagona izi.
    lessons_with_attendance: int
    #: Davomat foizi nechta yozuvdan hisoblangani. Oʻquv yili boshida
    #: bu son juda kichik boʻladi va foiz tasodifiy chiqadi — rahbar
    #: buni koʻrib turishi kerak.
    attendance_records: int
    #: (sana, foiz) — trend nuqtalari.
    trend: list[tuple[date, float]]


async def overview(session: AsyncSession, *, days: int = 30) -> OverviewData:
    """DIR-01: umumiy koʻrsatkichlar — oxirgi `days` kun, bugundan orqaga."""
    bugun = local_today()
    since = bugun - timedelta(days=days - 1)

    total_students = await session.scalar(
        select(func.count()).select_from(Student).where(Student.is_archived.is_(False))
    )
    total_classes = await session.scalar(
        select(func.count()).select_from(SchoolClass).where(SchoolClass.is_archived.is_(False))
    )
    # Ustoz — darsi bor FAOL xodim. Rol boʻyicha sanash notoʻgʻri boʻlardi:
    # yuklamasi yoʻq xodim ham «ustoz» roli bilan yuradi; ishdan ketgan
    # (arxivlangan) ustoz esa sanalmaydi.
    # Ustoz — DAVR ICHIDA darsi bor faol xodim. Davr filtri ilgari yoʻq
    # edi: rahbar «7 kun» ni tanlaydi, qolgan hamma raqam qisqaradi,
    # ustozlar soni esa butun yil boʻyicha qotib turardi.
    total_teachers = await session.scalar(
        select(func.count(distinct(Lesson.teacher_id)))
        .select_from(Lesson)
        .join(User, User.id == Lesson.teacher_id)
        .where(
            Lesson.is_archived.is_(False),
            User.is_archived.is_(False),
            Lesson.lesson_date.between(since, bugun),
        )
    )
    lessons_planned = await session.scalar(
        select(func.count())
        .select_from(Lesson)
        .where(Lesson.is_archived.is_(False), Lesson.lesson_date.between(since, bugun))
    )
    # Davomat belgilangan darslar — «oʻtilgan dars» ning yagona izi.
    # DISTINCT: bitta darsda 25 ta yozuv boʻladi.
    lessons_with_attendance = await session.scalar(
        select(func.count(distinct(Lesson.id)))
        .select_from(AttendanceRecord)
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(*_ATTENDANCE_CLEAN, Lesson.lesson_date.between(since, bugun))
    )
    attendance_records = await session.scalar(
        select(func.count())
        .select_from(AttendanceRecord)
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(*_ATTENDANCE_CLEAN, Lesson.lesson_date.between(since, bugun))
    )
    attendance_percent = await session.scalar(
        select(_attendance_percent)
        .select_from(AttendanceRecord)
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(*_ATTENDANCE_CLEAN, Lesson.lesson_date.between(since, bugun))
    )
    # Oʻrtacha ball ham DAVR ichida. Ilgari bu yerda sana filtri
    # YOʻQ edi: sahifada davr tanlagichi bor (7/30/90 kun), davomat
    # oʻzgarardi, oʻrtacha ball esa butun tarix boʻyicha qotib turardi.
    # Ikkita koʻrsatkich yonma-yon turib turli davrni bildirishi —
    # rahbar sezmaydigan, lekin xulosani buzadigan xato.
    #
    # Filtr `created_at` boʻyicha: baho QAChON QOʻYILGANI. Darsga
    # bogʻlash notoʻgʻri boʻlardi — chorak va yillik bahoda `lesson_id`
    # boʻsh va ular butunlay tushib qolardi.
    davr_boshi, _ = local_day_bounds(since)
    _, davr_oxiri = local_day_bounds(bugun)
    average_grade = await session.scalar(
        select(func.round(cast(_avg_grade, Numeric), 2)).where(
            Grade.is_archived.is_(False),
            Grade.created_at.between(davr_boshi, davr_oxiri),
        )
    )

    trend_rows = (
        await session.execute(
            select(Lesson.lesson_date, _attendance_percent)
            .select_from(AttendanceRecord)
            .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
            .where(*_ATTENDANCE_CLEAN, Lesson.lesson_date.between(since, bugun))
            .group_by(Lesson.lesson_date)
            .order_by(Lesson.lesson_date)
        )
    ).all()

    return OverviewData(
        total_students=total_students or 0,
        total_teachers=total_teachers or 0,
        total_classes=total_classes or 0,
        attendance_percent=float(attendance_percent or 0),
        average_grade=float(average_grade or 0),
        lessons_planned=lessons_planned or 0,
        lessons_with_attendance=lessons_with_attendance or 0,
        attendance_records=attendance_records or 0,
        trend=[(day, float(pct or 0)) for day, pct in trend_rows],
    )


@dataclass(frozen=True, slots=True)
class ClassRowData:
    id: uuid.UUID
    name: str
    homeroom_teacher_name: str | None
    student_count: int
    attendance_percent: float
    average_grade: float


async def classes(session: AsyncSession) -> list[ClassRowData]:
    """DIR-03: sinflar kesimi.

    Davomat ham, oʻquvchi soni ham FAOL oʻquvchilar toʻplamidan — bitta
    qatorda ikki xil toʻplam boʻlmasin (audit P10).
    """
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
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(*_ATTENDANCE_CLEAN, Student.is_archived.is_(False))
        .group_by(Lesson.class_id)
        .subquery()
    )
    grades = (
        select(Lesson.class_id.label("class_id"), _avg_grade.label("avg_grade"))
        .select_from(Grade)
        .join(Lesson, Lesson.id == Grade.lesson_id)
        .join(Student, Student.id == Grade.student_id)
        .where(Grade.is_archived.is_(False), Student.is_archived.is_(False))
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
        ClassRowData(
            id=class_id,
            name=name,
            homeroom_teacher_name=f"{last} {first}" if last else None,
            student_count=count,
            attendance_percent=float(percent or 0),
            average_grade=float(avg_grade or 0),
        )
        for class_id, name, last, first, count, percent, avg_grade in rows
    ]


@dataclass(frozen=True, slots=True)
class TeacherRowData:
    id: uuid.UUID
    full_name: str
    short_name: str
    subjects: list[str]
    homeroom_class_name: str | None
    weekly_hours: int
    #: Jadval boʻyicha BUGUNGACHA boʻlishi kerak boʻlgan darslar.
    #: Kelajakdagi darslar kirmaydi — ular butun yilga oldindan
    #: generatsiya qilinadi va sanoqni bir necha barobar oshirardi.
    lessons_planned: int
    average_grade_given: float
    grades_given: int

    # ── Faoliyat koʻrsatkichlari (loyiha egasining soʻrovi, 2026-09-03) ──
    #
    # Hammasi SANOQ, foiz emas: nol sanoq «hali boshlanmagan» degani va
    # buni interfeys izoh bilan koʻrsatadi. Foiz boʻlsa nol maxrajda
    # «0%» chiqib, ustoz yomon ishlayotgandek koʻrinardi.
    exams_held: int
    homework_given: int
    #: Ustoz darslaridan nechtasida davomat BELGILANGAN. Bu intizom
    #: koʻrsatkichi: dars oʻtilgan, lekin davomat yozilmagan boʻlsa
    #: ota-onaga xabar ham ketmaydi (DAV-05).
    lessons_with_attendance: int


async def teachers(session: AsyncSession) -> list[TeacherRowData]:
    """DIR-04: ustozlar faoliyati.

    Haftalik yuklama JORIY jadvaldan (`schedule_entries`) — jadval yil
    davomida oʻzgargan boʻlsa, eski slotlar yuklamani oshirib
    koʻrsatmaydi (jadval sahifasidagi `teacher_load` bilan bir manba).
    """
    bugun = local_today()
    # Ikki sanoq bitta soʻrovda: `any` — ustozni roʻyxatga kiritish
    # uchun (jadvalida dars bormi), `past` — koʻrsatkich uchun. Agar
    # roʻyxat ham faqat oʻtgan darslarga qurilsa, dushanbadan boshlanadigan
    # ustoz yakshanba kuni roʻyxatdan yoʻqolardi.
    lessons = (
        select(
            Lesson.teacher_id.label("teacher_id"),
            func.count().label("any_count"),
            func.count().filter(Lesson.lesson_date <= bugun).label("past"),
        )
        .where(Lesson.is_archived.is_(False))
        .group_by(Lesson.teacher_id)
        .subquery()
    )
    weekly = (
        select(
            ScheduleEntry.teacher_id.label("teacher_id"),
            func.count().label("weekly"),
        )
        .where(ScheduleEntry.is_archived.is_(False))
        .group_by(ScheduleEntry.teacher_id)
        .subquery()
    )
    given = (
        select(
            Grade.teacher_id.label("teacher_id"),
            func.count().label("grade_count"),
            _avg_grade.label("avg_value"),
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
    exams = (
        select(Exam.created_by_id.label("teacher_id"), func.count().label("cnt"))
        .where(Exam.is_archived.is_(False))
        .group_by(Exam.created_by_id)
        .subquery()
    )
    hw = (
        select(Homework.teacher_id.label("teacher_id"), func.count().label("cnt"))
        .where(Homework.is_archived.is_(False))
        .group_by(Homework.teacher_id)
        .subquery()
    )
    # DISTINCT dars: bitta darsda 25 ta davomat yozuvi boʻladi, bizga
    # esa «nechta darsda belgilangan» kerak.
    marked = (
        select(
            Lesson.teacher_id.label("teacher_id"),
            func.count(distinct(Lesson.id)).label("cnt"),
        )
        .join(AttendanceRecord, AttendanceRecord.lesson_id == Lesson.id)
        .where(Lesson.is_archived.is_(False), AttendanceRecord.is_archived.is_(False))
        .group_by(Lesson.teacher_id)
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
                func.coalesce(weekly.c.weekly, 0),
                func.coalesce(lessons.c.past, 0),
                func.round(cast(func.coalesce(given.c.avg_value, 0.0), Numeric), 2),
                func.coalesce(given.c.grade_count, 0),
                func.coalesce(exams.c.cnt, 0),
                func.coalesce(hw.c.cnt, 0),
                func.coalesce(marked.c.cnt, 0),
            )
            .select_from(User)
            # INNER JOIN: darsi yoʻq xodim ustozlar roʻyxatida chiqmaydi.
            .join(lessons, lessons.c.teacher_id == User.id)
            .outerjoin(weekly, weekly.c.teacher_id == User.id)
            .outerjoin(subjects, subjects.c.teacher_id == User.id)
            .outerjoin(homeroom, homeroom.c.teacher_id == User.id)
            .outerjoin(given, given.c.teacher_id == User.id)
            .outerjoin(exams, exams.c.teacher_id == User.id)
            .outerjoin(hw, hw.c.teacher_id == User.id)
            .outerjoin(marked, marked.c.teacher_id == User.id)
            .where(User.is_archived.is_(False))
            .order_by(User.last_name, User.first_name)
        )
    ).all()

    out: list[TeacherRowData] = []
    for row in rows:
        (
            user_id,
            last,
            first,
            middle,
            subject_names,
            class_name,
            haftalik,
            otgan,
            avg_value,
            grade_count,
            exam_count,
            hw_count,
            marked_count,
        ) = row
        out.append(
            TeacherRowData(
                id=user_id,
                full_name=" ".join(p for p in (last, first, middle) if p),
                short_name=f"{last} {first[0]}." if first else last,
                subjects=sorted(subject_names or []),
                homeroom_class_name=class_name,
                weekly_hours=haftalik or 0,
                lessons_planned=otgan or 0,
                average_grade_given=float(avg_value or 0),
                grades_given=grade_count or 0,
                exams_held=exam_count or 0,
                homework_given=hw_count or 0,
                lessons_with_attendance=marked_count or 0,
            )
        )
    return out
