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

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.timeutil import combine_local, utcnow
from app.models import (
    AuditAction,
    Holiday,
    Lesson,
    Permission,
    ScheduleEntry,
    SchoolClass,
    Subject,
    User,
)
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


# ─────────────── Jadval istisnolari (ADM-10) ───────────────


@dataclass(frozen=True, slots=True)
class LessonException:
    lesson_id: uuid.UUID
    lesson_date: date
    period: int
    class_name: str
    subject_name: str
    teacher_name: str
    room: str | None
    is_cancelled: bool
    cancel_reason: str | None
    is_substituted: bool
    exception_note: str | None


async def _lesson_for_exception(session: AsyncSession, lesson_id: uuid.UUID) -> Lesson:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None or lesson.is_archived:
        raise NotFoundError("Dars topilmadi.")
    return lesson


async def _assert_teacher_free(
    session: AsyncSession,
    *,
    teacher_id: uuid.UUID,
    day: date,
    period: int,
    except_lesson_id: uuid.UUID,
) -> None:
    """ADM-09: bitta ustoz bir vaqtda ikki joyda dars bera olmaydi.

    Bekor qilingan dars hisobga OLINMAYDI — u oʻtmaydi, demak ustoz
    band emas.
    """
    band = (
        await session.execute(
            select(Lesson.id).where(
                Lesson.teacher_id == teacher_id,
                Lesson.lesson_date == day,
                Lesson.period == period,
                Lesson.id != except_lesson_id,
                Lesson.is_archived.is_(False),
                Lesson.cancelled_at.is_(None),
            )
        )
    ).first()
    if band is not None:
        raise ConflictError("Bu ustozning shu kuni shu parada boshqa darsi bor.")


async def cancel_lesson(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    lesson_id: uuid.UUID,
    reason: str,
    ip: str | None = None,
) -> Lesson:
    """ADM-10: darsni bekor qiladi. Sabab majburiy.

    Dars oʻchirilmaydi va arxivlanmaydi — u jadvalda «bekor qilingan»
    boʻlib turadi. Shunda oila «dars nega yoʻq edi?» degan savolga
    javob topadi va keyingi generatsiya darsni qayta yaratmaydi.
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    lesson = await _lesson_for_exception(session, lesson_id)

    sabab = reason.strip()
    if len(sabab) < 3:
        raise ValidationError("Bekor qilish sababini yozing.")
    if lesson.cancelled_at is not None:
        raise ConflictError("Bu dars allaqachon bekor qilingan.")

    lesson.cancelled_at = utcnow()
    lesson.cancel_reason = sabab

    audit_service.record(
        session,
        object_type="lesson",
        object_id=lesson.id,
        action=AuditAction.UPDATE,
        old={"cancelled": False},
        new={"cancelled": True, "reason": sabab},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    await session.refresh(lesson)
    return lesson


async def restore_lesson(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    lesson_id: uuid.UUID,
    ip: str | None = None,
) -> Lesson:
    """Bekor qilishni orqaga qaytaradi — xato bosilgan boʻlsa."""
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    lesson = await _lesson_for_exception(session, lesson_id)
    if lesson.cancelled_at is None:
        raise ConflictError("Bu dars bekor qilinmagan.")

    # Ustoz oraliqda boshqa joyga qoʻyilgan boʻlishi mumkin.
    await _assert_teacher_free(
        session,
        teacher_id=lesson.teacher_id,
        day=lesson.lesson_date,
        period=lesson.period,
        except_lesson_id=lesson.id,
    )

    lesson.cancelled_at = None
    lesson.cancel_reason = None
    audit_service.record(
        session,
        object_type="lesson",
        object_id=lesson.id,
        action=AuditAction.UPDATE,
        old={"cancelled": True},
        new={"cancelled": False},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    await session.refresh(lesson)
    return lesson


async def substitute_teacher(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    lesson_id: uuid.UUID,
    teacher_id: uuid.UUID,
    note: str | None = None,
    ip: str | None = None,
) -> Lesson:
    """ADM-10: ustozni SHU DARSGA vaqtincha almashtiradi.

    Jadval (`schedule_entries`) tegilmaydi — almashtirish bitta sanaga
    tegishli. Davomat va baho darsga bogʻlangani uchun (T-013), yangi
    ustoz shu darsning davomatini oʻzi belgilaydi.
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    lesson = await _lesson_for_exception(session, lesson_id)

    if lesson.cancelled_at is not None:
        raise ConflictError("Bekor qilingan darsga ustoz tayinlanmaydi.")

    yangi = await session.get(User, teacher_id)
    if yangi is None or yangi.is_archived:
        raise NotFoundError("Ustoz topilmadi.")
    if not yangi.is_active:
        raise ValidationError("Faolsizlantirilgan xodimga dars berib boʻlmaydi.")

    if lesson.teacher_id == teacher_id:
        raise ConflictError("Bu dars allaqachon shu ustozda.")

    await _assert_teacher_free(
        session,
        teacher_id=teacher_id,
        day=lesson.lesson_date,
        period=lesson.period,
        except_lesson_id=lesson.id,
    )

    eski_id = lesson.teacher_id
    lesson.teacher_id = teacher_id
    lesson.is_substituted = True
    lesson.exception_note = (note or "").strip() or None

    audit_service.record(
        session,
        object_type="lesson",
        object_id=lesson.id,
        action=AuditAction.UPDATE,
        old={"teacher_id": eski_id},
        new={"teacher_id": teacher_id, "note": lesson.exception_note},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    await session.refresh(lesson)
    return lesson


async def move_lesson(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    lesson_id: uuid.UUID,
    period: int,
    room: str | None = None,
    note: str | None = None,
    ip: str | None = None,
) -> Lesson:
    """ADM-10: darsni shu kunning boshqa parasiga koʻchiradi.

    Vaqt qoʻngʻiroqlar jadvalidan QAYTA hisoblanadi — aks holda
    DAV-03 ning 24 soatlik oynasi eski paraning vaqtidan sanalardi.
    """
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    lesson = await _lesson_for_exception(session, lesson_id)

    if lesson.cancelled_at is not None:
        raise ConflictError("Bekor qilingan darsni koʻchirib boʻlmaydi.")
    if period == lesson.period:
        raise ConflictError("Dars allaqachon shu parada.")

    cls = await session.get(SchoolClass, lesson.class_id)
    if cls is None:
        raise NotFoundError("Sinf topilmadi.")

    bells = {b.period: b for b in await academic_service.list_bells(session, cls.academic_year_id)}
    bell = bells.get(period)
    if bell is None:
        raise ValidationError(f"{period}-para uchun qoʻngʻiroq vaqti belgilanmagan.")

    # Sinf band emasmi. Bazadagi qisman-unique indeks ham ushlab qoladi,
    # lekin tushunarli xato matni shu yerda tugʻiladi.
    band = (
        await session.execute(
            select(Lesson.id).where(
                Lesson.class_id == lesson.class_id,
                Lesson.lesson_date == lesson.lesson_date,
                Lesson.period == period,
                Lesson.id != lesson.id,
                Lesson.is_archived.is_(False),
            )
        )
    ).first()
    if band is not None:
        raise ConflictError("Bu sinfda shu para band.")

    await _assert_teacher_free(
        session,
        teacher_id=lesson.teacher_id,
        day=lesson.lesson_date,
        period=period,
        except_lesson_id=lesson.id,
    )

    eski = {"period": lesson.period, "room": lesson.room}
    lesson.period = period
    if room is not None:
        lesson.room = room.strip() or None
    lesson.starts_at = combine_local(lesson.lesson_date, bell.starts_at)
    lesson.ends_at = combine_local(lesson.lesson_date, bell.ends_at)
    lesson.exception_note = (note or "").strip() or lesson.exception_note

    audit_service.record(
        session,
        object_type="lesson",
        object_id=lesson.id,
        action=AuditAction.UPDATE,
        old=eski,
        new={"period": period, "room": lesson.room},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    await session.refresh(lesson)
    return lesson


async def list_exceptions(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    date_from: date,
    date_to: date,
) -> list[LessonException]:
    """Oraliqdagi istisnolar — bekor qilingan va almashtirilgan darslar."""
    await assert_permission(session, actor, Permission.SCHEDULE_MANAGE)
    if date_to < date_from:
        raise ValidationError("Tugash sanasi boshlanishidan keyin boʻlsin.")

    rows = (
        (
            await session.execute(
                select(Lesson, SchoolClass.name, Subject.name, User.last_name, User.first_name)
                .join(SchoolClass, SchoolClass.id == Lesson.class_id)
                .join(Subject, Subject.id == Lesson.subject_id)
                .join(User, User.id == Lesson.teacher_id)
                .where(
                    Lesson.lesson_date.between(date_from, date_to),
                    Lesson.is_archived.is_(False),
                    or_(
                        Lesson.cancelled_at.is_not(None),
                        Lesson.is_substituted.is_(True),
                    ),
                )
                .order_by(Lesson.lesson_date, Lesson.period)
            )
        )
        .all()
    )

    return [
        LessonException(
            lesson_id=lesson.id,
            lesson_date=lesson.lesson_date,
            period=lesson.period,
            class_name=sinf,
            subject_name=fan,
            teacher_name=f"{familiya} {ism}".strip(),
            room=lesson.room,
            is_cancelled=lesson.cancelled_at is not None,
            cancel_reason=lesson.cancel_reason,
            is_substituted=lesson.is_substituted,
            exception_note=lesson.exception_note,
        )
        for lesson, sinf, fan, familiya, ism in rows
    ]
