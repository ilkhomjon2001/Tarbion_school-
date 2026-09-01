"""CRM servisi: lidlar, qoʻngʻiroqlar jurnali, shartnomalar roʻyxati.

Yozish huquqi — mavjud `students.manage` bilan: lid oxir-oqibat
oʻquvchiga aylanadi, alohida huquq ochilmaydi. Shartnomalar roʻyxati
moliya koʻrinishi — `payment_service.assert_finance_admin` bilan.

Ikkita qoida:
  1. Yopiq holatdan (`qabul_qilindi`, `yo_qoldi`) qaytish yoʻq — 409.
     Voronka statistikasi orqaga oqmasin.
  2. Qoʻngʻiroq yozilganda `yangi` lid avtomatik `aloqada` ga oʻtadi —
     administrator ikki marta bosmasin.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import (
    LEAD_CLOSED_STATUSES,
    AuditAction,
    CallResult,
    Lead,
    LeadCall,
    LeadSource,
    LeadStatus,
    Permission,
    SchoolClass,
    Student,
    TuitionContract,
    User,
)
from app.services import audit_service, payment_service, permissions
from app.services.access import CurrentUser

SOURCES = frozenset(s.value for s in LeadSource)
STATUSES = frozenset(s.value for s in LeadStatus)
CALL_RESULTS = frozenset(r.value for r in CallResult)

#: Roʻyxat sahifasiga sigʻadigan maksimal qatorlar.
LIST_LIMIT = 200
CALL_FEED_LIMIT = 200

#: PATCH orqali oʻzgartirish mumkin boʻlgan maydonlar (mass assignment toʻsigʻi).
_PATCHABLE = frozenset(
    {
        "parent_name",
        "phone",
        "child_name",
        "child_birth_year",
        "source",
        "status",
        "note",
        "assigned_to_id",
        "student_id",
    }
)


@dataclass(frozen=True, slots=True)
class LeadRow:
    lead: Lead
    assigned_to_name: str | None


@dataclass(frozen=True, slots=True)
class CallRow:
    call: LeadCall
    created_by_name: str | None


@dataclass(frozen=True, slots=True)
class CallFeedRow:
    call: LeadCall
    created_by_name: str | None
    lead_parent_name: str
    lead_phone: str
    lead_status: str


@dataclass(frozen=True, slots=True)
class ContractRow:
    contract: TuitionContract
    student_name: str
    class_name: str | None


async def _assert_can(session: AsyncSession, actor: CurrentUser) -> None:
    await permissions.assert_permission(session, actor, Permission.STUDENTS_MANAGE)


async def _get_lead(session: AsyncSession, lead_id: uuid.UUID) -> Lead:
    lead = await session.get(Lead, lead_id)
    if lead is None or lead.is_archived:
        raise NotFoundError("Lid topilmadi.")
    return lead


_ASSIGNED_NAME = (User.last_name + " " + User.first_name).label("assigned_name")


async def list_leads(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    status: str | None = None,
    q: str | None = None,
    limit: int = LIST_LIMIT,
) -> list[LeadRow]:
    """Faol lidlar, yangi kiritilgani birinchi. Qidiruv: ism/bola/telefon."""
    await _assert_can(session, actor)

    stmt = (
        select(Lead, _ASSIGNED_NAME)
        .outerjoin(User, User.id == Lead.assigned_to_id)
        .where(Lead.is_archived.is_(False))
        .order_by(Lead.created_at.desc())
        .limit(min(limit, LIST_LIMIT))
    )
    if status:
        if status not in STATUSES:
            raise ValidationError("Holat notoʻgʻri.")
        stmt = stmt.where(Lead.status == status)
    if q:
        pattern = f"%{q.strip()}%"
        # Telefon boʻyicha ham qidiriladi — telefon unique emas,
        # bir oilaning ikkinchi murojaati shu yerdan topiladi.
        stmt = stmt.where(
            Lead.parent_name.ilike(pattern)
            | Lead.child_name.ilike(pattern)
            | Lead.phone.ilike(pattern)
        )
    rows = await session.execute(stmt)
    return [LeadRow(lead=lead, assigned_to_name=name) for lead, name in rows.all()]


async def _assigned_name(session: AsyncSession, user_id: uuid.UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await session.get(User, user_id)
    if user is None or user.is_archived:
        raise ValidationError("Masʼul xodim topilmadi.")
    return user.full_name


async def create_lead(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    parent_name: str,
    phone: str,
    child_name: str | None,
    child_birth_year: int | None,
    source: str,
    note: str | None,
    assigned_to_id: uuid.UUID | None,
    ip: str | None = None,
) -> LeadRow:
    await _assert_can(session, actor)

    if source not in SOURCES:
        raise ValidationError("Manba notoʻgʻri.")
    phone = phone.strip()
    if not phone:
        raise ValidationError("Telefon raqami majburiy.")
    assigned_name = await _assigned_name(session, assigned_to_id)

    lead = Lead(
        parent_name=parent_name.strip(),
        phone=phone,
        child_name=(child_name or "").strip() or None,
        child_birth_year=child_birth_year,
        source=source,
        status=LeadStatus.YANGI.value,
        note=(note or "").strip() or None,
        assigned_to_id=assigned_to_id,
    )
    session.add(lead)
    await session.flush()

    audit_service.record(
        session,
        object_type="lead",
        object_id=lead.id,
        action=AuditAction.CREATE,
        old=None,
        new={
            "parent_name": lead.parent_name,
            "phone": lead.phone,
            "source": lead.source,
            "status": lead.status,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return LeadRow(lead=lead, assigned_to_name=assigned_name)


async def update_lead(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    lead_id: uuid.UUID,
    changes: dict[str, Any],
    ip: str | None = None,
) -> LeadRow:
    """PATCH: faqat berilgan maydonlar. Yopiq holatdan chiqish — 409."""
    await _assert_can(session, actor)
    lead = await _get_lead(session, lead_id)

    changes = {k: v for k, v in changes.items() if k in _PATCHABLE}

    new_status = changes.get("status")
    if new_status is not None:
        if new_status not in STATUSES:
            raise ValidationError("Holat notoʻgʻri.")
        if lead.status in LEAD_CLOSED_STATUSES and new_status != lead.status:
            raise ConflictError(
                "Yopiq holatdagi lidni qayta ochib boʻlmaydi. Yangi murojaat "
                "boʻlsa — yangi lid oching."
            )
    if "source" in changes and changes["source"] not in SOURCES:
        raise ValidationError("Manba notoʻgʻri.")
    if "phone" in changes and not str(changes["phone"] or "").strip():
        raise ValidationError("Telefon raqami majburiy.")
    if "assigned_to_id" in changes:
        await _assigned_name(session, changes["assigned_to_id"])
    if "student_id" in changes and changes["student_id"] is not None:
        student = await session.get(Student, changes["student_id"])
        if student is None:
            raise ValidationError("Oʻquvchi topilmadi.")

    before = {k: getattr(lead, k) for k in changes}
    for key, value in changes.items():
        if isinstance(value, str):
            value = value.strip() or None
            if key in {"parent_name", "phone", "source", "status"} and value is None:
                raise ValidationError("Kiritilgan maʼlumot notoʻgʻri.")
        setattr(lead, key, value)
    await session.flush()

    after = {k: getattr(lead, k) for k in changes}
    old_diff, new_diff = audit_service.diff(before, after)
    if new_diff:
        audit_service.record(
            session,
            object_type="lead",
            object_id=lead.id,
            action=AuditAction.UPDATE,
            old=old_diff,
            new=new_diff,
            actor_id=actor.id,
            ip=ip,
        )
    await session.commit()
    # Nomni koʻrsatish uchun oʻqish — arxivlangan boʻlsa ham xato emas.
    assigned = (
        await session.get(User, lead.assigned_to_id) if lead.assigned_to_id else None
    )
    return LeadRow(lead=lead, assigned_to_name=assigned.full_name if assigned else None)


async def archive_lead(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    lead_id: uuid.UUID,
    ip: str | None = None,
) -> None:
    """Arxivlash — oʻchirish YOʻQ (1-domen qoidasi)."""
    await _assert_can(session, actor)
    lead = await _get_lead(session, lead_id)
    lead.is_archived = True

    audit_service.record(
        session,
        object_type="lead",
        object_id=lead.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()


_CREATOR_NAME = (User.last_name + " " + User.first_name).label("creator_name")


async def list_calls(
    session: AsyncSession, actor: CurrentUser, *, lead_id: uuid.UUID
) -> list[CallRow]:
    """Bitta lidning qoʻngʻiroqlari, oxirgisi birinchi."""
    await _assert_can(session, actor)
    await _get_lead(session, lead_id)

    rows = await session.execute(
        select(LeadCall, _CREATOR_NAME)
        .outerjoin(User, User.id == LeadCall.created_by_id)
        .where(LeadCall.lead_id == lead_id, LeadCall.is_archived.is_(False))
        .order_by(LeadCall.called_at.desc())
    )
    return [CallRow(call=c, created_by_name=n) for c, n in rows.all()]


async def add_call(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    lead_id: uuid.UUID,
    result: str,
    note: str | None,
    called_at: datetime | None = None,
    ip: str | None = None,
) -> CallRow:
    """Qoʻngʻiroq yozadi; `yangi` lid avtomatik `aloqada` ga oʻtadi."""
    await _assert_can(session, actor)
    lead = await _get_lead(session, lead_id)

    if result not in CALL_RESULTS:
        raise ValidationError("Qoʻngʻiroq natijasi notoʻgʻri.")

    call = LeadCall(
        lead_id=lead.id,
        result=result,
        note=(note or "").strip() or None,
        created_by_id=actor.id,
    )
    if called_at is not None:
        call.called_at = called_at
    session.add(call)
    await session.flush()

    audit_service.record(
        session,
        object_type="lead_call",
        object_id=call.id,
        action=AuditAction.CREATE,
        old=None,
        new={"lead_id": str(lead.id), "result": result},
        actor_id=actor.id,
        ip=ip,
    )

    # Birinchi aloqa boʻldi — voronkada oldinga siljiydi.
    if lead.status == LeadStatus.YANGI.value:
        audit_service.record(
            session,
            object_type="lead",
            object_id=lead.id,
            action=AuditAction.UPDATE,
            old={"status": lead.status},
            new={"status": LeadStatus.ALOQADA.value},
            actor_id=actor.id,
            ip=ip,
        )
        lead.status = LeadStatus.ALOQADA.value

    await session.commit()
    return CallRow(call=call, created_by_name=actor.full_name)


async def recent_calls(
    session: AsyncSession, actor: CurrentUser, *, limit: int = CALL_FEED_LIMIT
) -> list[CallFeedRow]:
    """Barcha lidlar boʻylab oxirgi qoʻngʻiroqlar jurnali."""
    await _assert_can(session, actor)

    rows = await session.execute(
        select(LeadCall, _CREATOR_NAME, Lead.parent_name, Lead.phone, Lead.status)
        .join(Lead, Lead.id == LeadCall.lead_id)
        .outerjoin(User, User.id == LeadCall.created_by_id)
        .where(LeadCall.is_archived.is_(False), Lead.is_archived.is_(False))
        .order_by(LeadCall.called_at.desc())
        .limit(min(limit, CALL_FEED_LIMIT))
    )
    return [
        CallFeedRow(
            call=c,
            created_by_name=creator,
            lead_parent_name=parent,
            lead_phone=phone,
            lead_status=status,
        )
        for c, creator, parent, phone, status in rows.all()
    ]


async def summary(session: AsyncSession, actor: CurrentUser) -> dict[str, int]:
    """Faol lidlar soni — har status boʻyicha (dashboard)."""
    await _assert_can(session, actor)

    rows = await session.execute(
        select(Lead.status, func.count())
        .where(Lead.is_archived.is_(False))
        .group_by(Lead.status)
    )
    counts = {s.value: 0 for s in LeadStatus}
    for status, soni in rows.all():
        counts[status] = soni
    return counts


async def list_contracts(
    session: AsyncSession, actor: CurrentUser, *, q: str | None = None
) -> list[ContractRow]:
    """Shartnomalar roʻyxati — mavjud TuitionContract dan, FAQAT oʻqish.

    Arxivlanganlar ham chiqadi («Eski» belgisi bilan): summa tarixi
    hisobotda koʻrinishi kerak (1-domen qoidasi).
    """
    await payment_service.assert_finance_admin(session, actor)

    stmt = (
        select(TuitionContract, Student, SchoolClass.name)
        .join(Student, Student.id == TuitionContract.student_id)
        .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
        .order_by(
            Student.last_name, Student.first_name, TuitionContract.starts_on.desc()
        )
    )
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            Student.last_name.ilike(pattern) | Student.first_name.ilike(pattern)
        )
    rows = await session.execute(stmt)
    return [
        ContractRow(contract=c, student_name=s.full_name, class_name=cls)
        for c, s, cls in rows.all()
    ]
