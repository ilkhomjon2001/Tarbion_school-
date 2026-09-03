"""Bildirishnoma endpointlari.

Bu routerda `require_roles(...)` YOʻQ va kerak ham emas: bildirishnoma
har doim BITTA odamniki va har bir soʻrov `WHERE user_id = :men` bilan
cheklangan. Rol emas, egalik hal qiladi.

Boshqa odamning bildirishnomasini oʻqish yoʻli ataylab yozilmagan —
`GET /{id}` kabi endpoint yoʻq. Bitta yozuvni koʻrish uchun sabab ham
yoʻq: roʻyxat va sanoq yetarli.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.models import NOTIFICATION_KIND_LABELS_UZ
from app.schemas.notifications import (
    BadgeOut,
    MarkAllReadIn,
    MarkReadIn,
    MarkReadOut,
    NotificationOut,
    OutboxCountsOut,
    OutboxRowOut,
    RetryOut,
)
from app.services import notifications_service, outbox_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    session: SessionDep,
    user: CurrentUserDep,
    only_unread: Annotated[bool, Query()] = False,
    section: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=notifications_service.MAX_LIMIT)] = (
        notifications_service.DEFAULT_LIMIT
    ),
) -> list[NotificationOut]:
    rows = await notifications_service.list_for(
        session, user, only_unread=only_unread, section=section, limit=limit
    )
    nomlar = await notifications_service.student_names(
        session, [r.student_id for r in rows if r.student_id]
    )
    return [
        NotificationOut(
            id=r.id,
            kind=r.kind,
            kind_label=NOTIFICATION_KIND_LABELS_UZ.get(r.kind, r.kind),
            section=r.section,
            link=r.link,
            title=r.title,
            body=r.body,
            student_id=r.student_id,
            student_name=nomlar.get(r.student_id) if r.student_id else None,
            created_at=r.created_at,
            read_at=r.read_at,
        )
        for r in rows
    ]


@router.get("/badges", response_model=BadgeOut)
async def badges(session: SessionDep, user: CurrentUserDep) -> BadgeOut:
    """Yon menyudagi sanoq.

    Frontend buni tez-tez soʻraydi, shuning uchun javob ataylab kichik:
    faqat boʻlim va son. Roʻyxatning oʻzi qoʻngʻiroq ochilganda olinadi.
    """
    bolimlar = await notifications_service.unread_by_section(session, user)
    return BadgeOut(total=sum(bolimlar.values()), sections=bolimlar)


@router.post("/read", response_model=MarkReadOut)
async def mark_read(
    payload: MarkReadIn, session: SessionDep, user: CurrentUserDep
) -> MarkReadOut:
    """Koʻrsatilganlarni oʻqilgan deb belgilaydi.

    Begona id yuborilsa javob `updated: 0` — xato emas. `403` qaytarish
    «bunday bildirishnoma bor» degan maʼlumotni oshkor qilardi.
    """
    updated = await notifications_service.mark_read(session, user, payload.ids)
    return MarkReadOut(updated=updated)


@router.post("/read-all", response_model=MarkReadOut)
async def mark_all_read(
    payload: MarkAllReadIn, session: SessionDep, user: CurrentUserDep
) -> MarkReadOut:
    updated = await notifications_service.mark_all_read(session, user, section=payload.section)
    return MarkReadOut(updated=updated)




# ─────────────────── BOT-06: xabar navbati jurnali ───────────────────


@router.get("/outbox", response_model=list[OutboxRowOut])
async def outbox_list(
    session: SessionDep,
    user: CurrentUserDep,
    status: Annotated[
        str | None, Query(description="pending · sent · failed · cancelled")
    ] = "failed",
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[OutboxRowOut]:
    """Yetkazilmagan xabarlar jurnali (BOT-06).

    Sukut boʻyicha YIQILGANLAR: ekranning maqsadi muammoni koʻrsatish.
    Huquq: `announcements.publish`.
    """
    rows = await outbox_service.admin_list(session, user, status=status, limit=limit)
    return [
        OutboxRowOut(
            id=r.id,
            user_id=r.user_id,
            user_name=r.user_name,
            kind=r.kind,
            channel=r.channel,
            title=r.title,
            body=r.body,
            status=r.status,
            attempts=r.attempts,
            last_error=r.last_error,
            send_after=r.send_after,
            sent_at=r.sent_at,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/outbox/counts", response_model=OutboxCountsOut)
async def outbox_counts(session: SessionDep, user: CurrentUserDep) -> OutboxCountsOut:
    c = await outbox_service.admin_counts(session, user)
    return OutboxCountsOut(
        pending=c.get("pending", 0),
        sent=c.get("sent", 0),
        failed=c.get("failed", 0),
        cancelled=c.get("cancelled", 0),
    )


@router.post("/outbox/{outbox_id}/retry", response_model=RetryOut)
async def outbox_retry(
    outbox_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    user: CurrentUserDep,
) -> RetryOut:
    """Bitta xabarni qayta navbatga qoʻyadi (BOT-06).

    Faqat `failed` holatidagi xabar qaytariladi. Navbatdagi yoki
    yuborilganini «qayta yuborish» maʼnosiz — javob `retried: 0`.
    """
    ok = await outbox_service.admin_retry(
        session, user, outbox_id, ip=request.client.host if request.client else None
    )
    return RetryOut(retried=1 if ok else 0)


@router.post("/outbox/retry-failed", response_model=RetryOut)
async def outbox_retry_failed(
    request: Request, session: SessionDep, user: CurrentUserDep
) -> RetryOut:
    """Barcha yiqilganlarni qayta navbatga qoʻyadi.

    Telegram bir necha soat tushib qolsa oʻnlab xabar yiqiladi —
    bittalab bosib chiqishni hech kim qilmasdi.
    """
    n = await outbox_service.admin_retry_failed(
        session, user, ip=request.client.host if request.client else None
    )
    return RetryOut(retried=n)
