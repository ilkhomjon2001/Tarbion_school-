"""CRM endpointlari: lidlar, qoʻngʻiroqlar, shartnomalar roʻyxati.

Router yupqa: validatsiya → service → javob. Yozish `students.manage`
bilan, shartnomalar — moliya koʻrinishi bilan (servisda tekshiriladi).
"""

import uuid

from fastapi import APIRouter, Query, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.crm import (
    CallFeedOut,
    CrmContractOut,
    LeadCallIn,
    LeadCallOut,
    LeadIn,
    LeadOut,
    LeadSummaryOut,
    LeadUpdate,
)
from app.services import crm_service

router = APIRouter(prefix="/crm", tags=["crm"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _lead_out(row: crm_service.LeadRow) -> LeadOut:
    lead = row.lead
    return LeadOut(
        id=lead.id,
        parent_name=lead.parent_name,
        phone=lead.phone,
        child_name=lead.child_name,
        child_birth_year=lead.child_birth_year,
        source=lead.source,
        status=lead.status,
        note=lead.note,
        assigned_to_id=lead.assigned_to_id,
        assigned_to_name=row.assigned_to_name,
        student_id=lead.student_id,
        created_at=lead.created_at,
    )


def _call_out(row: crm_service.CallRow) -> LeadCallOut:
    call = row.call
    return LeadCallOut(
        id=call.id,
        lead_id=call.lead_id,
        called_at=call.called_at,
        result=call.result,
        note=call.note,
        created_by_id=call.created_by_id,
        created_by_name=row.created_by_name,
    )


@router.get("/leads", response_model=list[LeadOut])
async def leads(
    user: CurrentUserDep,
    session: SessionDep,
    status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=200, ge=1, le=200),
) -> list[LeadOut]:
    rows = await crm_service.list_leads(session, user, status=status, q=q, limit=limit)
    return [_lead_out(r) for r in rows]


@router.get("/leads/summary", response_model=LeadSummaryOut)
async def leads_summary(user: CurrentUserDep, session: SessionDep) -> LeadSummaryOut:
    counts = await crm_service.summary(session, user)
    return LeadSummaryOut(counts=counts, total=sum(counts.values()))


@router.post("/leads", response_model=LeadOut, status_code=201)
async def create_lead(
    payload: LeadIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> LeadOut:
    row = await crm_service.create_lead(
        session,
        actor=user,
        parent_name=payload.parent_name,
        phone=payload.phone,
        child_name=payload.child_name,
        child_birth_year=payload.child_birth_year,
        source=payload.source,
        note=payload.note,
        assigned_to_id=payload.assigned_to_id,
        ip=_client_ip(request),
    )
    return _lead_out(row)


@router.patch("/leads/{lead_id}", response_model=LeadOut)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> LeadOut:
    """Yopiq holatdan (`qabul_qilindi`/`yo_qoldi`) qaytish — 409."""
    row = await crm_service.update_lead(
        session,
        actor=user,
        lead_id=lead_id,
        changes=payload.model_dump(exclude_unset=True),
        ip=_client_ip(request),
    )
    return _lead_out(row)


@router.post("/leads/{lead_id}/archive", status_code=204)
async def archive_lead(
    lead_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> None:
    await crm_service.archive_lead(
        session, actor=user, lead_id=lead_id, ip=_client_ip(request)
    )


@router.get("/leads/{lead_id}/calls", response_model=list[LeadCallOut])
async def lead_calls(
    lead_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[LeadCallOut]:
    rows = await crm_service.list_calls(session, user, lead_id=lead_id)
    return [_call_out(r) for r in rows]


@router.post("/leads/{lead_id}/calls", response_model=LeadCallOut, status_code=201)
async def add_call(
    lead_id: uuid.UUID,
    payload: LeadCallIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> LeadCallOut:
    """`yangi` lidga qoʻngʻiroq yozilsa, holati avtomatik `aloqada` boʻladi."""
    row = await crm_service.add_call(
        session,
        actor=user,
        lead_id=lead_id,
        result=payload.result,
        note=payload.note,
        called_at=payload.called_at,
        ip=_client_ip(request),
    )
    return _call_out(row)


@router.get("/calls", response_model=list[CallFeedOut])
async def calls(
    user: CurrentUserDep,
    session: SessionDep,
    limit: int = Query(default=100, ge=1, le=200),
) -> list[CallFeedOut]:
    """Umumiy jurnal: barcha lidlar boʻylab oxirgi qoʻngʻiroqlar."""
    rows = await crm_service.recent_calls(session, user, limit=limit)
    return [
        CallFeedOut(
            id=r.call.id,
            lead_id=r.call.lead_id,
            called_at=r.call.called_at,
            result=r.call.result,
            note=r.call.note,
            created_by_name=r.created_by_name,
            lead_parent_name=r.lead_parent_name,
            lead_phone=r.lead_phone,
            lead_status=r.lead_status,
        )
        for r in rows
    ]


@router.get("/contracts", response_model=list[CrmContractOut])
async def contracts(
    user: CurrentUserDep,
    session: SessionDep,
    q: str | None = Query(default=None, max_length=120),
) -> list[CrmContractOut]:
    """Shartnomalar roʻyxati — faqat oʻqish, moliya koʻrinishi bilan."""
    rows = await crm_service.list_contracts(session, user, q=q)
    return [
        CrmContractOut(
            id=r.contract.id,
            student_id=r.contract.student_id,
            student_name=r.student_name,
            class_name=r.class_name,
            monthly_fee=r.contract.monthly_fee,
            starts_on=r.contract.starts_on,
            is_archived=r.contract.is_archived,
            note=r.contract.note,
            created_at=r.contract.created_at,
        )
        for r in rows
    ]
