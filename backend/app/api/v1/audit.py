"""Audit jurnali endpointlari (T-021). TZ: NFR-10.

**Yozish endpointi ATAYLAB yoʻq.** Jurnal servislardan avtomatik
toʻladi. Bazada ham `UPDATE`/`DELETE` trigger bilan toʻsilgan —
jurnalning butunligi shu tizimning eng oxirgi dalili.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.audit import AuditEntryOut, AuditFiltersOut, AuditPageOut
from app.services import audit_query

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=AuditPageOut)
async def entries(
    user: CurrentUserDep,
    session: SessionDep,
    object_type: str | None = None,
    action: str | None = None,
    actor_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = Query(default=None, description="Obyekt, amal, xodim yoki qiymat"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> AuditPageOut:
    """Filtrlangan jurnal. Faqat butun maktabni koʻradiganlarga.

    Sana filtri MAHALLIY kun boʻyicha (CLAUDE.md 3-qoida): Toshkentda
    01:00 da yozilgan yozuv UTC da hali kechagi kun boʻladi.
    """
    sahifa = await audit_query.list_entries(
        session,
        user,
        object_type=object_type,
        action=action,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        query=q,
        limit=limit,
        offset=offset,
    )
    return AuditPageOut(
        rows=[
            AuditEntryOut(
                id=r.id,
                created_at=r.created_at,
                object_type=r.object_type,
                object_id=r.object_id,
                action=r.action,
                old_value=r.old_value,
                new_value=r.new_value,
                actor_id=r.actor_id,
                actor_name=r.actor_name,
                ip_address=r.ip_address,
            )
            for r in sahifa.rows
        ],
        total=sahifa.total,
        has_more=sahifa.has_more,
    )


@router.get("/filters", response_model=AuditFiltersOut)
async def filters(user: CurrentUserDep, session: SessionDep) -> AuditFiltersOut:
    """Jurnalda haqiqatan uchraydigan turlar va amallar."""
    turlar, amallar = await audit_query.filter_options(session, user)
    return AuditFiltersOut(object_types=turlar, actions=amallar)
