"""Soʻrovnoma endpointlari.

Boshqarish `surveys.manage` bilan; javob berish — ota-ona, va u faqat
farzandiga dars beradigan ustozlarni koʻradi (servis tekshiradi).
"""

import uuid

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.surveys import (
    ActiveSurveyOut,
    RespondIn,
    SurveyCommentOut,
    SurveyCreateIn,
    SurveyOut,
    SurveyQuestionAvgOut,
    SurveyQuestionOut,
    TeacherResultOut,
    TeacherToRateOut,
)
from app.services import survey_service

router = APIRouter(prefix="/surveys", tags=["surveys"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _survey_out(row: survey_service.SurveyRow) -> SurveyOut:
    return SurveyOut(
        id=row.survey.id,
        title=row.survey.title,
        status=row.survey.status,
        questions=[
            SurveyQuestionOut(id=q.id, text=q.text, position=q.position) for q in row.questions
        ],
        response_count=row.response_count,
        created_at=row.survey.created_at,
    )


@router.get("", response_model=list[SurveyOut])
async def list_surveys(user: CurrentUserDep, session: SessionDep) -> list[SurveyOut]:
    rows = await survey_service.list_surveys(session, user)
    return [_survey_out(r) for r in rows]


@router.post("", response_model=SurveyOut, status_code=201)
async def create(
    payload: SurveyCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> SurveyOut:
    survey = await survey_service.create(
        session,
        actor=user,
        title=payload.title,
        questions=payload.questions,
        ip=_client_ip(request),
    )
    rows = await survey_service.list_surveys(session, user)
    return _survey_out(next(r for r in rows if r.survey.id == survey.id))


@router.post("/{survey_id}/status", response_model=SurveyOut)
async def set_status(
    survey_id: uuid.UUID,
    status: str,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> SurveyOut:
    """draft → active → closed. Orqaga yoʻl yoʻq."""
    await survey_service.set_status(
        session, actor=user, survey_id=survey_id, status=status, ip=_client_ip(request)
    )
    rows = await survey_service.list_surveys(session, user)
    return _survey_out(next(r for r in rows if r.survey.id == survey_id))


@router.get("/active", response_model=ActiveSurveyOut)
async def active(user: CurrentUserDep, session: SessionDep) -> ActiveSurveyOut:
    """Ota-ona uchun: faol soʻrovnoma va baholanadigan ustozlar."""
    survey = await survey_service.active_survey(session)
    if survey is None:
        return ActiveSurveyOut(survey=None, teachers=[])

    teachers = await survey_service.teachers_for_parent(session, user, survey.id)
    savollar = await survey_service.questions_of(session, survey.id)
    return ActiveSurveyOut(
        survey=SurveyOut(
            id=survey.id,
            title=survey.title,
            status=survey.status,
            questions=[
                SurveyQuestionOut(id=q.id, text=q.text, position=q.position) for q in savollar
            ],
            response_count=0,
            created_at=survey.created_at,
        ),
        teachers=[
            TeacherToRateOut(
                teacher_id=t.teacher_id,
                teacher_name=t.teacher_name,
                subjects=t.subjects,
                class_name=t.class_name,
                answered=t.answered,
            )
            for t in teachers
        ],
    )


@router.post("/{survey_id}/respond", status_code=201)
async def respond(
    survey_id: uuid.UUID,
    payload: RespondIn,
    user: CurrentUserDep,
    session: SessionDep,
) -> dict[str, bool]:
    """Javob anonim jamlanadi; bitta ustozga bir marta."""
    await survey_service.respond(
        session,
        actor=user,
        survey_id=survey_id,
        teacher_id=payload.teacher_id,
        scores=payload.scores,
        comment=payload.comment,
    )
    return {"ok": True}


@router.get("/{survey_id}/results", response_model=list[TeacherResultOut])
async def results(
    survey_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[TeacherResultOut]:
    rows = await survey_service.results(session, user, survey_id)
    return [
        TeacherResultOut(
            teacher_id=r.teacher_id,
            teacher_name=r.teacher_name,
            response_count=r.response_count,
            average=r.average,
            distribution=r.distribution,
            criteria=[SurveyQuestionAvgOut(text=c.text, average=c.average) for c in r.criteria],
            comments=[SurveyCommentOut(class_name=k, text=m) for k, m in r.comments],
        )
        for r in rows
    ]
