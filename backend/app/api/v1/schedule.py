"""Dars jadvali endpointlari (T-011). TZ: ADM-08, ADM-09.

Oʻqish kirgan har kimga ochiq — jadval maktabda devorga osiladi.
Yozish `schedule.manage` huquqini talab qiladi.
"""

import uuid

from fastapi import APIRouter, Request, Response, status

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.schedule import (
    ScheduleEntryIn,
    ScheduleEntryOut,
    ScheduleEntryUpdateIn,
    TeacherLoadOut,
)
from app.services import schedule_service

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
