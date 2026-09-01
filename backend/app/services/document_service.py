"""Maʼlumotnomalar servisi.

Huquq: butun modul `students.manage` bilan — hujjat oʻquvchi haqida
va uni oʻsha administrator beradi. Alohida huquq kerak boʻlsa keyin
ajratiladi.

Eng muhim qoida X-13 dan: **maʼlumotnoma berish — bola haqidagi
maʼlumotni maktabdan tashqariga chiqarish.** Shu sabab har berish
audit_log ga raqami va kimga berilgani bilan tushadi.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import (
    AuditAction,
    DocumentRequest,
    DocumentStatus,
    DocumentType,
    Permission,
    SchoolClass,
    Student,
)
from app.services import audit_service, permissions
from app.services.access import CurrentUser

TYPES = frozenset(t.value for t in DocumentType)


@dataclass(frozen=True, slots=True)
class DocumentRow:
    doc: DocumentRequest
    student_name: str
    class_name: str | None
    birth_year: int | None


async def _assert_can(session: AsyncSession, actor: CurrentUser) -> None:
    await permissions.assert_permission(session, actor, Permission.STUDENTS_MANAGE)


async def _get(session: AsyncSession, doc_id: uuid.UUID) -> DocumentRequest:
    doc = await session.get(DocumentRequest, doc_id)
    if doc is None or doc.is_archived:
        raise NotFoundError("Soʻrov topilmadi.")
    return doc


async def create_request(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    doc_type: str,
    requested_by: str = "",
    ip: str | None = None,
) -> DocumentRequest:
    await _assert_can(session, actor)
    if doc_type not in TYPES:
        raise ValidationError("Hujjat turi notoʻgʻri.")

    student = await session.get(Student, student_id)
    if student is None or student.is_archived:
        raise NotFoundError("Oʻquvchi topilmadi.")

    doc = DocumentRequest(
        student_id=student_id,
        doc_type=doc_type,
        requested_by=requested_by.strip(),
        status=DocumentStatus.NEW.value,
    )
    session.add(doc)
    await session.flush()

    audit_service.record(
        session,
        object_type="document",
        object_id=doc.id,
        action=AuditAction.CREATE,
        old=None,
        new={"student_id": str(student_id), "doc_type": doc_type},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return doc


async def set_waiting(
    session: AsyncSession, *, actor: CurrentUser, doc_id: uuid.UUID, ip: str | None = None
) -> DocumentRequest:
    """«Kutishda» — imzo yoki muhr kutilyapti."""
    await _assert_can(session, actor)
    doc = await _get(session, doc_id)
    if doc.status == DocumentStatus.ISSUED.value:
        raise ConflictError("Berilgan hujjat holati oʻzgartirilmaydi.")

    eski = doc.status
    doc.status = DocumentStatus.WAITING.value
    audit_service.record(
        session,
        object_type="document",
        object_id=doc.id,
        action=AuditAction.UPDATE,
        old={"status": eski},
        new={"status": doc.status},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return doc


async def _next_number(session: AsyncSession) -> str:
    """Reyestr raqami: MK-<yil>-<tartib>. Tartib yil ichida oʻsadi.

    Sanoq bazadagi mavjud yozuvlardan chiqadi. Ikkita administrator
    ayni soniyada bersa unique cheklov ikkinchisini toʻxtatadi va u
    qayta urinadi — maktab hajmida bu yetarli.
    """
    yil = datetime.now(UTC).year
    prefix = f"MK-{yil}-"
    soni = (
        await session.scalar(
            select(func.count(DocumentRequest.id)).where(
                DocumentRequest.number.like(prefix + "%")
            )
        )
    ) or 0
    return f"{prefix}{soni + 1:04d}"


async def issue(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    doc_id: uuid.UUID,
    recipient: str,
    copies: int = 1,
    extra_text: str | None = None,
    ip: str | None = None,
) -> DocumentRequest:
    """Hujjatni berish. Shundan keyin yozuv OʻZGARMAYDI.

    X-13: bu bola haqidagi maʼlumotning maktabdan chiqishi — auditga
    raqami va kimga berilgani bilan tushadi.
    """
    await _assert_can(session, actor)
    doc = await _get(session, doc_id)
    if doc.status == DocumentStatus.ISSUED.value:
        raise ConflictError("Bu soʻrov boʻyicha hujjat allaqachon berilgan.")
    if not (1 <= copies <= 10):
        raise ValidationError("Nusxalar soni 1 dan 10 gacha.")

    doc.number = await _next_number(session)
    doc.issued_at = datetime.now(UTC)
    doc.issued_by_id = actor.id
    doc.recipient = recipient.strip() or None
    doc.copies = copies
    doc.extra_text = (extra_text or "").strip() or None
    doc.status = DocumentStatus.ISSUED.value

    audit_service.record(
        session,
        object_type="document",
        object_id=doc.id,
        action=AuditAction.UPDATE,
        old={"status": "new_or_waiting"},
        new={
            "status": "issued",
            "number": doc.number,
            "recipient": doc.recipient,
            "copies": copies,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return doc


async def archive(
    session: AsyncSession, *, actor: CurrentUser, doc_id: uuid.UUID, ip: str | None = None
) -> DocumentRequest:
    """Xato ochilgan soʻrovni olib tashlash. Berilgan hujjat ham
    arxivlanadi (masalan, bekor qilingan) — lekin reyestr yozuvi va
    raqami saqlanadi, qayta ishlatilmaydi."""
    await _assert_can(session, actor)
    doc = await _get(session, doc_id)
    doc.is_archived = True
    audit_service.record(
        session,
        object_type="document",
        object_id=doc.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False, "number": doc.number},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return doc


async def list_requests(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    issued: bool,
) -> list[DocumentRow]:
    """Navbat (`issued=False`) yoki reyestr (`issued=True`)."""
    await _assert_can(session, actor)

    stmt = (
        select(DocumentRequest, Student, SchoolClass.name)
        .join(Student, Student.id == DocumentRequest.student_id)
        .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
        .where(DocumentRequest.is_archived.is_(False))
    )
    if issued:
        stmt = stmt.where(
            DocumentRequest.status == DocumentStatus.ISSUED.value
        ).order_by(DocumentRequest.issued_at.desc())
    else:
        stmt = stmt.where(
            DocumentRequest.status != DocumentStatus.ISSUED.value
        ).order_by(DocumentRequest.created_at.asc())

    natija = []
    for doc, student, class_name in (await session.execute(stmt)).all():
        natija.append(
            DocumentRow(
                doc=doc,
                student_name=student.full_name,
                class_name=class_name,
                birth_year=student.birth_date.year if student.birth_date else None,
            )
        )
    return natija
