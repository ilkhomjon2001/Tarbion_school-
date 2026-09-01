"""Maʼlumotnomani boshqarish: sinf va fan (ADM-02, ADM-03).

`school_service.py` OʻQIYDI (roʻyxat, kartochka), bu modul YOZADI.
Ajratilgan sabab: oʻqish deyarli har ekranda kerak va yengil, yozish
esa faqat administrator qoʻlida va huquq tekshiruvi bilan.

Uch qoida:

1. **Hech narsa oʻchirilmaydi.** Fan ham, sinf ham arxivlanadi:
   oʻtgan yilgi baholar va davomat ularga bogʻlangan.

2. **Ishlatilayotgan narsa arxivlanmaydi.** Jadvalda turgan fan yoki
   oʻquvchisi bor sinf chiqarilsa, dars qoladi-yu, fani arxivda
   turardi — hisobot buziladi.

3. **Sinf rahbari biriktirilganda unga ROL ham beriladi.** Rolsiz u
   sinf rahbari ekranlarini koʻra olmasdi: menyu ham, kirish nazorati
   ham `homeroom_teacher` roliga qaraydi (T-008 qabul mezoni).
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.timeutil import utcnow
from app.models import (
    AuditAction,
    ClassSubject,
    Permission,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    User,
    UserRole,
)
from app.services import audit_service
from app.services.access import CurrentUser
from app.services.permissions import assert_permission

#: Haftalik soat chegarasi. 0 — oʻquv rejasidan chiqarish.
MAX_WEEKLY_HOURS = 20


# ─────────────────────────── Fanlar ───────────────────────────


async def create_subject(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    name: str,
    short_name: str = "",
    ip: str | None = None,
) -> Subject:
    """Yangi fan (ADM-03). Huquq: `students.manage`.

    Alohida huquq yaratilmadi: maʼlumotnomani boshqaradigan odam
    oʻquvchi ham qabul qiladi — bu bitta ish oʻrni.
    """
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    tozalangan = name.strip()
    if not tozalangan:
        raise ValidationError("Fan nomi boʻsh boʻlmasin.")

    mavjud = await session.scalar(select(Subject).where(Subject.name == tozalangan))
    if mavjud is not None:
        if not mavjud.is_archived:
            raise ConflictError("Bu nomdagi fan allaqachon bor.")

        # Arxivdan qaytaramiz. `name` unikal — yangi qator yaratib
        # boʻlmaydi, va oʻtgan baholar aynan shu fanga bogʻlangan.
        mavjud.is_archived = False
        mavjud.archived_at = None
        if short_name.strip():
            mavjud.short_name = short_name.strip()[:20]
        audit_service.record(
            session,
            object_type="subject",
            object_id=mavjud.id,
            action=AuditAction.UPDATE,
            old={"is_archived": True},
            new={"is_archived": False, "name": mavjud.name},
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()
        return mavjud

    subject = Subject(name=tozalangan, short_name=short_name.strip()[:20])
    session.add(subject)
    await session.flush()

    audit_service.record(
        session,
        object_type="subject",
        object_id=subject.id,
        action=AuditAction.CREATE,
        new={"name": subject.name},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return subject


async def archive_subject(
    session: AsyncSession, *, actor: CurrentUser, subject_id: uuid.UUID, ip: str | None = None
) -> Subject:
    """Fanni oʻquv rejasidan chiqaradi. Oʻchirish YOʻQ (1-qoida)."""
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    subject = await session.get(Subject, subject_id)
    if subject is None:
        raise NotFoundError("Fan topilmadi.")
    if subject.is_archived:
        return subject

    band = await session.scalar(
        select(func.count())
        .select_from(ScheduleEntry)
        .where(
            ScheduleEntry.subject_id == subject_id,
            ScheduleEntry.is_archived.is_(False),
        )
    )
    if band:
        raise ConflictError(
            f"Bu fan jadvalda {band} ta darsda ishlatilyapti. Avval jadvaldan chiqaring."
        )

    subject.is_archived = True
    subject.archived_at = utcnow()
    audit_service.record(
        session,
        object_type="subject",
        object_id=subject.id,
        action=AuditAction.ARCHIVE,
        old={"name": subject.name},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return subject


# ─────────────────────────── Sinflar ───────────────────────────


async def _grant_homeroom_role(session: AsyncSession, teacher_id: uuid.UUID) -> None:
    """3-qoida: sinf rahbariga rol ham beriladi."""
    teacher = await session.get(User, teacher_id)
    if teacher is None or teacher.is_archived:
        raise NotFoundError("Ustoz topilmadi.")

    if RoleName.HOMEROOM_TEACHER.value in teacher.role_names:
        return

    rol = await session.scalar(select(Role).where(Role.name == RoleName.HOMEROOM_TEACHER.value))
    if rol is not None:
        session.add(UserRole(user_id=teacher_id, role_id=rol.id))
        await session.flush()


async def create_class(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    name: str,
    homeroom_teacher_id: uuid.UUID | None = None,
    ip: str | None = None,
) -> SchoolClass:
    """Yangi sinf joriy oʻquv yilida (ADM-02)."""
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    from app.services.academic_service import current_year

    tozalangan = name.strip().upper()
    if not tozalangan:
        raise ValidationError("Sinf nomi boʻsh boʻlmasin.")

    year = await current_year(session)
    if year is None:
        raise ValidationError("Joriy oʻquv yili belgilanmagan.")

    mavjud = await session.scalar(
        select(SchoolClass).where(
            SchoolClass.academic_year_id == year.id, SchoolClass.name == tozalangan
        )
    )
    if mavjud is not None:
        if not mavjud.is_archived:
            raise ConflictError("Bu nomdagi sinf shu oʻquv yilida allaqachon bor.")
        # `(academic_year_id, name)` unikal — arxivdagisini qaytaramiz.
        mavjud.is_archived = False
        mavjud.archived_at = None
        if homeroom_teacher_id is not None:
            await _grant_homeroom_role(session, homeroom_teacher_id)
            mavjud.homeroom_teacher_id = homeroom_teacher_id
        audit_service.record(
            session,
            object_type="class",
            object_id=mavjud.id,
            action=AuditAction.UPDATE,
            old={"is_archived": True},
            new={"is_archived": False, "name": mavjud.name},
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()
        return mavjud

    if homeroom_teacher_id is not None:
        await _grant_homeroom_role(session, homeroom_teacher_id)

    cls = SchoolClass(
        academic_year_id=year.id,
        name=tozalangan,
        homeroom_teacher_id=homeroom_teacher_id,
    )
    session.add(cls)
    await session.flush()

    audit_service.record(
        session,
        object_type="class",
        object_id=cls.id,
        action=AuditAction.CREATE,
        new={"name": cls.name, "homeroom_teacher_id": homeroom_teacher_id},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return cls


async def set_homeroom_teacher(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    class_id: uuid.UUID,
    teacher_id: uuid.UUID | None,
    ip: str | None = None,
) -> SchoolClass:
    """Sinf rahbarini almashtiradi (ADM-02).

    Eski rahbardan rol OLINMAYDI: u boshqa sinfning rahbari boʻlishi
    mumkin, va roli olinsa oʻsha sinfdagi ishi ham toʻxtardi.
    """
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    cls = await session.get(SchoolClass, class_id)
    if cls is None or cls.is_archived:
        raise NotFoundError("Sinf topilmadi.")

    eski = cls.homeroom_teacher_id
    if eski == teacher_id:
        return cls

    if teacher_id is not None:
        await _grant_homeroom_role(session, teacher_id)

    cls.homeroom_teacher_id = teacher_id
    audit_service.record(
        session,
        object_type="class",
        object_id=cls.id,
        action=AuditAction.UPDATE,
        old={"homeroom_teacher_id": eski},
        new={"homeroom_teacher_id": teacher_id},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return cls


async def archive_class(
    session: AsyncSession, *, actor: CurrentUser, class_id: uuid.UUID, ip: str | None = None
) -> SchoolClass:
    """Sinfni arxivlaydi. Oʻquvchisi bor sinf arxivlanmaydi (2-qoida)."""
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    cls = await session.get(SchoolClass, class_id)
    if cls is None:
        raise NotFoundError("Sinf topilmadi.")
    if cls.is_archived:
        return cls

    soni = await session.scalar(
        select(func.count())
        .select_from(Student)
        .where(Student.class_id == class_id, Student.is_archived.is_(False))
    )
    if soni:
        raise ConflictError(
            f"Sinfda {soni} ta oʻquvchi bor. Avval ularni boshqa sinfga koʻchiring."
        )

    cls.is_archived = True
    cls.archived_at = utcnow()
    audit_service.record(
        session,
        object_type="class",
        object_id=cls.id,
        action=AuditAction.ARCHIVE,
        old={"name": cls.name},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return cls


# ─────────────────── Sinfning oʻquv rejasi ───────────────────


async def set_class_subject(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
    weekly_hours: int,
    ip: str | None = None,
) -> None:
    """Sinfga fan biriktiradi yoki soatini oʻzgartiradi (ADM-03).

    `weekly_hours=0` — oʻquv rejasidan chiqarish. Yozuv arxivlanadi,
    oʻchirilmaydi: `(class_id, subject_id)` unikal va oʻtgan
    hisobotlar shu bogʻlanishga tayanadi.
    """
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    if weekly_hours < 0 or weekly_hours > MAX_WEEKLY_HOURS:
        raise ValidationError(f"Haftalik soat 0 dan {MAX_WEEKLY_HOURS} gacha boʻlsin.")

    cls = await session.get(SchoolClass, class_id)
    if cls is None or cls.is_archived:
        raise NotFoundError("Sinf topilmadi.")

    subject = await session.get(Subject, subject_id)
    if subject is None or subject.is_archived:
        raise NotFoundError("Fan topilmadi.")

    row = await session.scalar(
        select(ClassSubject).where(
            ClassSubject.class_id == class_id, ClassSubject.subject_id == subject_id
        )
    )

    if row is None:
        if weekly_hours == 0:
            return
        session.add(
            ClassSubject(class_id=class_id, subject_id=subject_id, weekly_hours=weekly_hours)
        )
        amal = AuditAction.CREATE
        eski: dict | None = None
        yangi: dict = {"weekly_hours": weekly_hours}
    else:
        eski = {"weekly_hours": row.weekly_hours, "is_archived": row.is_archived}
        if weekly_hours == 0:
            row.is_archived = True
            row.archived_at = utcnow()
            amal = AuditAction.ARCHIVE
            yangi = {"is_archived": True}
        else:
            row.weekly_hours = weekly_hours
            row.is_archived = False
            row.archived_at = None
            amal = AuditAction.UPDATE
            yangi = {"weekly_hours": weekly_hours, "is_archived": False}

    audit_service.record(
        session,
        object_type="class_subject",
        object_id=class_id,
        action=amal,
        old=eski,
        new={**yangi, "subject": subject.name},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
