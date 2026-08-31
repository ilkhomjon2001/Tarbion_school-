"""Dars jadvali — sinf, fan, ustoz, hafta kuni, para, xona (T-011).

TZ: ADM-08, ADM-09.

Toʻqnashuv nazorati ikki qatlamda:

1. **Bazada** — `schedule_entries` dagi uchta qisman-unique indeks
   (ustoz, xona, sinf). Ikki administrator bir vaqtda yozsa ham baza
   ushlab qoladi.

2. **Servisda** — yozishdan oldin tekshiriladi va TUSHUNARLI xato
   qaytariladi: "Ustoz Aliyev shu vaqtda 8-A da Matematika oʻtadi".
   Indeksning oʻzi buni ayta olmaydi, u faqat `IntegrityError` beradi.

Ikkalasi ham kerak: indeks — kafolat, servis — foydalanuvchiga javob.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.timeutil import utcnow
from app.models import (
    AuditAction,
    Permission,
    ScheduleEntry,
    SchoolClass,
    Subject,
    User,
)
from app.services import academic_service, audit_service
from app.services.access import CurrentUser
from app.services.permissions import assert_permission

#: 1 = dushanba … 7 = yakshanba (ISO). Yakshanba dam olish kuni, lekin
#: jadvalda taqiqlanmaydi — baʼzi maktablarda toʻgarak boʻladi.
MIN_WEEKDAY, MAX_WEEKDAY = 1, 7
MIN_PERIOD, MAX_PERIOD = 1, 10

WEEKDAY_NAMES_UZ = {
    1: "dushanba",
    2: "seshanba",
    3: "chorshanba",
    4: "payshanba",
    5: "juma",
    6: "shanba",
    7: "yakshanba",
}


@dataclass(frozen=True, slots=True)
class ScheduleRow:
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_name: str
    teacher_id: uuid.UUID
    teacher_name: str
    weekday: int
    period: int
    room: str | None


async def _rows(
    session: AsyncSession,
    *,
    year_id: uuid.UUID,
    class_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
) -> list[ScheduleRow]:
    """Jadval qatorlari — sinf, fan va ustoz nomi bilan bitta soʻrovda."""
    stmt = (
        select(ScheduleEntry, SchoolClass.name, Subject.name, User.last_name, User.first_name)
        .join(SchoolClass, SchoolClass.id == ScheduleEntry.class_id)
        .join(Subject, Subject.id == ScheduleEntry.subject_id)
        .join(User, User.id == ScheduleEntry.teacher_id)
        .where(
            ScheduleEntry.academic_year_id == year_id,
            ScheduleEntry.is_archived.is_(False),
        )
        .order_by(ScheduleEntry.weekday, ScheduleEntry.period, SchoolClass.name)
    )
    if class_id is not None:
        stmt = stmt.where(ScheduleEntry.class_id == class_id)
    if teacher_id is not None:
        stmt = stmt.where(ScheduleEntry.teacher_id == teacher_id)

    return [
        ScheduleRow(
            id=e.id,
            class_id=e.class_id,
            class_name=cls_name,
            subject_id=e.subject_id,
            subject_name=subj_name,
            teacher_id=e.teacher_id,
            teacher_name=f"{last} {first}",
            weekday=e.weekday,
            period=e.period,
            room=e.room,
        )
        for e, cls_name, subj_name, last, first in (await session.execute(stmt)).all()
    ]


async def list_schedule(
    session: AsyncSession,
    *,
    year_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
) -> list[ScheduleRow]:
    """Jadval — sinf yoki ustoz kesimida (ADM-08)."""
    if year_id is None:
        year = await academic_service.current_year(session)
        if year is None:
            return []
        year_id = year.id
    return await _rows(session, year_id=year_id, class_id=class_id, teacher_id=teacher_id)


async def _assert_no_conflict(
    session: AsyncSession,
    *,
    year_id: uuid.UUID,
    weekday: int,
    period: int,
    class_id: uuid.UUID,
    teacher_id: uuid.UUID,
    room: str | None,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """ADM-09: ustoz, xona va sinf ayni vaqtda ikki joyda boʻlmaydi.

    Uchalasi bitta soʻrovda olinadi — uchta alohida soʻrov bir xil
    natijani uch marta bazadan soʻrardi.
    """
    stmt = (
        select(ScheduleEntry, SchoolClass.name, Subject.name, User.last_name, User.first_name)
        .join(SchoolClass, SchoolClass.id == ScheduleEntry.class_id)
        .join(Subject, Subject.id == ScheduleEntry.subject_id)
        .join(User, User.id == ScheduleEntry.teacher_id)
        .where(
            ScheduleEntry.academic_year_id == year_id,
            ScheduleEntry.is_archived.is_(False),
            ScheduleEntry.weekday == weekday,
            ScheduleEntry.period == period,
        )
    )
    if exclude_id is not None:
        stmt = stmt.where(ScheduleEntry.id != exclude_id)

    kun = WEEKDAY_NAMES_UZ.get(weekday, str(weekday))

    for band, cls_name, subj_name, last, first in (await session.execute(stmt)).all():
        if band.teacher_id == teacher_id:
            raise ConflictError(
                f"Ustoz {last} {first} — {kun}, {period}-para band: {cls_name}, {subj_name}."
            )
        if band.class_id == class_id:
            raise ConflictError(f"{cls_name} sinfida {kun}, {period}-para band: {subj_name}.")
        if room and band.room and band.room.strip().lower() == room.strip().lower():
            raise ConflictError(
                f"{band.room} xonasi {kun}, {period}-para band: {cls_name}, {subj_name}."
            )


async def _assert_refs(
    session: AsyncSession, *, class_id: uuid.UUID, subject_id: uuid.UUID, teacher_id: uuid.UUID
) -> SchoolClass:
    cls = await session.get(SchoolClass, class_id)
    if cls is None or cls.is_archived:
        raise NotFoundError("Sinf topilmadi.")

    subject = await session.get(Subject, subject_id)
    if subject is None or subject.is_archived:
        raise NotFoundError("Fan topilmadi.")

    teacher = await session.get(User, teacher_id)
    if teacher is None or teacher.is_archived:
        raise NotFoundError("Ustoz topilmadi.")

    return cls


def _assert_slot(weekday: int, period: int) -> None:
    if not MIN_WEEKDAY <= weekday <= MAX_WEEKDAY:
        raise ValidationError("Hafta kuni 1 (dushanba) dan 7 (yakshanba) gacha boʻlsin.")
    if not MIN_PERIOD <= period <= MAX_PERIOD:
        raise ValidationError(f"Para raqami {MIN_PERIOD} dan {MAX_PERIOD} gacha boʻlsin.")


async def add_entry(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
    teacher_id: uuid.UUID,
    weekday: int,
    period: int,
    room: str | None = None,
    ip: str | None = None,
) -> ScheduleRow:
    """Jadvalga dars qoʻshadi (ADM-08). Huquq: `schedule.manage`."""
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    _assert_slot(weekday, period)

    cls = await _assert_refs(
        session, class_id=class_id, subject_id=subject_id, teacher_id=teacher_id
    )
    year_id = cls.academic_year_id

    await _assert_no_conflict(
        session,
        year_id=year_id,
        weekday=weekday,
        period=period,
        class_id=class_id,
        teacher_id=teacher_id,
        room=room,
    )

    entry = ScheduleEntry(
        academic_year_id=year_id,
        class_id=class_id,
        subject_id=subject_id,
        teacher_id=teacher_id,
        weekday=weekday,
        period=period,
        room=(room or "").strip() or None,
    )
    session.add(entry)
    await session.flush()

    audit_service.record(
        session,
        object_type="schedule_entry",
        object_id=entry.id,
        action=AuditAction.CREATE,
        new={
            "class_id": class_id,
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "weekday": weekday,
            "period": period,
            "room": entry.room,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()

    rows = await _rows(session, year_id=year_id, class_id=class_id)
    return next(r for r in rows if r.id == entry.id)


async def update_entry(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    entry_id: uuid.UUID,
    teacher_id: uuid.UUID | None = None,
    room: str | None = None,
    ip: str | None = None,
) -> ScheduleRow:
    """Ustoz yoki xonani almashtiradi.

    Sinf, fan va vaqt oʻzgarmaydi: ular oʻzgarsa bu boshqa dars — eskisini
    chiqarib, yangisini qoʻshish kerak, shunda jadval tarixi buzilmaydi.
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)

    entry = await session.get(ScheduleEntry, entry_id)
    if entry is None or entry.is_archived:
        raise NotFoundError("Jadval yozuvi topilmadi.")

    yangi_teacher = teacher_id or entry.teacher_id
    yangi_room = (room if room is not None else entry.room) or None
    if yangi_room is not None:
        yangi_room = yangi_room.strip() or None

    if yangi_teacher != entry.teacher_id:
        teacher = await session.get(User, yangi_teacher)
        if teacher is None or teacher.is_archived:
            raise NotFoundError("Ustoz topilmadi.")

    before = {"teacher_id": entry.teacher_id, "room": entry.room}
    after = {"teacher_id": yangi_teacher, "room": yangi_room}
    eski, yangi = audit_service.diff(before, after)

    if yangi:
        await _assert_no_conflict(
            session,
            year_id=entry.academic_year_id,
            weekday=entry.weekday,
            period=entry.period,
            class_id=entry.class_id,
            teacher_id=yangi_teacher,
            room=yangi_room,
            exclude_id=entry.id,
        )
        entry.teacher_id = yangi_teacher
        entry.room = yangi_room
        audit_service.record(
            session,
            object_type="schedule_entry",
            object_id=entry.id,
            action=AuditAction.UPDATE,
            old=eski,
            new=yangi,
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()

    rows = await _rows(session, year_id=entry.academic_year_id, class_id=entry.class_id)
    return next(r for r in rows if r.id == entry.id)


async def archive_entry(
    session: AsyncSession, *, actor: CurrentUser, entry_id: uuid.UUID, ip: str | None = None
) -> None:
    """Jadvaldan chiqaradi. Oʻchirish YOʻQ (CLAUDE.md 1-qoida).

    Allaqachon generatsiya qilingan darslar (`lessons`) qolaveradi —
    ulardagi davomat va baho jadvalga emas, darsga bogʻlangan.
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)

    entry = await session.get(ScheduleEntry, entry_id)
    if entry is None:
        raise NotFoundError("Jadval yozuvi topilmadi.")
    if entry.is_archived:
        return

    entry.is_archived = True
    entry.archived_at = utcnow()
    audit_service.record(
        session,
        object_type="schedule_entry",
        object_id=entry.id,
        action=AuditAction.ARCHIVE,
        old={"weekday": entry.weekday, "period": entry.period},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()


@dataclass(frozen=True, slots=True)
class TeacherLoad:
    teacher_id: uuid.UUID
    full_name: str
    subjects: list[str]
    weekly_hours: int
    classes: list[str]


async def teacher_load(
    session: AsyncSession, *, year_id: uuid.UUID | None = None
) -> list[TeacherLoad]:
    """Ustozlarning haftalik yuklamasi — jadvaldan hisoblanadi (MET-09).

    Yuklama alohida saqlanmaydi: jadval oʻzgarsa u ham oʻzgarishi kerak,
    ikkita manba bir-biriga mos kelmay qolardi.
    """
    if year_id is None:
        year = await academic_service.current_year(session)
        if year is None:
            return []
        year_id = year.id

    rows = await _rows(session, year_id=year_id)

    yigilgan: dict[uuid.UUID, dict[str, object]] = {}
    for r in rows:
        item = yigilgan.setdefault(
            r.teacher_id,
            {"name": r.teacher_name, "subjects": set(), "hours": 0, "classes": set()},
        )
        item["subjects"].add(r.subject_name)  # type: ignore[union-attr]
        item["classes"].add(r.class_name)  # type: ignore[union-attr]
        item["hours"] = int(item["hours"]) + 1  # type: ignore[arg-type]

    return sorted(
        (
            TeacherLoad(
                teacher_id=tid,
                full_name=str(v["name"]),
                subjects=sorted(v["subjects"]),  # type: ignore[arg-type]
                weekly_hours=int(v["hours"]),  # type: ignore[arg-type]
                classes=sorted(v["classes"]),  # type: ignore[arg-type]
            )
            for tid, v in yigilgan.items()
        ),
        key=lambda t: t.full_name,
    )
