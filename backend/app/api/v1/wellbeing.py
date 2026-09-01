"""Tarbiya/psixologiya endpointlari.

Eng nozik maʼlumot — kim nimani koʻrishi servisdagi jadvalda,
router faqat shakl.
"""

import uuid

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.wellbeing import WellbeingNoteCreateIn, WellbeingNoteOut
from app.services import wellbeing_service

router = APIRouter(prefix="/wellbeing", tags=["wellbeing"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _out(row: wellbeing_service.NoteRow) -> WellbeingNoteOut:
    return WellbeingNoteOut(
        id=row.note.id,
        kind=row.note.kind,
        tone=row.note.tone,
        text=row.note.text,
        author_name=row.author_name,
        subject_name=row.subject_name,
        created_at=row.note.created_at,
    )


@router.get("/students/{student_id}", response_model=list[WellbeingNoteOut])
async def notes_of_student(
    student_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[WellbeingNoteOut]:
    """Oʻquvchining yozuvlari.

    Fan ustoziga psixologik yozuvlar KELMAYDI — filtr soʻrovda.
    Huquq umuman boʻlmasa 403 (X-3).
    """
    rows = await wellbeing_service.list_for_student(session, user, student_id)
    return [_out(r) for r in rows]


@router.post("", response_model=WellbeingNoteOut, status_code=201)
async def create_note(
    payload: WellbeingNoteCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> WellbeingNoteOut:
    note = await wellbeing_service.create(
        session,
        actor=user,
        student_id=payload.student_id,
        kind=payload.kind,
        tone=payload.tone,
        text=payload.text,
        subject_id=payload.subject_id,
        ip=_client_ip(request),
    )
    rows = await wellbeing_service.list_for_student(session, user, payload.student_id)
    return _out(next(r for r in rows if r.note.id == note.id))


@router.post("/{note_id}/archive", status_code=204)
async def archive_note(
    note_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> None:
    """Olib tashlash — arxivlash (1-qoida). Faqat muallif yoki rahbariyat."""
    await wellbeing_service.archive(
        session, actor=user, note_id=note_id, ip=_client_ip(request)
    )
