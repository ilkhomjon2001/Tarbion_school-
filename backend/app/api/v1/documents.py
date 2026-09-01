"""Maʼlumotnoma endpointlari. Butun modul `students.manage` bilan."""

import uuid

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.documents import DocumentCreateIn, DocumentIssueIn, DocumentOut
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["documents"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _out(row: document_service.DocumentRow) -> DocumentOut:
    d = row.doc
    return DocumentOut(
        id=d.id,
        student_id=d.student_id,
        student_name=row.student_name,
        class_name=row.class_name,
        birth_year=row.birth_year,
        doc_type=d.doc_type,
        requested_by=d.requested_by,
        status=d.status,
        number=d.number,
        issued_at=d.issued_at,
        recipient=d.recipient,
        copies=d.copies,
        extra_text=d.extra_text,
        created_at=d.created_at,
    )


async def _row(
    session: SessionDep, user: CurrentUserDep, doc_id: uuid.UUID
) -> DocumentOut:
    for issued in (False, True):
        rows = await document_service.list_requests(session, user, issued=issued)
        for r in rows:
            if r.doc.id == doc_id:
                return _out(r)
    raise AssertionError("yozuv hozirgina yaratilgan edi")  # boʻlmasligi kerak


@router.get("/queue", response_model=list[DocumentOut])
async def queue(user: CurrentUserDep, session: SessionDep) -> list[DocumentOut]:
    """Navbat — yangi va kutishdagi soʻrovlar, eng eskisi birinchi."""
    rows = await document_service.list_requests(session, user, issued=False)
    return [_out(r) for r in rows]


@router.get("/registry", response_model=list[DocumentOut])
async def registry(user: CurrentUserDep, session: SessionDep) -> list[DocumentOut]:
    """Reyestr — berilgan hujjatlar, yangisi birinchi."""
    rows = await document_service.list_requests(session, user, issued=True)
    return [_out(r) for r in rows]


@router.post("", response_model=DocumentOut, status_code=201)
async def create(
    payload: DocumentCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> DocumentOut:
    doc = await document_service.create_request(
        session,
        actor=user,
        student_id=payload.student_id,
        doc_type=payload.doc_type,
        requested_by=payload.requested_by,
        ip=_client_ip(request),
    )
    return await _row(session, user, doc.id)


@router.post("/{doc_id}/waiting", response_model=DocumentOut)
async def set_waiting(
    doc_id: uuid.UUID, request: Request, user: CurrentUserDep, session: SessionDep
) -> DocumentOut:
    doc = await document_service.set_waiting(
        session, actor=user, doc_id=doc_id, ip=_client_ip(request)
    )
    return await _row(session, user, doc.id)


@router.post("/{doc_id}/issue", response_model=DocumentOut)
async def issue(
    doc_id: uuid.UUID,
    payload: DocumentIssueIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> DocumentOut:
    """Berish. Raqam beriladi, yozuv shundan keyin OʻZGARMAYDI (X-13 audit)."""
    doc = await document_service.issue(
        session,
        actor=user,
        doc_id=doc_id,
        recipient=payload.recipient,
        copies=payload.copies,
        extra_text=payload.extra_text,
        ip=_client_ip(request),
    )
    return await _row(session, user, doc.id)


@router.post("/{doc_id}/archive", status_code=204)
async def archive(
    doc_id: uuid.UUID, request: Request, user: CurrentUserDep, session: SessionDep
) -> None:
    await document_service.archive(
        session, actor=user, doc_id=doc_id, ip=_client_ip(request)
    )
