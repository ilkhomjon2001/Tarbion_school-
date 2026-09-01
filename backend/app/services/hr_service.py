"""Kadrlar servisi. Butun modul `users.manage` bilan yopiq.

Oylik oʻzgarishi audit_log ga eski va yangi qiymat bilan tushadi:
«kim qachon kimga qancha belgilagan» degan savol albatta chiqadi.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.models import (
    AuditAction,
    ContractType,
    LeaveType,
    Permission,
    Qualification,
    RoleName,
    StaffLeave,
    StaffProfile,
    User,
)
from app.services import audit_service, permissions
from app.services.access import CurrentUser

CONTRACTS = frozenset(c.value for c in ContractType)
QUALIFICATIONS = frozenset(q.value for q in Qualification)
LEAVE_TYPES = frozenset(t.value for t in LeaveType)

#: Kadrlar roʻyxatiga tushadigan rollar — oʻquvchi va ota-ona emas.
STAFF_ROLES = frozenset(
    {
        RoleName.TEACHER.value,
        RoleName.HOMEROOM_TEACHER.value,
        RoleName.ACADEMIC.value,
        RoleName.ADMIN.value,
        RoleName.DIRECTOR.value,
        RoleName.SUPERADMIN.value,
    }
)


@dataclass(frozen=True, slots=True)
class EmployeeRow:
    user: User
    profile: StaffProfile | None
    roles: list[str]
    on_leave: StaffLeave | None


async def _assert_can(session: AsyncSession, actor: CurrentUser) -> None:
    await permissions.assert_permission(session, actor, Permission.USERS_MANAGE)


async def _get_staff_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None or user.is_archived:
        raise NotFoundError("Xodim topilmadi.")
    if not (STAFF_ROLES & set(user.role_names)):
        # Ota-ona yoki oʻquvchiga kadr profili ochilmaydi.
        raise ValidationError("Bu hisob xodim emas.")
    return user


async def list_employees(
    session: AsyncSession, actor: CurrentUser, *, today: date
) -> list[EmployeeRow]:
    await _assert_can(session, actor)

    users = list(
        (
            await session.execute(
                select(User)
                .where(User.is_archived.is_(False))
                .order_by(User.last_name, User.first_name)
            )
        ).scalars()
    )
    xodimlar = [u for u in users if STAFF_ROLES & set(u.role_names)]
    ids = [u.id for u in xodimlar]

    profillar = {
        p.user_id: p
        for p in (
            await session.execute(
                select(StaffProfile).where(
                    StaffProfile.user_id.in_(ids), StaffProfile.is_archived.is_(False)
                )
            )
        ).scalars()
    }
    # Bugun taʼtilda boʻlganlar — bitta soʻrovda.
    tatilda = {}
    rows = await session.execute(
        select(StaffLeave).where(
            StaffLeave.user_id.in_(ids),
            StaffLeave.is_archived.is_(False),
            StaffLeave.starts_on <= today,
            StaffLeave.ends_on >= today,
        )
    )
    for lv in rows.scalars():
        tatilda[lv.user_id] = lv

    return [
        EmployeeRow(
            user=u,
            profile=profillar.get(u.id),
            roles=sorted(STAFF_ROLES & set(u.role_names)),
            on_leave=tatilda.get(u.id),
        )
        for u in xodimlar
    ]


async def update_profile(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    position: str,
    contract_type: str,
    qualification: str,
    hired_on: date | None,
    base_salary: int | None,
    note: str | None,
    ip: str | None = None,
) -> StaffProfile:
    """Profil yaratadi yoki yangilaydi (upsert).

    Oylik oʻzgarsa — auditga eski va yangi qiymat bilan.
    """
    await _assert_can(session, actor)
    await _get_staff_user(session, user_id)

    if contract_type not in CONTRACTS:
        raise ValidationError("Shartnoma turi notoʻgʻri.")
    if qualification not in QUALIFICATIONS:
        raise ValidationError("Malaka toifasi notoʻgʻri.")
    if base_salary is not None and base_salary < 0:
        raise ValidationError("Oylik manfiy boʻlmaydi.")

    profile = await session.scalar(
        select(StaffProfile).where(
            StaffProfile.user_id == user_id, StaffProfile.is_archived.is_(False)
        )
    )
    eski_oylik = profile.base_salary if profile else None

    if profile is None:
        profile = StaffProfile(user_id=user_id)
        session.add(profile)

    profile.position = position.strip()
    profile.contract_type = contract_type
    profile.qualification = qualification
    profile.hired_on = hired_on
    profile.base_salary = base_salary
    profile.note = (note or "").strip() or None
    await session.flush()

    if eski_oylik != base_salary:
        audit_service.record(
            session,
            object_type="staff_profile",
            object_id=profile.id,
            action=AuditAction.UPDATE,
            old={"base_salary": eski_oylik},
            new={"base_salary": base_salary, "user_id": str(user_id)},
            actor_id=actor.id,
            ip=ip,
        )
    await session.commit()
    return profile


async def add_leave(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    leave_type: str,
    starts_on: date,
    ends_on: date,
    note: str | None = None,
    ip: str | None = None,
) -> StaffLeave:
    await _assert_can(session, actor)
    await _get_staff_user(session, user_id)

    if leave_type not in LEAVE_TYPES:
        raise ValidationError("Taʼtil turi notoʻgʻri.")
    if ends_on < starts_on:
        raise ValidationError("Tugash sanasi boshlanishidan oldin boʻlmaydi.")

    leave = StaffLeave(
        user_id=user_id,
        leave_type=leave_type,
        starts_on=starts_on,
        ends_on=ends_on,
        note=(note or "").strip() or None,
    )
    session.add(leave)
    await session.flush()

    audit_service.record(
        session,
        object_type="staff_leave",
        object_id=leave.id,
        action=AuditAction.CREATE,
        old=None,
        new={
            "user_id": str(user_id),
            "leave_type": leave_type,
            "starts_on": str(starts_on),
            "ends_on": str(ends_on),
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return leave


async def archive_leave(
    session: AsyncSession, *, actor: CurrentUser, leave_id: uuid.UUID, ip: str | None = None
) -> StaffLeave:
    await _assert_can(session, actor)
    leave = await session.get(StaffLeave, leave_id)
    if leave is None or leave.is_archived:
        raise NotFoundError("Yozuv topilmadi.")
    leave.is_archived = True
    audit_service.record(
        session,
        object_type="staff_leave",
        object_id=leave.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return leave


async def list_leaves(
    session: AsyncSession, actor: CurrentUser, *, from_date: date
) -> list[tuple[StaffLeave, str]]:
    """Joriy va kelgusi taʼtillar, xodim ismi bilan."""
    await _assert_can(session, actor)
    rows = await session.execute(
        select(StaffLeave, User.last_name + " " + User.first_name)
        .join(User, User.id == StaffLeave.user_id)
        .where(StaffLeave.is_archived.is_(False), StaffLeave.ends_on >= from_date)
        .order_by(StaffLeave.starts_on)
    )
    return [(lv, name) for lv, name in rows.all()]
