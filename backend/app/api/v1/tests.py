"""Test endpointlari (TST-01…TST-05).

Ikki koʻrinish qatʼiy ajratilgan:

  `/tests/{id}/questions`          — USTOZ, toʻgʻri javob bilan
  `/tests/{id}/attempts` (POST)    — OʻQUVCHI, toʻgʻri javobsiz

Ikkinchisining `response_model` i `QuestionForStudentOut` — unda
`is_correct` maydoni umuman yoʻq. Servis ham ustunni soʻramaydi:
himoya ikki qatlamda (X-5).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Request, Response, UploadFile, status

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.core.exceptions import ValidationError
from app.schemas.tests import (
    AttemptOut,
    AttemptStartOut,
    OptionForStudentOut,
    OptionOut,
    QuestionForStudentOut,
    QuestionImportOut,
    QuestionIn,
    QuestionOut,
    SubmitAttemptIn,
    TestCreateIn,
    TestOut,
    TestStatusIn,
)
from app.services import test_service

router = APIRouter(prefix="/tests", tags=["tests"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
#: Savollar fayli — matn, 2 MB dan katta boʻlishi shubhali.
MAX_QUESTION_UPLOAD = 2 * 1024 * 1024


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _test_out(t: test_service.TestRow) -> TestOut:
    return TestOut(
        id=t.id,
        class_id=t.class_id,
        class_name=t.class_name,
        subject_id=t.subject_id,
        subject_name=t.subject_name,
        title=t.title,
        description=t.description,
        status=t.status,
        duration_minutes=t.duration_minutes,
        attempts_allowed=t.attempts_allowed,
        shuffle=t.shuffle,
        opens_at=t.opens_at,
        closes_at=t.closes_at,
        question_count=t.question_count,
        max_score=t.max_score,
        submitted_count=t.submitted_count,
        total_students=t.total_students,
        average_percent=t.average_percent,
    )


def _question_out(q: test_service.QuestionRow) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        position=q.position,
        text=q.text,
        kind=q.kind,
        points=q.points,
        options=[OptionOut(id=o.id, text=o.text, is_correct=bool(o.is_correct)) for o in q.options],
    )


def _student_question_out(q: test_service.QuestionRow) -> QuestionForStudentOut:
    return QuestionForStudentOut(
        id=q.id,
        position=q.position,
        text=q.text,
        kind=q.kind,
        points=q.points,
        options=[OptionForStudentOut(id=o.id, text=o.text) for o in q.options],
    )


def _attempt_out(a: test_service.AttemptRow) -> AttemptOut:
    return AttemptOut(
        id=a.id,
        test_id=a.test_id,
        student_id=a.student_id,
        full_name=a.full_name,
        attempt_no=a.attempt_no,
        started_at=a.started_at,
        submitted_at=a.submitted_at,
        score=a.score,
        max_score=a.max_score,
        percent=a.percent,
    )


# ─────────────────────────── Ustoz ───────────────────────────


@router.get("", response_model=list[TestOut])
async def my_tests(
    user: CurrentUserDep, session: SessionDep, class_id: uuid.UUID | None = None
) -> list[TestOut]:
    """Ustozning testlari (TST-03)."""
    rows = await test_service.teacher_tests(session, user, class_id=class_id)
    return [_test_out(r) for r in rows]


@router.post("", response_model=TestOut, status_code=201)
async def create_test(
    payload: TestCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> TestOut:
    """Yangi test — qoralama holatida (TST-03)."""
    row = await test_service.create_test(
        session,
        user,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        title=payload.title,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        attempts_allowed=payload.attempts_allowed,
        shuffle=payload.shuffle,
        opens_at=payload.opens_at,
        closes_at=payload.closes_at,
        ip=_client_ip(request),
    )
    return _test_out(row)


@router.put("/{test_id}/status", response_model=TestOut)
async def set_status(
    test_id: uuid.UUID,
    payload: TestStatusIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> TestOut:
    """Qoralama → eʼlon → yakunlangan. Savolsiz test eʼlon qilinmaydi."""
    row = await test_service.set_status(
        session, user, test_id, payload.status, ip=_client_ip(request)
    )
    return _test_out(row)


@router.post("/{test_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_test(
    test_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Oʻchirish YOʻQ (CLAUDE.md 1-qoida)."""
    await test_service.archive_test(session, user, test_id, ip=_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{test_id}/questions", response_model=list[QuestionOut])
async def questions(
    test_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[QuestionOut]:
    """USTOZ koʻrinishi — toʻgʻri javoblar bilan (TST-01)."""
    rows = await test_service.teacher_questions(session, user, test_id)
    return [_question_out(q) for q in rows]


@router.post("/{test_id}/questions", response_model=QuestionOut, status_code=201)
async def add_question(
    test_id: uuid.UUID,
    payload: QuestionIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> QuestionOut:
    """Savol qoʻshadi (TST-01, TST-02). Faqat qoralama testga."""
    row = await test_service.add_question(
        session,
        user,
        test_id,
        text=payload.text,
        kind=payload.kind,
        points=payload.points,
        options=[
            test_service.OptionInput(text=o.text, is_correct=o.is_correct) for o in payload.options
        ],
        ip=_client_ip(request),
    )
    return _question_out(row)


@router.post("/questions/{question_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_question(
    question_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Savolni roʻyxatdan chiqaradi — oʻchirmaydi."""
    await test_service.archive_question(session, user, question_id, ip=_client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{test_id}/results", response_model=list[AttemptOut])
async def results(
    test_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[AttemptOut]:
    """TST-05: natijalar."""
    rows = await test_service.test_results(session, user, test_id)
    return [_attempt_out(a) for a in rows]


# ─────────────────────── Oʻquvchi va ota-ona ───────────────────────


@router.get("/students/{student_id}/available", response_model=list[TestOut])
async def available(
    student_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[TestOut]:
    """Oʻquvchiga ochiq testlar. Faqat oʻz sinfiniki (X-1)."""
    rows = await test_service.available_tests(session, user, student_id)
    return [_test_out(r) for r in rows]


@router.post("/{test_id}/students/{student_id}/start", response_model=AttemptStartOut)
async def start(
    test_id: uuid.UUID,
    student_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AttemptStartOut:
    """Urinishni boshlaydi va savollarni qaytaradi (TST-04).

    Javoblar TOʻGʻRI BELGISIZ keladi. Tugallanmagan urinish bor boʻlsa
    oʻshanisi davom etadi — sahifa yangilanganda urinish sarflanmasin.
    """
    attempt, savollar = await test_service.start_attempt(
        session, user, test_id, student_id, ip=_client_ip(request)
    )
    test = await session.get(test_service.Test, test_id)
    return AttemptStartOut(
        attempt_id=attempt.id,
        attempt_no=attempt.attempt_no,
        attempts_allowed=test.attempts_allowed if test else 1,
        started_at=attempt.started_at,
        duration_minutes=test.duration_minutes if test else 0,
        closes_at=test.closes_at if test else attempt.started_at,
        questions=[_student_question_out(q) for q in savollar],
    )


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptOut)
async def submit(
    attempt_id: uuid.UUID,
    payload: SubmitAttemptIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AttemptOut:
    """Javoblarni yuboradi. Ball SERVERDA hisoblanadi (TST-04)."""
    row = await test_service.submit_attempt(
        session,
        user,
        attempt_id,
        [
            test_service.AnswerInput(question_id=a.question_id, selected=a.selected)
            for a in payload.answers
        ],
        ip=_client_ip(request),
    )
    return _attempt_out(row)


@router.get("/students/{student_id}/attempts", response_model=list[AttemptOut])
async def student_attempts(
    student_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[AttemptOut]:
    """Oʻquvchining natijalari (TST-05). Ota-ona faqat oʻz farzandiniki."""
    rows = await test_service.student_attempts(session, user, student_id)
    return [_attempt_out(a) for a in rows]


# ─────────────── Savollarni Excel'dan import (TST-06) ───────────────


@router.get("/questions/template")
async def question_template(user: CurrentUserDep) -> Response:
    """Savollar uchun boʻsh Excel shablon.

    Savol turi ustuni ATAYLAB yoʻq — u toʻgʻri javoblar sonidan
    kelib chiqadi (yoʻriqnoma varagʻida yozilgan).
    """
    return Response(
        content=test_service.build_question_template(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="savollar-shablon.xlsx"'},
    )


@router.post("/{test_id}/questions/import", response_model=QuestionImportOut, status_code=201)
async def import_questions(
    test_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
    file: Annotated[UploadFile, File()],
) -> QuestionImportOut:
    """Savollarni shablondan ommaviy import qiladi.

    Savollar mavjudlariga QOʻSHILADI. Buzuq qator butun importni
    toʻxtatmaydi — u tashlanadi va ogohlantirishda qaytadi.
    """
    data = await file.read()
    if len(data) > MAX_QUESTION_UPLOAD:
        raise ValidationError("Fayl 2 MB dan oshmasin.")
    natija = await test_service.import_questions(
        session,
        user,
        test_id,
        data=data,
        ip=request.client.host if request.client else None,
    )
    return QuestionImportOut(added=natija.added, warnings=natija.warnings)
