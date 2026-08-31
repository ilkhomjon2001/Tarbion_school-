"""Jurnal va uy vazifasi endpointlari (JUR-01…JUR-07, UYV-01…UYV-07).

Routerda rol darvozasi yoʻq: kim nima qila olishini `grade_service` va
`homework_service` hal qiladi va tekshiruv SOʻROV darajasida boʻladi
(X-1). Ustoz oʻz sinfi va oʻz fani bilan cheklanadi, ota-ona faqat oʻz
farzandini koʻradi.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Query, Request, Response, status

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.journal import (
    ClassJournalOut,
    ClassJournalRowOut,
    GradeOut,
    GradeSubmissionIn,
    HomeworkCreateIn,
    HomeworkOut,
    JournalStudentOut,
    LessonGradesIn,
    LessonJournalOut,
    ReturnSubmissionIn,
    StudentHomeworkOut,
    StudentSubjectGradesOut,
    SubmissionListOut,
    SubmissionOut,
    SubmitIn,
)
from app.services import grade_service, homework_service

router = APIRouter(prefix="/journal", tags=["journal"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _grade_out(g: grade_service.GradeRow) -> GradeOut:
    return GradeOut(
        id=g.id,
        student_id=g.student_id,
        value=g.value,
        max_value=g.max_value,
        kind=g.kind,
        weight=g.weight,
        comment=g.comment,
        lesson_id=g.lesson_id,
        lesson_date=g.lesson_date,
    )


def _journal_out(j: grade_service.LessonJournal) -> LessonJournalOut:
    return LessonJournalOut(
        lesson_id=j.lesson_id,
        class_name=j.class_name,
        subject_name=j.subject_name,
        lesson_date=j.lesson_date,
        period=j.period,
        topic=j.topic,
        editable=j.editable,
        max_value=j.max_value,
        students=[
            JournalStudentOut(
                student_id=s.student_id,
                full_name=s.full_name,
                attendance=s.attendance,
                gradable=s.gradable,
                block_reason=s.block_reason,
                grade=_grade_out(s.grade) if s.grade else None,
            )
            for s in j.students
        ],
    )


# ─────────────────────────── Dars jurnali ───────────────────────────


@router.get("/lessons/{lesson_id}", response_model=LessonJournalOut)
async def lesson_journal(
    lesson_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> LessonJournalOut:
    """Darsning jurnali — oʻquvchi, davomati va bahosi.

    Davomat bilan birga qaytadi: kelmagan oʻquvchiga baho qoʻyilmaydi
    va ustoz buni oʻsha zahoti koʻrib turadi.
    """
    return _journal_out(await grade_service.lesson_journal(session, user, lesson_id))


@router.post("/lessons/{lesson_id}", response_model=LessonJournalOut)
async def set_grades(
    lesson_id: uuid.UUID,
    payload: LessonGradesIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> LessonJournalOut:
    """Darsga baho qoʻyadi (JUR-01).

    Ustoz faqat oʻzi dars beradigan sinfda va faqat oʻz fanidan baho
    qoʻyadi. Boshqa kunning bahosini oʻzgartira olmaydi — DAV-03
    oynasi baho uchun ham amal qiladi.
    """
    natija = await grade_service.set_lesson_grades(
        session,
        user,
        lesson_id,
        [
            grade_service.GradeInput(student_id=r.student_id, value=r.value, comment=r.comment)
            for r in payload.rows
        ],
        kind=payload.kind,
        weight=payload.weight,
        ip=_client_ip(request),
    )
    return _journal_out(natija)


@router.get("/classes/{class_id}", response_model=ClassJournalOut)
async def class_journal(
    class_id: uuid.UUID,
    user: CurrentUserDep,
    session: SessionDep,
    subject_id: uuid.UUID,
    date_from: date,
    date_to: date,
) -> ClassJournalOut:
    """Sinf × fan jurnali sana oraligʻida (JUR-01).

    `shows_average` — oʻrtacha koʻrsatiladimi. Fan ustoziga `false`
    (4-qoida): yakuniy koʻrsatkich sinf rahbari va oʻquv boʻlimiga.
    """
    j = await grade_service.class_journal(
        session,
        user,
        class_id=class_id,
        subject_id=subject_id,
        date_from=date_from,
        date_to=date_to,
    )
    return ClassJournalOut(
        class_id=j.class_id,
        subject_id=j.subject_id,
        dates=j.dates,
        shows_average=j.shows_average,
        rows=[
            ClassJournalRowOut(
                student_id=r.student_id,
                full_name=r.full_name,
                grades=r.grades,
                average=r.average,
            )
            for r in j.rows
        ],
    )


@router.get("/students/{student_id}/grades", response_model=list[StudentSubjectGradesOut])
async def student_grades(
    student_id: uuid.UUID,
    user: CurrentUserDep,
    session: SessionDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StudentSubjectGradesOut]:
    """Oʻquvchining fanlar kesimidagi baholari (JUR-05).

    Ota-ona faqat oʻz farzandini oladi — kesim soʻrov darajasida (X-1).
    """
    rows = await grade_service.student_grades(
        session, user, student_id, date_from=date_from, date_to=date_to
    )
    return [
        StudentSubjectGradesOut(
            subject_id=r.subject_id,
            subject_name=r.subject_name,
            grades=[_grade_out(g) for g in r.grades],
            average=r.average,
        )
        for r in rows
    ]


@router.get("/classes/{class_id}/averages", response_model=dict[str, float])
async def class_averages(
    class_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> dict[str, float]:
    """Sinfning fanlar boʻyicha oʻrtachasi (JUR-06). Fan ustoziga `403`."""
    return await grade_service.class_average_by_subject(session, user, class_id=class_id)


# ─────────────────────────── Uy vazifasi ───────────────────────────


def _hw_out(h: homework_service.HomeworkRow) -> HomeworkOut:
    return HomeworkOut(
        id=h.id,
        class_id=h.class_id,
        class_name=h.class_name,
        subject_id=h.subject_id,
        subject_name=h.subject_name,
        title=h.title,
        description=h.description,
        due_at=h.due_at,
        allow_late=h.allow_late,
        max_score=h.max_score,
        weight=h.weight,
        total_count=h.total_count,
        submitted_count=h.submitted_count,
        graded_count=h.graded_count,
    )


def _sub_out(s: homework_service.SubmissionRow) -> SubmissionOut:
    return SubmissionOut(
        id=s.id,
        student_id=s.student_id,
        full_name=s.full_name,
        status=s.status,
        submitted_at=s.submitted_at,
        answer_text=s.answer_text,
        attachment_name=s.attachment_name,
        score=s.score,
        teacher_comment=s.teacher_comment,
    )


@router.get("/homework", response_model=list[HomeworkOut])
async def my_homework(
    user: CurrentUserDep,
    session: SessionDep,
    class_id: uuid.UUID | None = None,
    limit: int = Query(default=100, le=200),
) -> list[HomeworkOut]:
    """Ustozning bergan vazifalari (UYV-06)."""
    rows = await homework_service.teacher_homework(session, user, class_id=class_id, limit=limit)
    return [_hw_out(r) for r in rows]


@router.post("/homework", response_model=HomeworkOut, status_code=201)
async def create_homework(
    payload: HomeworkCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> HomeworkOut:
    """Yangi uy vazifasi (UYV-01).

    Sinf oʻquvchilarining har biri uchun yozuv yaratiladi — "kim
    topshirmadi" shundan chiqadi.
    """
    row = await homework_service.create_homework(
        session,
        user,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        title=payload.title,
        description=payload.description,
        due_at=payload.due_at,
        lesson_id=payload.lesson_id,
        allow_late=payload.allow_late,
        max_score=payload.max_score,
        weight=payload.weight,
        ip=_client_ip(request),
    )
    return _hw_out(row)


@router.post("/homework/{homework_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_homework(
    homework_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Olib tashlaydi. Oʻchirish YOʻQ (CLAUDE.md 1-qoida)."""
    await homework_service.archive_homework(session, user, homework_id, ip=_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/homework/{homework_id}/submissions", response_model=SubmissionListOut)
async def submissions(
    homework_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> SubmissionListOut:
    """Vazifa boʻyicha oʻquvchilar ishlari (UYV-03)."""
    homework, rows = await homework_service.submissions(session, user, homework_id)
    return SubmissionListOut(
        homework_id=homework.id,
        title=homework.title,
        max_score=homework.max_score,
        due_at=homework.due_at,
        rows=[_sub_out(r) for r in rows],
    )


@router.post("/submissions/{submission_id}/grade", response_model=SubmissionOut)
async def grade_submission(
    submission_id: uuid.UUID,
    payload: GradeSubmissionIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> SubmissionOut:
    """Ishni baholaydi (UYV-03).

    Baho jurnalga ham tushadi — chorak bahosi bitta manbadan
    hisoblanishi uchun (JUR-04).
    """
    row = await homework_service.grade_submission(
        session,
        user,
        submission_id,
        score=payload.score,
        comment=payload.comment,
        ip=_client_ip(request),
    )
    return _sub_out(row)


@router.post("/submissions/{submission_id}/return", response_model=SubmissionOut)
async def return_submission(
    submission_id: uuid.UUID,
    payload: ReturnSubmissionIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> SubmissionOut:
    """Qayta ishlash uchun qaytaradi (UYV-03). Izoh majburiy."""
    row = await homework_service.return_submission(
        session, user, submission_id, comment=payload.comment, ip=_client_ip(request)
    )
    return _sub_out(row)


@router.get("/students/{student_id}/homework", response_model=list[StudentHomeworkOut])
async def student_homework(
    student_id: uuid.UUID,
    user: CurrentUserDep,
    session: SessionDep,
    only_open: bool = False,
) -> list[StudentHomeworkOut]:
    """Oʻquvchining vazifalari (UYV-02, UYV-07)."""
    rows = await homework_service.student_homework(session, user, student_id, only_open=only_open)
    return [
        StudentHomeworkOut(
            submission_id=r.submission_id,
            homework_id=r.homework_id,
            subject_name=r.subject_name,
            title=r.title,
            description=r.description,
            due_at=r.due_at,
            status=r.status,
            submitted_at=r.submitted_at,
            score=r.score,
            max_score=r.max_score,
            teacher_comment=r.teacher_comment,
        )
        for r in rows
    ]


@router.post("/submissions/{submission_id}/submit", response_model=StudentHomeworkOut)
async def submit(
    submission_id: uuid.UUID,
    payload: SubmitIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentHomeworkOut:
    """Oʻquvchi ishini topshiradi (UYV-02).

    Muddatdan keyin topshirilsa `late` (UYV-04).
    """
    r = await homework_service.submit(
        session, user, submission_id, answer_text=payload.answer_text, ip=_client_ip(request)
    )
    return StudentHomeworkOut(
        submission_id=r.submission_id,
        homework_id=r.homework_id,
        subject_name=r.subject_name,
        title=r.title,
        description=r.description,
        due_at=r.due_at,
        status=r.status,
        submitted_at=r.submitted_at,
        score=r.score,
        max_score=r.max_score,
        teacher_comment=r.teacher_comment,
    )
