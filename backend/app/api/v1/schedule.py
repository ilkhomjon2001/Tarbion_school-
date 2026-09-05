"""Dars jadvali endpointlari (T-011). TZ: ADM-08, ADM-09.

Oʻqish kirgan har kimga ochiq — jadval maktabda devorga osiladi.
Yozish `schedule.manage` huquqini talab qiladi.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.schedule import (
    LessonCancelIn,
    LessonExceptionOut,
    LessonMoveIn,
    LessonSubstituteIn,
    ScheduleEntryIn,
    ScheduleEntryOut,
    ScheduleEntryUpdateIn,
    TeacherLoadOut,
)
from app.services import lesson_service, schedule_service

router = APIRouter(prefix="/schedule", tags=["schedule"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _out(row: schedule_service.ScheduleRow) -> ScheduleEntryOut:
    return ScheduleEntryOut(
        id=row.id,
        class_id=row.class_id,
        class_name=row.class_name,
        subject_id=row.subject_id,
        subject_name=row.subject_name,
        teacher_id=row.teacher_id,
        teacher_name=row.teacher_name,
        weekday=row.weekday,
        period=row.period,
        room=row.room,
    )


@router.get("/entries", response_model=list[ScheduleEntryOut])
async def entries(
    user: CurrentUserDep,
    session: SessionDep,
    class_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
) -> list[ScheduleEntryOut]:
    """Joriy oʻquv yili jadvali — sinf yoki ustoz kesimida (ADM-08)."""
    rows = await schedule_service.list_schedule(session, class_id=class_id, teacher_id=teacher_id)
    return [_out(r) for r in rows]


@router.post("/entries", response_model=ScheduleEntryOut, status_code=201)
async def add_entry(
    payload: ScheduleEntryIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> ScheduleEntryOut:
    """Jadvalga dars qoʻshadi.

    Ustoz, xona yoki sinf shu vaqtda band boʻlsa `409` va band qilgan
    dars nomi qaytadi (ADM-09).
    """
    row = await schedule_service.add_entry(
        session,
        actor=user,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        weekday=payload.weekday,
        period=payload.period,
        room=payload.room,
        ip=_client_ip(request),
    )
    return _out(row)


@router.patch("/entries/{entry_id}", response_model=ScheduleEntryOut)
async def update_entry(
    entry_id: uuid.UUID,
    payload: ScheduleEntryUpdateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> ScheduleEntryOut:
    """Ustoz yoki xonani almashtiradi (ADM-10 ning jadval tomoni)."""
    row = await schedule_service.update_entry(
        session,
        actor=user,
        entry_id=entry_id,
        teacher_id=payload.teacher_id,
        room=payload.room,
        ip=_client_ip(request),
    )
    return _out(row)


@router.post("/entries/{entry_id}/archive", status_code=status.HTTP_204_NO_CONTENT)
async def archive_entry(
    entry_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Jadvaldan chiqaradi. Oʻtgan darslar va davomat qolaveradi."""
    await schedule_service.archive_entry(
        session, actor=user, entry_id=entry_id, ip=_client_ip(request)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/load", response_model=list[TeacherLoadOut])
async def teacher_load(user: CurrentUserDep, session: SessionDep) -> list[TeacherLoadOut]:
    """Ustozlarning haftalik yuklamasi — jadvaldan hisoblanadi."""
    rows = await schedule_service.teacher_load(session)
    return [
        TeacherLoadOut(
            teacher_id=r.teacher_id,
            full_name=r.full_name,
            subjects=r.subjects,
            weekly_hours=r.weekly_hours,
            classes=r.classes,
        )
        for r in rows
    ]


# ─────────────── Jadval istisnolari (ADM-10) ───────────────
#
# Istisno KONKRET darsga tegishli, jadval yozuviga emas: «5-sentabr
# 3-para» oʻzgaradi, dushanbaning hamma 3-parasi emas. Shuning uchun
# yoʻl `/schedule/lessons/{lesson_id}/...`.


@router.get("/exceptions", response_model=list[LessonExceptionOut])
async def list_exceptions(
    session: SessionDep,
    user: CurrentUserDep,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
) -> list[LessonExceptionOut]:
    """Oraliqdagi bekor qilingan va ustozi almashtirilgan darslar."""
    rows = await lesson_service.list_exceptions(
        session, user, date_from=date_from, date_to=date_to
    )
    return [
        LessonExceptionOut(
            lesson_id=r.lesson_id,
            lesson_date=r.lesson_date,
            period=r.period,
            class_name=r.class_name,
            subject_name=r.subject_name,
            teacher_name=r.teacher_name,
            room=r.room,
            is_cancelled=r.is_cancelled,
            cancel_reason=r.cancel_reason,
            is_substituted=r.is_substituted,
            exception_note=r.exception_note,
        )
        for r in rows
    ]


@router.post("/lessons/{lesson_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_lesson(
    lesson_id: uuid.UUID,
    payload: LessonCancelIn,
    session: SessionDep,
    user: CurrentUserDep,
    request: Request,
) -> Response:
    """Darsni bekor qiladi. Dars oʻchirilmaydi — «bekor qilingan» boʻlib qoladi."""
    await lesson_service.cancel_lesson(
        session,
        user,
        lesson_id=lesson_id,
        reason=payload.reason,
        ip=_client_ip(request),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/lessons/{lesson_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_lesson(
    lesson_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUserDep,
    request: Request,
) -> Response:
    """Bekor qilishni qaytaradi."""
    await lesson_service.restore_lesson(
        session, user, lesson_id=lesson_id, ip=_client_ip(request)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/lessons/{lesson_id}/substitute", status_code=status.HTTP_204_NO_CONTENT)
async def substitute_teacher(
    lesson_id: uuid.UUID,
    payload: LessonSubstituteIn,
    session: SessionDep,
    user: CurrentUserDep,
    request: Request,
) -> Response:
    """Ustozni SHU darsga vaqtincha almashtiradi — jadval tegilmaydi."""
    await lesson_service.substitute_teacher(
        session,
        user,
        lesson_id=lesson_id,
        teacher_id=payload.teacher_id,
        note=payload.note,
        ip=_client_ip(request),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/lessons/{lesson_id}/move", status_code=status.HTTP_204_NO_CONTENT)
async def move_lesson(
    lesson_id: uuid.UUID,
    payload: LessonMoveIn,
    session: SessionDep,
    user: CurrentUserDep,
    request: Request,
) -> Response:
    """Darsni shu kunning boshqa parasiga koʻchiradi."""
    await lesson_service.move_lesson(
        session,
        user,
        lesson_id=lesson_id,
        period=payload.period,
        room=payload.room,
        note=payload.note,
        ip=_client_ip(request),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
