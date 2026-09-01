"""Eʼlon endpointlari (T-020, ADM-12).

Kim koʻrishi va kim bera olishi servisda hal boʻladi — router faqat
kirish/chiqish shakli.
"""

import uuid

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.announcements import (
    AnnouncementCreateIn,
    AnnouncementOut,
    RecipientsPreviewOut,
    TargetOut,
    TargetsOut,
)
from app.services import announcement_service

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _out(row: announcement_service.AnnouncementRow) -> AnnouncementOut:
    return AnnouncementOut(
        id=row.ann.id,
        audience=row.ann.audience,
        title=row.ann.title,
        body=row.ann.body,
        important=row.ann.important,
        author_name=row.author_name,
        subject_name=row.subject_name,
        class_names=row.class_names,
        recipients_count=row.ann.recipients_count,
        created_at=row.ann.created_at,
    )


@router.get("", response_model=list[AnnouncementOut])
async def list_announcements(
    user: CurrentUserDep, session: SessionDep, limit: int = 50
) -> list[AnnouncementOut]:
    """Foydalanuvchi koʻradigan eʼlonlar — kesim serverda."""
    rows = await announcement_service.list_for(session, user, limit=limit)
    return [_out(r) for r in rows]


@router.get("/targets", response_model=TargetsOut)
async def targets(user: CurrentUserDep, session: SessionDep) -> TargetsOut:
    """Ustoz eʼlon bera oladigan sinflar va fanlar — dars jadvalidan."""
    classes, subjects = await announcement_service.teacher_targets(session, user)
    return TargetsOut(
        classes=[TargetOut(id=i, name=n) for i, n in classes],
        subjects=[TargetOut(id=i, name=n) for i, n in subjects],
    )


@router.get("/preview", response_model=RecipientsPreviewOut)
async def preview(
    user: CurrentUserDep,
    session: SessionDep,
    audience: str,
    class_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
) -> RecipientsPreviewOut:
    """ADM-12: yuborishdan OLDIN qabul qiluvchilar soni."""
    soni = await announcement_service.preview_recipients(
        session, user, audience=audience, class_id=class_id, subject_id=subject_id
    )
    return RecipientsPreviewOut(recipients=soni)


@router.post("", response_model=AnnouncementOut, status_code=201)
async def create(
    payload: AnnouncementCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AnnouncementOut:
    ann = await announcement_service.create(
        session,
        actor=user,
        audience=payload.audience,
        title=payload.title,
        body=payload.body,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        important=payload.important,
        ip=_client_ip(request),
    )
    rows = await announcement_service.list_for(session, user, limit=100)
    row = next(r for r in rows if r.ann.id == ann.id)
    return _out(row)


@router.post("/{announcement_id}/archive", response_model=AnnouncementOut)
async def archive(
    announcement_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AnnouncementOut:
    """Olib tashlash — arxivlash. Yetkazilgan bildirishnomalar qoladi."""
    ann = await announcement_service.archive(
        session, actor=user, announcement_id=announcement_id, ip=_client_ip(request)
    )
    return AnnouncementOut(
        id=ann.id,
        audience=ann.audience,
        title=ann.title,
        body=ann.body,
        important=ann.important,
        author_name="",
        subject_name=None,
        class_names=[],
        recipients_count=ann.recipients_count,
        created_at=ann.created_at,
    )
