"""Oʻquv boʻlimi endpointlari: imtihonlar va dars rejalari.

Kirish router darajasida — direktor routeri bilan bir xil uslub:
oʻquv boʻlimi, administrator va super administrator. Ustoz va ota-ona
bu boʻlimga kira olmaydi (7-qoida).
"""

import uuid

from fastapi import APIRouter, Depends, Request

from app.api.v1.deps import CurrentUserDep, require_roles
from app.core.db import SessionDep
from app.models import RoleName
from app.schemas.exams import (
    EnterResultsIn,
    ExamCreateIn,
    ExamOut,
    ExamResultRowOut,
    ExamStatsOut,
    PlanCreateIn,
    PlanOut,
    PlanStatusIn,
)
from app.services import exam_service

router = APIRouter(
    prefix="/exams",
    tags=["exams"],
    dependencies=[
        Depends(
            require_roles(
                RoleName.ACADEMIC.value,
                RoleName.ADMIN.value,
                RoleName.SUPERADMIN.value,
            )
        )
    ],
)


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _exam_out(row: exam_service.ExamRow) -> ExamOut:
    return ExamOut(
        id=row.exam.id,
        title=row.exam.title,
        kind=row.exam.kind,
        status=row.exam.status,
        subject_id=row.exam.subject_id,
        subject_name=row.subject_name,
        class_id=row.exam.class_id,
        class_name=row.class_name,
        exam_date=row.exam.exam_date,
        stats=ExamStatsOut(
            entered=row.stats.entered,
            absent=row.stats.absent,
            average=row.stats.average,
            highest=row.stats.highest,
            lowest=row.stats.lowest,
            pass_rate=row.stats.pass_rate,
        ),
    )


@router.get("", response_model=list[ExamOut])
async def list_exams(user: CurrentUserDep, session: SessionDep) -> list[ExamOut]:
    rows = await exam_service.list_exams(session)
    return [_exam_out(r) for r in rows]


@router.post("", response_model=ExamOut, status_code=201)
async def create_exam(
    payload: ExamCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> ExamOut:
    exam = await exam_service.create_exam(
        session,
        actor=user,
        title=payload.title,
        kind=payload.kind,
        subject_id=payload.subject_id,
        class_id=payload.class_id,
        exam_date=payload.exam_date,
        ip=_client_ip(request),
    )
    rows = await exam_service.list_exams(session)
    return _exam_out(next(r for r in rows if r.exam.id == exam.id))


@router.post("/{exam_id}/status", response_model=ExamOut)
async def set_status(
    exam_id: uuid.UUID,
    status: str,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> ExamOut:
    """rejada → oʻtkazildi | bekor. Oʻtkazilgan imtihon qaytmaydi."""
    await exam_service.set_exam_status(
        session, actor=user, exam_id=exam_id, status=status, ip=_client_ip(request)
    )
    rows = await exam_service.list_exams(session)
    return _exam_out(next(r for r in rows if r.exam.id == exam_id))


@router.get("/{exam_id}/results", response_model=list[ExamResultRowOut])
async def results(
    exam_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[ExamResultRowOut]:
    """Sinfning toʻliq roʻyxati — natijasi hali yoʻqlar ham koʻrinadi."""
    rows = await exam_service.exam_results(session, exam_id)
    return [
        ExamResultRowOut(
            student_id=r.student_id,
            student_name=r.student_name,
            score=r.score,
            absent=r.absent,
            recorded=r.recorded,
        )
        for r in rows
    ]


@router.put("/{exam_id}/results", status_code=204)
async def enter_results(
    exam_id: uuid.UUID,
    payload: EnterResultsIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> None:
    """Ballar (0–100, upsert). Imtihon «oʻtkazildi» holatiga oʻtadi."""
    await exam_service.enter_results(
        session,
        actor=user,
        exam_id=exam_id,
        scores=[
            exam_service.ScoreIn(student_id=s.student_id, score=s.score, absent=s.absent)
            for s in payload.scores
        ],
        ip=_client_ip(request),
    )


# ─────────────────────────── Dars rejalari ───────────────────────────


def _plan_out(row: exam_service.PlanRow) -> PlanOut:
    return PlanOut(
        id=row.plan.id,
        teacher_id=row.plan.teacher_id,
        teacher_name=row.teacher_name,
        subject_name=row.subject_name,
        class_name=row.class_name,
        period=row.plan.period,
        status=row.plan.status,
        comment=row.plan.comment,
    )


@router.get("/plans", response_model=list[PlanOut])
async def list_plans(user: CurrentUserDep, session: SessionDep) -> list[PlanOut]:
    rows = await exam_service.list_plans(session)
    return [_plan_out(r) for r in rows]


@router.post("/plans", response_model=PlanOut, status_code=201)
async def create_plan(
    payload: PlanCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> PlanOut:
    plan = await exam_service.create_plan(
        session,
        actor=user,
        teacher_id=payload.teacher_id,
        subject_id=payload.subject_id,
        class_id=payload.class_id,
        period=payload.period,
        ip=_client_ip(request),
    )
    rows = await exam_service.list_plans(session)
    return _plan_out(next(r for r in rows if r.plan.id == plan.id))


@router.post("/plans/{plan_id}/status", response_model=PlanOut)
async def set_plan_status(
    plan_id: uuid.UUID,
    payload: PlanStatusIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> PlanOut:
    """Tasdiqlash yoki qaytarish. Qaytarishda sabab majburiy."""
    await exam_service.set_plan_status(
        session,
        actor=user,
        plan_id=plan_id,
        status=payload.status,
        comment=payload.comment,
        ip=_client_ip(request),
    )
    rows = await exam_service.list_plans(session)
    return _plan_out(next(r for r in rows if r.plan.id == plan_id))
