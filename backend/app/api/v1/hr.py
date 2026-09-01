"""Kadrlar endpointlari. Butun modul `users.manage` bilan.

«Bugun taʼtilda» MAHALLIY kun boʻyicha (3-qoida): server UTC da boʻlsa
ham xodimning taʼtili Toshkent kuni bilan hisoblanadi.
"""

import uuid

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.core.timeutil import local_today
from app.schemas.hr import EmployeeOut, LeaveIn, LeaveOut, ProfileIn
from app.services import hr_service

router = APIRouter(prefix="/hr", tags=["hr"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _employee_out(row: hr_service.EmployeeRow) -> EmployeeOut:
    p = row.profile
    return EmployeeOut(
        user_id=row.user.id,
        full_name=row.user.full_name,
        login=row.user.login,
        roles=row.roles,
        phone=row.user.phone,
        position=p.position if p else "",
        contract_type=p.contract_type if p else "toliq",
        qualification=p.qualification if p else "toifasiz",
        hired_on=p.hired_on if p else None,
        base_salary=p.base_salary if p else None,
        note=p.note if p else None,
        on_leave=row.on_leave.leave_type if row.on_leave else None,
    )


@router.get("/employees", response_model=list[EmployeeOut])
async def employees(user: CurrentUserDep, session: SessionDep) -> list[EmployeeOut]:
    rows = await hr_service.list_employees(session, user, today=local_today())
    return [_employee_out(r) for r in rows]


@router.put("/employees/{user_id}/profile", response_model=EmployeeOut)
async def update_profile(
    user_id: uuid.UUID,
    payload: ProfileIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> EmployeeOut:
    """Upsert. Oylik oʻzgarsa audit_log ga eski va yangi qiymat bilan."""
    await hr_service.update_profile(
        session,
        actor=user,
        user_id=user_id,
        position=payload.position,
        contract_type=payload.contract_type,
        qualification=payload.qualification,
        hired_on=payload.hired_on,
        base_salary=payload.base_salary,
        note=payload.note,
        ip=_client_ip(request),
    )
    rows = await hr_service.list_employees(session, user, today=local_today())
    return _employee_out(next(r for r in rows if r.user.id == user_id))


@router.get("/leaves", response_model=list[LeaveOut])
async def leaves(user: CurrentUserDep, session: SessionDep) -> list[LeaveOut]:
    """Joriy va kelgusi taʼtillar."""
    rows = await hr_service.list_leaves(session, user, from_date=local_today())
    return [
        LeaveOut(
            id=lv.id,
            user_id=lv.user_id,
            employee_name=name,
            leave_type=lv.leave_type,
            starts_on=lv.starts_on,
            ends_on=lv.ends_on,
            note=lv.note,
            created_at=lv.created_at,
        )
        for lv, name in rows
    ]


@router.post("/leaves", response_model=LeaveOut, status_code=201)
async def add_leave(
    payload: LeaveIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> LeaveOut:
    leave = await hr_service.add_leave(
        session,
        actor=user,
        user_id=payload.user_id,
        leave_type=payload.leave_type,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        note=payload.note,
        ip=_client_ip(request),
    )
    rows = await hr_service.list_leaves(session, user, from_date=leave.starts_on)
    lv, name = next((x, n) for x, n in rows if x.id == leave.id)
    return LeaveOut(
        id=lv.id,
        user_id=lv.user_id,
        employee_name=name,
        leave_type=lv.leave_type,
        starts_on=lv.starts_on,
        ends_on=lv.ends_on,
        note=lv.note,
        created_at=lv.created_at,
    )


@router.post("/leaves/{leave_id}/archive", status_code=204)
async def archive_leave(
    leave_id: uuid.UUID, request: Request, user: CurrentUserDep, session: SessionDep
) -> None:
    await hr_service.archive_leave(
        session, actor=user, leave_id=leave_id, ip=_client_ip(request)
    )
