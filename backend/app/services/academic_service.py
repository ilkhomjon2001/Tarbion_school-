"""Oʻquv yili, choraklar, taʼtillar, qoʻngʻiroqlar jadvali (T-007).

TZ: ADM-01, ADM-07.

Uchta qoida modulni belgilaydi:

1. **Faqat bitta oʻquv yili joriy.** Bazada qisman unikal indeks bor
   (`uq_academic_years_single_current`), lekin indeks "eskisini oʻchir"
   deb aytmaydi — buni servis qiladi va ikkalasi bitta tranzaksiyada
   boʻladi.

2. **Choraklar bir-birini qoplamaydi.** Tekshiruv yozishdan OLDIN, butun
   toʻplam ustidan: bitta chorakni tahrirlaganda qoʻshnisi bilan
   toʻqnashuvi ham koʻrinadi. Shu sababli choraklar bittalab emas,
   YAXLIT yoziladi (`set_terms`).

3. **Hech narsa oʻchirilmaydi** (CLAUDE.md 1-qoida). Chorak yoki
   qoʻngʻiroq jadvalidan chiqarilgan qator arxivlanadi — oʻtgan yilning
   davomati oʻsha choraklarga bogʻlangan.
"""

import uuid
from dataclasses import dataclass
from datetime import date, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.timeutil import utcnow
from app.models import (
    AcademicYear,
    AuditAction,
    BellSchedule,
    Holiday,
    Permission,
    Term,
)
from app.services import audit_service
from app.services.access import CurrentUser
from app.services.permissions import assert_permission

#: Yiliga nechta chorak. TZ: 4 ta.
MAX_TERMS = 4
#: Kuniga nechta para. ADM-07.
MAX_PERIODS = 8


@dataclass(frozen=True, slots=True)
class TermIn:
    index: int
    name: str
    starts_on: date
    ends_on: date


@dataclass(frozen=True, slots=True)
class BellIn:
    period: int
    starts_at: time
    ends_at: time


# ─────────────────────────── Oʻquv yili ───────────────────────────


async def list_years(session: AsyncSession) -> list[AcademicYear]:
    rows = await session.execute(
        select(AcademicYear)
        .where(AcademicYear.is_archived.is_(False))
        .order_by(AcademicYear.starts_on.desc())
    )
    return list(rows.scalars())


async def current_year(session: AsyncSession) -> AcademicYear | None:
    return await session.scalar(
        select(AcademicYear).where(
            AcademicYear.is_current.is_(True), AcademicYear.is_archived.is_(False)
        )
    )


async def get_year(session: AsyncSession, year_id: uuid.UUID) -> AcademicYear:
    year = await session.get(AcademicYear, year_id)
    if year is None or year.is_archived:
        raise NotFoundError("Oʻquv yili topilmadi.")
    return year


async def create_year(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    name: str,
    starts_on: date,
    ends_on: date,
    make_current: bool = False,
    ip: str | None = None,
) -> AcademicYear:
    """Yangi oʻquv yili (ADM-01). Huquq: `schedule.manage`."""
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)

    if ends_on <= starts_on:
        raise ValidationError("Oʻquv yili tugashi boshlanishidan keyin boʻlishi kerak.")

    mavjud = await session.scalar(
        select(AcademicYear).where(
            AcademicYear.name == name.strip(), AcademicYear.is_archived.is_(False)
        )
    )
    if mavjud is not None:
        raise ConflictError("Bu nomdagi oʻquv yili allaqachon bor.")

    year = AcademicYear(name=name.strip(), starts_on=starts_on, ends_on=ends_on, is_current=False)
    session.add(year)
    await session.flush()

    audit_service.record(
        session,
        object_type="academic_year",
        object_id=year.id,
        action=AuditAction.CREATE,
        new={"name": year.name, "starts_on": starts_on, "ends_on": ends_on},
        actor_id=actor.id,
        ip=ip,
    )

    if make_current:
        await _switch_current(session, year, actor=actor, ip=ip)

    await session.commit()
    return year


async def update_year(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    year_id: uuid.UUID,
    name: str | None = None,
    starts_on: date | None = None,
    ends_on: date | None = None,
    ip: str | None = None,
) -> AcademicYear:
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    year = await get_year(session, year_id)

    before = {"name": year.name, "starts_on": year.starts_on, "ends_on": year.ends_on}
    after = {
        "name": (name or year.name).strip(),
        "starts_on": starts_on or year.starts_on,
        "ends_on": ends_on or year.ends_on,
    }
    if after["ends_on"] <= after["starts_on"]:
        raise ValidationError("Oʻquv yili tugashi boshlanishidan keyin boʻlishi kerak.")

    eski, yangi = audit_service.diff(before, after)
    if not yangi:
        return year

    year.name = after["name"]
    year.starts_on = after["starts_on"]
    year.ends_on = after["ends_on"]

    audit_service.record(
        session,
        object_type="academic_year",
        object_id=year.id,
        action=AuditAction.UPDATE,
        old=eski,
        new=yangi,
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return year


async def set_current_year(
    session: AsyncSession, *, actor: CurrentUser, year_id: uuid.UUID, ip: str | None = None
) -> AcademicYear:
    """Joriy oʻquv yilini almashtiradi (T-007 qabul mezoni)."""
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    year = await get_year(session, year_id)

    if not year.is_current:
        await _switch_current(session, year, actor=actor, ip=ip)
        await session.commit()
    return year


async def _switch_current(
    session: AsyncSession, year: AcademicYear, *, actor: CurrentUser, ip: str | None
) -> None:
    """Eskisini tushirib, yangisini koʻtaradi — bitta tranzaksiyada.

    Tartib muhim: bazadagi qisman unikal indeks ikkita `is_current`
    qatorga yoʻl bermaydi, shuning uchun avval eskisi tushiriladi va
    `flush` qilinadi.
    """
    eski = await current_year(session)
    if eski is not None and eski.id != year.id:
        eski.is_current = False
        await session.flush()
        audit_service.record(
            session,
            object_type="academic_year",
            object_id=eski.id,
            action=AuditAction.UPDATE,
            old={"is_current": True},
            new={"is_current": False},
            actor_id=actor.id,
            ip=ip,
        )

    year.is_current = True
    await session.flush()
    audit_service.record(
        session,
        object_type="academic_year",
        object_id=year.id,
        action=AuditAction.UPDATE,
        old={"is_current": False},
        new={"is_current": True},
        actor_id=actor.id,
        ip=ip,
    )


# ─────────────────────────── Choraklar ───────────────────────────


async def list_terms(session: AsyncSession, year_id: uuid.UUID) -> list[Term]:
    rows = await session.execute(
        select(Term)
        .where(Term.academic_year_id == year_id, Term.is_archived.is_(False))
        .order_by(Term.index)
    )
    return list(rows.scalars())


def _assert_terms_valid(terms: list[TermIn], year: AcademicYear) -> None:
    """Toʻplam yaxlit tekshiriladi: tartib, qoplanish, yil chegarasi."""
    if not terms:
        raise ValidationError("Kamida bitta chorak kiritilishi kerak.")
    if len(terms) > MAX_TERMS:
        raise ValidationError(f"Choraklar soni {MAX_TERMS} tadan oshmasin.")

    raqamlar = [t.index for t in terms]
    if len(set(raqamlar)) != len(raqamlar):
        raise ValidationError("Chorak raqami takrorlanmasin.")
    if any(r < 1 or r > MAX_TERMS for r in raqamlar):
        raise ValidationError(f"Chorak raqami 1 dan {MAX_TERMS} gacha boʻlsin.")

    for t in terms:
        if t.ends_on <= t.starts_on:
            raise ValidationError(f"{t.index}-chorak tugashi boshlanishidan keyin boʻlsin.")
        if t.starts_on < year.starts_on or t.ends_on > year.ends_on:
            raise ValidationError(
                f"{t.index}-chorak oʻquv yili chegarasidan chiqib ketdi "
                f"({year.starts_on} — {year.ends_on})."
            )

    # Qoplanish: sana boʻyicha tartiblab, qoʻshni juftlarni solishtiramiz.
    tartibli = sorted(terms, key=lambda t: t.starts_on)
    for oldingi, keyingi in zip(tartibli, tartibli[1:], strict=False):
        if keyingi.starts_on <= oldingi.ends_on:
            raise ConflictError(
                f"{oldingi.index}-chorak va {keyingi.index}-chorak sanalari qoplanadi."
            )


async def set_terms(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    year_id: uuid.UUID,
    terms: list[TermIn],
    ip: str | None = None,
) -> list[Term]:
    """Choraklarni YAXLIT yozadi (ADM-01).

    Bittalab tahrirlash qoplanishni tekshirishni chalkashtiradi: 2-chorak
    sanasini surganda 3-chorak bilan toʻqnashuvi faqat butun toʻplam
    koʻrilganda bilinadi.

    Roʻyxatdan chiqib qolgan chorak ARXIVLANADI, oʻchirilmaydi.
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    year = await get_year(session, year_id)
    _assert_terms_valid(terms, year)

    mavjud = {t.index: t for t in await list_terms(session, year_id)}
    kelgan = {t.index: t for t in terms}

    for kirish in terms:
        row = mavjud.get(kirish.index)
        if row is None:
            row = Term(
                academic_year_id=year_id,
                index=kirish.index,
                name=kirish.name.strip(),
                starts_on=kirish.starts_on,
                ends_on=kirish.ends_on,
            )
            session.add(row)
            await session.flush()
            audit_service.record(
                session,
                object_type="term",
                object_id=row.id,
                action=AuditAction.CREATE,
                new={
                    "index": row.index,
                    "name": row.name,
                    "starts_on": row.starts_on,
                    "ends_on": row.ends_on,
                },
                actor_id=actor.id,
                ip=ip,
            )
            continue

        before = {"name": row.name, "starts_on": row.starts_on, "ends_on": row.ends_on}
        after = {
            "name": kirish.name.strip(),
            "starts_on": kirish.starts_on,
            "ends_on": kirish.ends_on,
        }
        eski, yangi = audit_service.diff(before, after)
        if not yangi:
            continue
        row.name = after["name"]
        row.starts_on = after["starts_on"]
        row.ends_on = after["ends_on"]
        audit_service.record(
            session,
            object_type="term",
            object_id=row.id,
            action=AuditAction.UPDATE,
            old=eski,
            new=yangi,
            actor_id=actor.id,
            ip=ip,
        )

    for index, row in mavjud.items():
        if index in kelgan:
            continue
        row.is_archived = True
        row.archived_at = utcnow()
        audit_service.record(
            session,
            object_type="term",
            object_id=row.id,
            action=AuditAction.ARCHIVE,
            old={"index": index},
            new={"is_archived": True},
            actor_id=actor.id,
            ip=ip,
        )

    await session.commit()
    return await list_terms(session, year_id)


async def term_on(session: AsyncSession, year_id: uuid.UUID, day: date) -> Term | None:
    """Shu sana qaysi chorakka tushadi (baho va hisobot uchun)."""
    return await session.scalar(
        select(Term).where(
            Term.academic_year_id == year_id,
            Term.is_archived.is_(False),
            Term.starts_on <= day,
            Term.ends_on >= day,
        )
    )


# ─────────────────────────── Taʼtillar ───────────────────────────


async def list_holidays(session: AsyncSession, year_id: uuid.UUID) -> list[Holiday]:
    rows = await session.execute(
        select(Holiday)
        .where(Holiday.academic_year_id == year_id, Holiday.is_archived.is_(False))
        .order_by(Holiday.day)
    )
    return list(rows.scalars())


async def add_holiday(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    year_id: uuid.UUID,
    day: date,
    title: str,
    ip: str | None = None,
) -> Holiday:
    """Bayram yoki taʼtil kuni (ADM-01). Bu kunga dars generatsiya qilinmaydi (T-012)."""
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    year = await get_year(session, year_id)

    if day < year.starts_on or day > year.ends_on:
        raise ValidationError("Taʼtil kuni oʻquv yili chegarasida boʻlishi kerak.")

    mavjud = await session.scalar(
        select(Holiday).where(Holiday.academic_year_id == year_id, Holiday.day == day)
    )
    if mavjud is not None:
        # Arxivlangani bor boʻlsa — qaytaramiz, yangi qator yaratmaymiz:
        # bazada (yil, kun) unikal.
        if not mavjud.is_archived:
            raise ConflictError("Bu kun allaqachon taʼtil sifatida belgilangan.")
        mavjud.is_archived = False
        mavjud.archived_at = None
        mavjud.title = title.strip()
        audit_service.record(
            session,
            object_type="holiday",
            object_id=mavjud.id,
            action=AuditAction.UPDATE,
            old={"is_archived": True},
            new={"is_archived": False, "title": mavjud.title},
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()
        return mavjud

    holiday = Holiday(academic_year_id=year_id, day=day, title=title.strip())
    session.add(holiday)
    await session.flush()
    audit_service.record(
        session,
        object_type="holiday",
        object_id=holiday.id,
        action=AuditAction.CREATE,
        new={"day": day, "title": holiday.title},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return holiday


async def archive_holiday(
    session: AsyncSession, *, actor: CurrentUser, holiday_id: uuid.UUID, ip: str | None = None
) -> Holiday:
    """Taʼtil kunini roʻyxatdan chiqaradi. Oʻchirish YOʻQ (1-qoida)."""
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)

    holiday = await session.get(Holiday, holiday_id)
    if holiday is None:
        raise NotFoundError("Taʼtil kuni topilmadi.")
    if holiday.is_archived:
        return holiday

    holiday.is_archived = True
    holiday.archived_at = utcnow()
    audit_service.record(
        session,
        object_type="holiday",
        object_id=holiday.id,
        action=AuditAction.ARCHIVE,
        old={"day": holiday.day, "title": holiday.title},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return holiday


async def is_holiday(session: AsyncSession, year_id: uuid.UUID, day: date) -> bool:
    """T-012: shu kunga dars yaratiladimi."""
    row = await session.scalar(
        select(Holiday.id).where(
            Holiday.academic_year_id == year_id,
            Holiday.day == day,
            Holiday.is_archived.is_(False),
        )
    )
    return row is not None


# ─────────────────────── Qoʻngʻiroqlar jadvali ───────────────────────


async def list_bells(session: AsyncSession, year_id: uuid.UUID) -> list[BellSchedule]:
    rows = await session.execute(
        select(BellSchedule)
        .where(BellSchedule.academic_year_id == year_id, BellSchedule.is_archived.is_(False))
        .order_by(BellSchedule.period)
    )
    return list(rows.scalars())


def _assert_bells_valid(bells: list[BellIn]) -> None:
    if not bells:
        raise ValidationError("Kamida bitta para kiritilishi kerak.")
    if len(bells) > MAX_PERIODS:
        raise ValidationError(f"Paralar soni {MAX_PERIODS} tadan oshmasin.")

    raqamlar = [b.period for b in bells]
    if len(set(raqamlar)) != len(raqamlar):
        raise ValidationError("Para raqami takrorlanmasin.")
    if any(r < 1 or r > MAX_PERIODS for r in raqamlar):
        raise ValidationError(f"Para raqami 1 dan {MAX_PERIODS} gacha boʻlsin.")

    for b in bells:
        if b.ends_at <= b.starts_at:
            raise ValidationError(f"{b.period}-para tugashi boshlanishidan keyin boʻlsin.")

    tartibli = sorted(bells, key=lambda b: b.starts_at)
    for oldingi, keyingi in zip(tartibli, tartibli[1:], strict=False):
        if keyingi.starts_at < oldingi.ends_at:
            raise ConflictError(f"{oldingi.period}-para va {keyingi.period}-para vaqti qoplanadi.")


async def set_bells(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    year_id: uuid.UUID,
    bells: list[BellIn],
    ip: str | None = None,
) -> list[BellSchedule]:
    """Qoʻngʻiroqlar jadvalini YAXLIT yozadi (ADM-07).

    Vaqt mahalliy (Asia/Tashkent) saqlanadi — bu kun ichidagi jadval,
    sana emas (`models/academic.py` ga qara).
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    await get_year(session, year_id)
    _assert_bells_valid(bells)

    mavjud = {b.period: b for b in await list_bells(session, year_id)}
    kelgan = {b.period for b in bells}

    for kirish in bells:
        row = mavjud.get(kirish.period)
        if row is None:
            row = BellSchedule(
                academic_year_id=year_id,
                period=kirish.period,
                starts_at=kirish.starts_at,
                ends_at=kirish.ends_at,
            )
            session.add(row)
            await session.flush()
            audit_service.record(
                session,
                object_type="bell_schedule",
                object_id=row.id,
                action=AuditAction.CREATE,
                new={
                    "period": row.period,
                    "starts_at": row.starts_at,
                    "ends_at": row.ends_at,
                },
                actor_id=actor.id,
                ip=ip,
            )
            continue

        before = {"starts_at": row.starts_at, "ends_at": row.ends_at}
        after = {"starts_at": kirish.starts_at, "ends_at": kirish.ends_at}
        eski, yangi = audit_service.diff(before, after)
        if not yangi:
            continue
        row.starts_at = after["starts_at"]
        row.ends_at = after["ends_at"]
        audit_service.record(
            session,
            object_type="bell_schedule",
            object_id=row.id,
            action=AuditAction.UPDATE,
            old=eski,
            new=yangi,
            actor_id=actor.id,
            ip=ip,
        )

    for period, row in mavjud.items():
        if period in kelgan:
            continue
        row.is_archived = True
        row.archived_at = utcnow()
        audit_service.record(
            session,
            object_type="bell_schedule",
            object_id=row.id,
            action=AuditAction.ARCHIVE,
            old={"period": period},
            new={"is_archived": True},
            actor_id=actor.id,
            ip=ip,
        )

    await session.commit()
    return await list_bells(session, year_id)
