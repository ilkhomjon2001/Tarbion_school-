"""Davomat endpointlari (T-013). TZ: DAV-01, DAV-03, DAV-06, DAV-07.

Routerda `require_roles(...)` darvozasi YOʻQ: ruxsat rolga emas,
MAʼLUMOTGA bogʻliq. Ustoz oʻz darsini koʻradi, sinf rahbari oʻz sinfini,
administrator hammasini — buni `services/access.py` va
`attendance_service` hal qiladi. Rol darvozasi qoʻyilsa, ikkita joyda
ikkita tekshiruv boʻlardi va biri kechroq unutilardi.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.core.exceptions import ValidationError
from app.core.timeutil import local_today
from app.models import AttendanceRecord, Student
from app.schemas.absence import AbsenceCreateIn, AbsenceDecideIn, AbsenceOut
from app.schemas.attendance import (
    AttendanceMarkIn,
    AttendanceMarkOut,
    AttendanceStatOut,
    ClassDayMarkIn,
    ClassDayOut,
    DayLessonOut,
    DayMarkOut,
    DayStudentOut,
    GenerationOut,
    LessonAttendanceOut,
    StudentRowOut,
    StudentStatOut,
    TeacherLessonOut,
)
from app.services import absence_service, attendance_service, lesson_service
from app.services.attendance_service import AttendanceStat, MarkRow

#: Jadval ekranida eng uzuni — oy koʻrinishi. Undan uzun oraliq xato.
MAX_RANGE_DAYS = 62


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _absence_out(v: absence_service.AbsenceView) -> AbsenceOut:
    return AbsenceOut(
        id=v.id,
        student_id=v.student_id,
        student_name=v.student_name,
        class_name=v.class_name,
        date_from=v.date_from,
        date_to=v.date_to,
        reason=v.reason,
        status=v.status,
        created_by_name=v.created_by_name,
        created_at=v.created_at_iso,
        decided_by_name=v.decided_by_name,
        decision_note=v.decision_note,
        marked_lessons=v.marked_lessons,
        file_name=v.file_name,
        file_url=v.file_url,
        can_decide=v.can_decide,
    )

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _stat_out(stat: AttendanceStat) -> AttendanceStatOut:
    return AttendanceStatOut(
        total=stat.total,
        present=stat.present,
        absent=stat.absent,
        excused=stat.excused,
        late=stat.late,
        percent=stat.percent,
    )


def _full_name(s: Student) -> str:
    return f"{s.last_name} {s.first_name}".strip()


def _student_row(student: Student, record: AttendanceRecord | None) -> StudentRowOut:
    """Roʻyxatdagi bitta qator.

    Yozuv yoʻq boʻlsa `status` — `None`: davomat hali belgilanmagan
    degani. Buni "kelmadi" bilan aralashtirib boʻlmaydi.
    """
    return StudentRowOut(
        student_id=student.id,
        full_name=_full_name(student),
        status=record.status if record else None,  # type: ignore[arg-type]
        note=record.note if record else None,
    )


@router.get("/my-lessons", response_model=list[TeacherLessonOut])
async def my_lessons(
    user: CurrentUserDep,
    session: SessionDep,
    day: Annotated[date | None, Query(description="Sukut boʻyicha bugun")] = None,
) -> list[TeacherLessonOut]:
    """Ustozning shu kundagi darslari.

    Sana berilmasa MAHALLIY bugun olinadi (CLAUDE.md 3-qoida) — UTC kuni
    emas, aks holda ertalabki darslar kechagi kunga tushib qolardi.
    """
    kun = day or local_today()
    lessons = await attendance_service.teacher_lessons(session, user, kun)
    counts = await attendance_service.lesson_counts(session, lessons)
    return [
        TeacherLessonOut(
            id=lesson.id,
            class_name=lesson.school_class.name,
            subject_name=lesson.subject.name,
            period=lesson.period,
            room=lesson.room,
            starts_at=lesson.starts_at,
            ends_at=lesson.ends_at,
            topic=lesson.topic,
            marked=lesson.attendance_marked_at is not None,
            editable=attendance_service.can_teacher_edit(lesson),
            student_count=counts[lesson.id].students,
            present_count=counts[lesson.id].present,
        )
        for lesson in lessons
    ]


@router.get("/my-lessons/range", response_model=list[TeacherLessonOut])
async def my_lessons_range(
    user: CurrentUserDep,
    session: SessionDep,
    date_from: Annotated[date, Query(description="Boshlanish sanasi (mahalliy)")],
    date_to: Annotated[date, Query(description="Tugash sanasi (mahalliy)")],
) -> list[TeacherLessonOut]:
    """Ustozning oraliqdagi darslari — jadval ekrani uchun.

    Oy koʻrinishida 31 kun kerak; kunma-kun soʻrash N+1 boʻlardi.
    Sana MAHALLIY (Asia/Tashkent), `starts_at` esa UTC — frontend uni
    koʻrsatishda qayta oʻgiradi (CLAUDE.md 3-qoida).
    """
    if date_to < date_from:
        raise ValidationError("Tugash sanasi boshlanishidan keyin boʻlsin.")
    if (date_to - date_from).days > MAX_RANGE_DAYS:
        raise ValidationError(f"Oraliq {MAX_RANGE_DAYS} kundan oshmasin.")

    lessons = await attendance_service.teacher_lessons_range(session, user, date_from, date_to)
    counts = await attendance_service.lesson_counts(session, lessons)
    return [
        TeacherLessonOut(
            id=lesson.id,
            class_name=lesson.school_class.name,
            subject_name=lesson.subject.name,
            period=lesson.period,
            room=lesson.room,
            starts_at=lesson.starts_at,
            ends_at=lesson.ends_at,
            topic=lesson.topic,
            marked=lesson.attendance_marked_at is not None,
            editable=attendance_service.can_teacher_edit(lesson),
            student_count=counts[lesson.id].students,
            present_count=counts[lesson.id].present,
        )
        for lesson in lessons
    ]


@router.post("/generate", response_model=GenerationOut)
async def generate_lessons(
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
) -> GenerationOut:
    """Jadvaldan darslar yaratadi (T-012). Huquq: `schedule.manage`.

    Idempotent: qayta ishga tushirilsa mavjud darslar oʻtkazib
    yuboriladi va oʻzgartirilmaydi.
    """
    natija = await lesson_service.generate(
        session,
        actor=user,
        date_from=date_from,
        date_to=date_to,
        ip=request.client.host if request.client else None,
    )
    return GenerationOut(
        created=natija.created,
        skipped_existing=natija.skipped_existing,
        skipped_holidays=natija.skipped_holidays,
        missing_bells=natija.missing_bells,
        date_from=natija.date_from,
        date_to=natija.date_to,
    )


@router.post("/generate/term/{term_id}", response_model=GenerationOut)
async def generate_term_lessons(
    term_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> GenerationOut:
    """Butun chorak uchun darslar — T-012 ning asosiy stsenariysi."""
    natija = await lesson_service.generate_term(
        session,
        actor=user,
        term_id=term_id,
        ip=request.client.host if request.client else None,
    )
    return GenerationOut(
        created=natija.created,
        skipped_existing=natija.skipped_existing,
        skipped_holidays=natija.skipped_holidays,
        missing_bells=natija.missing_bells,
        date_from=natija.date_from,
        date_to=natija.date_to,
    )


@router.get("/lessons/{lesson_id}", response_model=LessonAttendanceOut)
async def lesson_attendance(
    lesson_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> LessonAttendanceOut:
    """Dars roʻyxati va mavjud davomat.

    Roʻyxat toʻliq qaytadi — davomat hali belgilanmagan boʻlsa
    `status` maydonlari `null`.
    """
    lesson, students, mavjud = await attendance_service.get_lesson_attendance(
        session, user, lesson_id
    )
    return LessonAttendanceOut(
        lesson_id=lesson.id,
        class_name=lesson.school_class.name,
        subject_name=lesson.subject.name,
        lesson_date=lesson.lesson_date,
        period=lesson.period,
        room=lesson.room,
        starts_at=lesson.starts_at,
        ends_at=lesson.ends_at,
        topic=lesson.topic,
        marked_at=lesson.attendance_marked_at,
        editable=user.is_staff_wide or attendance_service.can_teacher_edit(lesson),
        edit_deadline=attendance_service.edit_deadline(lesson),
        students=[_student_row(s, mavjud.get(s.id)) for s in students],
    )


@router.post("/lessons/{lesson_id}", response_model=AttendanceMarkOut)
async def mark(
    lesson_id: uuid.UUID,
    payload: AttendanceMarkIn,
    user: CurrentUserDep,
    session: SessionDep,
) -> AttendanceMarkOut:
    """Butun sinf davomatini saqlaydi (DAV-01).

    DAV-03: dars tugaganidan 24 soat oʻtgan boʻlsa ustoz `403` oladi,
    administrator esa oʻzgartira oladi. Har oʻzgarish `audit_log` ga
    eski va yangi qiymat bilan tushadi (DAV-07).
    """
    natija = await attendance_service.mark_attendance(
        session,
        user,
        lesson_id,
        [MarkRow(student_id=r.student_id, status=r.status, note=r.note) for r in payload.rows],
        topic=payload.topic,
    )
    return AttendanceMarkOut(
        created=natija.created, updated=natija.updated, unchanged=natija.unchanged
    )


@router.get("/stats", response_model=AttendanceStatOut)
async def stats(
    user: CurrentUserDep,
    session: SessionDep,
    student_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> AttendanceStatOut:
    """DAV-06: davomat foizi — oʻquvchi / sinf / fan / ustoz kesimida.

    Kesimlar birga ishlatiladi. Ota-ona faqat oʻz farzandi boʻyicha
    natija oladi — filtr soʻrov darajasida (X-1).
    """
    stat = await attendance_service.attendance_stats(
        session,
        user,
        student_id=student_id,
        class_id=class_id,
        subject_id=subject_id,
        teacher_id=teacher_id,
        date_from=date_from,
        date_to=date_to,
    )
    return _stat_out(stat)


@router.get("/classes/{class_id}/students", response_model=list[StudentStatOut])
async def class_students(
    class_id: uuid.UUID,
    user: CurrentUserDep,
    session: SessionDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StudentStatOut]:
    """Sinfdagi har bir oʻquvchining davomati (DAV-02, sinf jurnali)."""
    rows = await attendance_service.class_student_stats(
        session, user, class_id, date_from=date_from, date_to=date_to
    )
    return [
        StudentStatOut(student_id=s.id, full_name=_full_name(s), stat=_stat_out(stat))
        for s, stat in rows
    ]


# ────────────────── DAV-02: sinf rahbari kunlik ekrani ──────────────────


@router.get("/classes/{class_id}/day", response_model=ClassDayOut)
async def class_day(
    class_id: uuid.UUID,
    user: CurrentUserDep,
    session: SessionDep,
    on: Annotated[date | None, Query(description="Sana; boʻsh boʻlsa bugun")] = None,
) -> ClassDayOut:
    """Butun sinfning bir kunlik davomati — BITTA soʻrovda (DAV-02).

    Sinf rahbari oʻz sinfini, fan ustozi dars beradigan sinfini
    koʻradi. Boshqa ustozning darsi `editable: false` boʻlib keladi.
    """
    kun = on or local_today()
    d = await attendance_service.class_day(session, user, class_id, kun)
    return ClassDayOut(
        class_id=class_id,
        lesson_date=kun,
        students=[
            DayStudentOut(student_id=s.id, full_name=s.full_name) for s in d.students
        ],
        lessons=[
            DayLessonOut(
                lesson_id=dl.lesson.id,
                period=dl.lesson.period,
                subject_name=dl.subject_name,
                teacher_name=dl.teacher_name,
                room=dl.lesson.room,
                starts_at=dl.lesson.starts_at,
                ends_at=dl.lesson.ends_at,
                topic=dl.lesson.topic,
                editable=dl.editable,
            )
            for dl in d.lessons
        ],
        marks=[
            DayMarkOut(
                student_id=sid,
                lesson_id=lid,
                status=holat,
                note=d.notes.get((sid, lid)),
            )
            for (sid, lid), holat in d.marks.items()
        ],
    )


@router.post("/classes/{class_id}/day", response_model=AttendanceMarkOut)
async def mark_class_day(
    class_id: uuid.UUID,
    payload: ClassDayMarkIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AttendanceMarkOut:
    """Bir kunlik bir necha parani BITTA tranzaksiyada saqlaydi.

    Tahrirlash muddati oʻtgan dars roʻyxatga tushsa — butun soʻrov
    rad etiladi (`403`), jimgina oʻtkazib yuborilmaydi.
    """
    natija = await attendance_service.mark_day(
        session,
        user,
        class_id,
        payload.lesson_date,
        [
            attendance_service.DayEntry(
                lesson_id=e.lesson_id,
                rows=[
                    attendance_service.MarkRow(
                        student_id=r.student_id, status=r.status, note=r.note
                    )
                    for r in e.rows
                ],
            )
            for e in payload.entries
        ],
        ip=request.client.host if request.client else None,
    )
    return AttendanceMarkOut(
        created=natija.created, updated=natija.updated, unchanged=natija.unchanged
    )


# ─────────────── Sababli qoldirish arizasi (DAV-04) ───────────────


@router.post("/absence-requests", response_model=AbsenceOut, status_code=201)
async def create_absence_request(
    payload: AbsenceCreateIn,
    session: SessionDep,
    user: CurrentUserDep,
    request: Request,
) -> AbsenceOut:
    """Vasiy sababli qoldirish uchun ariza yuboradi.

    Boshqa oilaning bolasiga ariza yozilsa `403` (X-1).
    """
    ariza = await absence_service.create(
        session,
        user,
        student_id=payload.student_id,
        date_from=payload.date_from,
        date_to=payload.date_to,
        reason=payload.reason,
        file_id=payload.file_id,
        ip=_client_ip(request),
    )
    return _absence_out(await absence_service.get_request(session, user, ariza.id))


@router.get("/absence-requests", response_model=list[AbsenceOut])
async def list_absence_requests(
    session: SessionDep,
    user: CurrentUserDep,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    student_id: Annotated[uuid.UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AbsenceOut]:
    """Arizalar — koʻrish doirasi bilan kesilgan.

    Ilova havolasi bu yerda BERILMAYDI: roʻyxat har qatorga 15
    daqiqalik kalit tarqatmasligi kerak (X-7). Havola bitta arizani
    ochganda keladi.
    """
    rows = await absence_service.list_requests(
        session, user, status=status_filter, student_id=student_id, limit=limit
    )
    return [_absence_out(r) for r in rows]


@router.get("/absence-requests/{request_id}", response_model=AbsenceOut)
async def get_absence_request(
    request_id: uuid.UUID, session: SessionDep, user: CurrentUserDep
) -> AbsenceOut:
    """Bitta ariza — ilovaga imzolangan havola bilan."""
    return _absence_out(await absence_service.get_request(session, user, request_id))


@router.post("/absence-requests/{request_id}/decide", response_model=AbsenceOut)
async def decide_absence_request(
    request_id: uuid.UUID,
    payload: AbsenceDecideIn,
    session: SessionDep,
    user: CurrentUserDep,
    request: Request,
) -> AbsenceOut:
    """Sinf rahbari tasdiqlaydi yoki rad etadi.

    Tasdiqlanganda oʻsha kunlardagi darslar «sababli» ga oʻtadi —
    ustoz «keldi» degan darslardan tashqari.
    """
    return _absence_out(
        await absence_service.decide(
            session,
            user,
            request_id=request_id,
            approve=payload.approve,
            note=payload.note,
            ip=_client_ip(request),
        )
    )


@router.post("/absence-requests/{request_id}/cancel", response_model=AbsenceOut)
async def cancel_absence_request(
    request_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
    request: Request,
) -> AbsenceOut:
    """Vasiy oʻz arizasini bekor qiladi — qaror chiqmagunicha."""
    return _absence_out(
        await absence_service.cancel(
            session, user, request_id=request_id, ip=_client_ip(request)
        )
    )
