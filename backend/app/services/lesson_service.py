"""Jadvaldan konkret darslar generatsiyasi (T-012). TZ: ADM-08 hosilasi.

Davomat va baho **darsga** bogʻlanadi, jadvalga emas. Shu sabab jadval
keyin oʻzgarsa, allaqachon oʻtgan darslar va ulardagi davomat
oʻzgarmaydi — generatsiya faqat YETISHMAYOTGANINI qoʻshadi, mavjudini
hech qachon tahrirlamaydi.

Uchta qoida:

1. **Idempotent.** Bir necha marta ishga tushirilsa ham natija bir xil:
   `(class_id, lesson_date, period)` unikal, mavjud dars oʻtkazib
   yuboriladi.

2. **Taʼtilda dars yaratilmaydi.** `holidays` dagi kun butunlay
   tashlab ketiladi. Dam olish kuni — jadvalda oʻsha hafta kuniga
   yozuv yoʻqligi bilan ifodalanadi.

3. **Vaqt qoʻngʻiroqlar jadvalidan.** Mahalliy vaqt dars sanasi bilan
   birlashtirilib UTC ga oʻgiriladi (CLAUDE.md 3-qoida). Parasi
   qoʻngʻiroqlar jadvalida yoʻq dars YARATILMAYDI — vaqtsiz dars
   DAV-03 ning 24 soatlik oynasini hisoblab bera olmaydi.
"""

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.core.timeutil import combine_local
from app.models import AuditAction, Holiday, Lesson, Permission, ScheduleEntry
from app.services import academic_service, audit_service
from app.services.access import CurrentUser
from app.services.permissions import assert_permission

#: Bir chaqiruvda nechta kun. Bir oʻquv yili ~280 kun; undan uzun
#: oraliq soʻralsa bu xato, himoya emas.
MAX_DAYS = 400


@dataclass(frozen=True, slots=True)
class GenerationResult:
    created: int
    skipped_existing: int
    skipped_holidays: int
    #: Qoʻngʻiroqlar jadvalida parasi yoʻq — vaqtini hisoblab boʻlmadi.
    missing_bells: list[int]
    date_from: date
    date_to: date


async def generate(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    date_from: date,
    date_to: date,
    year_id: uuid.UUID | None = None,
    ip: str | None = None,
) -> GenerationResult:
    """Oraliqdagi har kun uchun jadvaldan darslar yaratadi.

    Huquq: `schedule.manage`.
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)

    if date_to < date_from:
        raise ValidationError("Tugash sanasi boshlanishidan keyin boʻlsin.")
    if (date_to - date_from).days + 1 > MAX_DAYS:
        raise ValidationError(f"Oraliq {MAX_DAYS} kundan oshmasin.")

    if year_id is None:
        year = await academic_service.current_year(session)
        if year is None:
            raise NotFoundError("Joriy oʻquv yili belgilanmagan.")
        year_id = year.id

    entries = list(
        (
            await session.execute(
                select(ScheduleEntry).where(
                    ScheduleEntry.academic_year_id == year_id,
                    ScheduleEntry.is_archived.is_(False),
                )
            )
        ).scalars()
    )
    if not entries:
        return GenerationResult(0, 0, 0, [], date_from, date_to)

    # Hafta kuni boʻyicha guruhlash — har kun uchun butun jadvalni
    # qayta koʻrib chiqmaslik uchun.
    by_weekday: dict[int, list[ScheduleEntry]] = {}
    for e in entries:
        by_weekday.setdefault(e.weekday, []).append(e)

    bells = {b.period: b for b in await academic_service.list_bells(session, year_id)}

    holidays = set(
        (
            await session.execute(
                select(Holiday.day).where(
                    Holiday.academic_year_id == year_id,
                    Holiday.is_archived.is_(False),
                    Holiday.day.between(date_from, date_to),
                )
            )
        ).scalars()
    )

    # Mavjud darslar bitta soʻrovda — har kun uchun alohida soʻralsa
    # bir chorakda 90 marta bazaga borilardi.
    mavjud = {
        (cls, kun, para)
        for cls, kun, para in (
            await session.execute(
                select(Lesson.class_id, Lesson.lesson_date, Lesson.period).where(
                    Lesson.lesson_date.between(date_from, date_to),
                    Lesson.is_archived.is_(False),
                )
            )
        ).all()
    }

    created = 0
    skipped_existing = 0
    skipped_holidays = 0
    missing: set[int] = set()

    kun = date_from
    while kun <= date_to:
        if kun in holidays:
            skipped_holidays += 1
            kun += timedelta(days=1)
            continue

        for entry in by_weekday.get(kun.isoweekday(), []):
            if (entry.class_id, kun, entry.period) in mavjud:
                skipped_existing += 1
                continue

            bell = bells.get(entry.period)
            if bell is None:
                missing.add(entry.period)
                continue

            session.add(
                Lesson(
                    schedule_entry_id=entry.id,
                    class_id=entry.class_id,
                    subject_id=entry.subject_id,
                    teacher_id=entry.teacher_id,
                    lesson_date=kun,
                    period=entry.period,
                    room=entry.room,
                    starts_at=combine_local(kun, bell.starts_at),
                    ends_at=combine_local(kun, bell.ends_at),
                )
            )
            # Shu chaqiruv ichida ikki marta yaratilmasin.
            mavjud.add((entry.class_id, kun, entry.period))
            created += 1

        kun += timedelta(days=1)

    if created:
        audit_service.record(
            session,
            object_type="lessons",
            action=AuditAction.CREATE,
            new={
                "date_from": date_from,
                "date_to": date_to,
                "created": created,
            },
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()

    return GenerationResult(
        created=created,
        skipped_existing=skipped_existing,
        skipped_holidays=skipped_holidays,
        missing_bells=sorted(missing),
        date_from=date_from,
        date_to=date_to,
    )


async def generate_term(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    term_id: uuid.UUID,
    ip: str | None = None,
) -> GenerationResult:
    """Butun chorak uchun darslar (T-012 asosiy stsenariysi)."""
    from app.models import Term

    term = await session.get(Term, term_id)
    if term is None or term.is_archived:
        raise NotFoundError("Chorak topilmadi.")

    return await generate(
        session,
        actor=actor,
        date_from=term.starts_on,
        date_to=term.ends_on,
        year_id=term.academic_year_id,
        ip=ip,
    )
