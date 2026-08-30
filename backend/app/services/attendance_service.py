"""Davomat (T-013). TZ: DAV-01, DAV-03, DAV-06, DAV-07.

Uchta qoida butun modulni belgilaydi:

1. **DAV-03 — 24 soatlik oyna.** Ustoz oʻz darsining davomatini dars
   TUGAGANIDAN keyin 24 soat ichida tahrirlaydi. Keyin faqat
   administrator. Oyna dars boshlanishidan emas, `ends_at` dan
   sanaladi — kechki para ustozi ham ertasi kuni tuzata olsin.

2. **Har oʻzgarish auditga.** Eski va yangi qiymat bilan (CLAUDE.md
   4-qoida). Yangi yozuv ham, oʻzgargani ham. Oʻzgarmagan qator
   auditga tushmaydi — aks holda jurnal shovqin bilan toʻlardi.

3. **Hech narsa oʻchirilmaydi.** Roʻyxatdan chiqarilgan oʻquvchi
   yozuvi arxivlanadi, `DELETE` yoʻq.
"""

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import EditWindowClosedError, NotFoundError, ValidationError
from app.core.timeutil import utcnow
from app.models import (
    AttendanceRecord,
    AttendanceStatus,
    AuditAction,
    Lesson,
    SchoolClass,
    Student,
)
from app.services import audit_service
from app.services.access import CurrentUser, accessible_student_ids, load_lesson_for_teacher

_VALID = {s.value for s in AttendanceStatus}
#: Davomat foizida "kelgan" deb hisoblanadigan holatlar. Kechikkan
#: oʻquvchi darsda boʻlgan — uni kelmaganga qoʻshish notoʻgʻri boʻlardi.
_PRESENT_LIKE = (AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value)


@dataclass(frozen=True, slots=True)
class MarkRow:
    """Bitta oʻquvchining davomati."""

    student_id: uuid.UUID
    status: str
    note: str | None = None


@dataclass(frozen=True, slots=True)
class MarkResult:
    created: int
    updated: int
    unchanged: int


def edit_deadline(lesson: Lesson):
    """DAV-03: shu vaqtdan keyin ustoz tahrirlay olmaydi."""
    return lesson.ends_at + timedelta(hours=settings.attendance_edit_window_hours)


def can_teacher_edit(lesson: Lesson) -> bool:
    return utcnow() <= edit_deadline(lesson)


async def _assert_can_edit(session: AsyncSession, user: CurrentUser, lesson: Lesson) -> None:
    """Kim tahrirlay oladi.

    Administrator har doim (DAV-03 ning ikkinchi yarmi). Ustoz — faqat
    oyna ichida. Sinf rahbari ham ustoz sifatida, oʻz sinfining darsiga.
    """
    if user.is_staff_wide:
        return
    if not can_teacher_edit(lesson):
        raise EditWindowClosedError(
            "Bu darsni tahrirlash muddati tugagan "
            f"({settings.attendance_edit_window_hours} soat). "
            "Oʻzgartirish uchun administratorga murojaat qiling."
        )


async def _roster(session: AsyncSession, class_id: uuid.UUID) -> list[Student]:
    """Sinfdagi faol oʻquvchilar, familiya boʻyicha."""
    rows = await session.execute(
        select(Student)
        .where(Student.class_id == class_id, Student.is_archived.is_(False))
        .order_by(Student.last_name, Student.first_name)
    )
    return list(rows.scalars())


async def get_lesson_attendance(
    session: AsyncSession, user: CurrentUser, lesson_id: uuid.UUID
) -> tuple[Lesson, list[Student], dict[uuid.UUID, AttendanceRecord]]:
    """Dars, sinf roʻyxati va mavjud yozuvlar.

    Roʻyxat HAR DOIM toʻliq qaytadi — davomat hali belgilanmagan boʻlsa
    ham. Aks holda ustoz boʻsh ekran koʻrardi va kimni belgilashini
    bilmasdi.
    """
    lesson = await load_lesson_for_teacher(session, user, lesson_id)

    # `session.get` identity map dan qaytarishi mumkin — u holda `lazy="joined"`
    # ishlamaydi va `lesson.school_class` ga birinchi murojaatda sinxron
    # kontekstda lazy load boshlanib, `MissingGreenlet` bilan yiqiladi.
    # Shuning uchun bogʻliqliklar ATAYLAB oldindan yuklanadi.
    await session.refresh(lesson, attribute_names=["school_class", "subject"])

    students = await _roster(session, lesson.class_id)

    rows = await session.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.lesson_id == lesson_id,
            AttendanceRecord.is_archived.is_(False),
        )
    )
    mavjud = {r.student_id: r for r in rows.scalars()}
    return lesson, students, mavjud


async def mark_attendance(
    session: AsyncSession,
    user: CurrentUser,
    lesson_id: uuid.UUID,
    rows: list[MarkRow],
    *,
    topic: str | None = None,
    ip: str | None = None,
) -> MarkResult:
    """Butun sinf davomati bitta soʻrovda (DAV-01).

    Nima uchun bitta soʻrov: ustoz 25 kishilik sinfni belgilaydi va
    yarmi saqlanib, yarmi saqlanmasligi mumkin boʻlmasligi kerak —
    hammasi bitta tranzaksiyada.
    """
    lesson = await load_lesson_for_teacher(session, user, lesson_id)
    await _assert_can_edit(session, user, lesson)

    if not rows:
        raise ValidationError("Davomat roʻyxati boʻsh.")

    notogri = {r.status for r in rows} - _VALID
    if notogri:
        raise ValidationError(f"Nomaʼlum davomat holati: {', '.join(sorted(notogri))}")

    students = await _roster(session, lesson.class_id)
    sinfdagi = {s.id for s in students}

    begona = {r.student_id for r in rows} - sinfdagi
    if begona:
        # Ataylab umumiy xabar: qaysi id mavjudligi oshkor qilinmaydi (X-3).
        raise ValidationError("Roʻyxatda bu sinfga tegishli boʻlmagan oʻquvchi bor.")

    takror = len(rows) - len({r.student_id for r in rows})
    if takror:
        raise ValidationError("Bitta oʻquvchi roʻyxatda ikki marta kelgan.")

    mavjud_rows = await session.execute(
        select(AttendanceRecord).where(AttendanceRecord.lesson_id == lesson_id)
    )
    mavjud = {r.student_id: r for r in mavjud_rows.scalars()}

    now = utcnow()
    created = updated = unchanged = 0

    for row in rows:
        eski = mavjud.get(row.student_id)
        note = (row.note or "").strip() or None

        if eski is None:
            session.add(
                AttendanceRecord(
                    lesson_id=lesson_id,
                    student_id=row.student_id,
                    status=row.status,
                    note=note,
                    marked_by_id=user.id,
                    marked_at=now,
                )
            )
            created += 1
            audit_service.record(
                session,
                object_type="attendance",
                object_id=lesson_id,
                action=AuditAction.CREATE,
                new={"student_id": row.student_id, "status": row.status, "note": note},
                actor_id=user.id,
                ip=ip,
            )
            continue

        if eski.status == row.status and eski.note == note and not eski.is_archived:
            # Oʻzgarmagan qator auditga tushmaydi — jurnal shovqin bilan
            # toʻlsa, haqiqiy oʻzgarishni topib boʻlmay qoladi.
            unchanged += 1
            continue

        audit_service.record(
            session,
            object_type="attendance",
            object_id=lesson_id,
            action=AuditAction.UPDATE,
            old={"student_id": row.student_id, "status": eski.status, "note": eski.note},
            new={"student_id": row.student_id, "status": row.status, "note": note},
            actor_id=user.id,
            ip=ip,
        )
        eski.status = row.status
        eski.note = note
        eski.marked_by_id = user.id
        eski.marked_at = now
        eski.is_archived = False
        eski.archived_at = None
        updated += 1

    # Mavzu davomat bilan birga saqlanadi (JUR-01): ustoz nima oʻtganini
    # keyin eslab oʻtirmasin.
    if topic is not None:
        yangi_mavzu = topic.strip() or None
        if yangi_mavzu != lesson.topic:
            audit_service.record(
                session,
                object_type="lesson",
                object_id=lesson_id,
                action=AuditAction.UPDATE,
                old={"topic": lesson.topic},
                new={"topic": yangi_mavzu},
                actor_id=user.id,
                ip=ip,
            )
            lesson.topic = yangi_mavzu

    lesson.attendance_marked_at = now
    await session.commit()

    return MarkResult(created=created, updated=updated, unchanged=unchanged)


# ─────────────────────────── DAV-06: foizlar ───────────────────────────


def _scope_filter(stmt: Select, allowed: set[uuid.UUID] | None) -> Select:
    """Kirish nazoratini SOʻROV darajasida qoʻllaydi (X-1).

    `None` — cheklov yoʻq (admin, direktor). Boʻsh toʻplam — hech narsa
    koʻrinmaydi; `in_(())` ataylab: filtrni butunlay tushirib qoldirsak
    ruxsatsiz odam butun maktabni koʻrardi.
    """
    if allowed is None:
        return stmt
    return stmt.where(AttendanceRecord.student_id.in_(allowed))


@dataclass(frozen=True, slots=True)
class AttendanceStat:
    total: int
    present: int
    absent: int
    excused: int
    late: int

    @property
    def percent(self) -> float:
        """Kelgan (kechikkan ham) ulushi. Dars boʻlmasa 100 emas, 0."""
        if self.total == 0:
            return 0.0
        kelgan = self.present + self.late
        return round(kelgan * 100 / self.total, 1)


async def attendance_stats(
    session: AsyncSession,
    user: CurrentUser,
    *,
    student_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> AttendanceStat:
    """DAV-06: oʻquvchi / sinf / fan / ustoz kesimida davomat foizi.

    Kesimlar birga ishlatilishi mumkin: "7-A sinfning matematikadan
    sentabrdagi davomati".
    """
    allowed = await accessible_student_ids(session, user)
    if allowed is not None and student_id is not None and student_id not in allowed:
        # 403 emas, boʻsh natija ham emas — access qatlami hal qiladi.
        from app.services.access import assert_can_view_student

        await assert_can_view_student(session, user, student_id)

    stmt = (
        select(AttendanceRecord.status, func.count())
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(AttendanceRecord.is_archived.is_(False))
        .group_by(AttendanceRecord.status)
    )
    stmt = _scope_filter(stmt, allowed)

    if student_id is not None:
        stmt = stmt.where(AttendanceRecord.student_id == student_id)
    if class_id is not None:
        stmt = stmt.where(Lesson.class_id == class_id)
    if subject_id is not None:
        stmt = stmt.where(Lesson.subject_id == subject_id)
    if teacher_id is not None:
        stmt = stmt.where(Lesson.teacher_id == teacher_id)
    if date_from is not None:
        stmt = stmt.where(Lesson.lesson_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Lesson.lesson_date <= date_to)

    hisob = dict((await session.execute(stmt)).all())
    return AttendanceStat(
        total=sum(hisob.values()),
        present=hisob.get(AttendanceStatus.PRESENT.value, 0),
        absent=hisob.get(AttendanceStatus.ABSENT.value, 0),
        excused=hisob.get(AttendanceStatus.EXCUSED.value, 0),
        late=hisob.get(AttendanceStatus.LATE.value, 0),
    )


async def class_student_stats(
    session: AsyncSession,
    user: CurrentUser,
    class_id: uuid.UUID,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[tuple[Student, AttendanceStat]]:
    """Sinfdagi har bir oʻquvchining davomati — sinf rahbari koʻrinishi.

    Bitta soʻrov: har oʻquvchi uchun alohida soʻrov yuborilsa 25 kishilik
    sinfda 25 marta bazaga borilardi (N+1).
    """
    sinf = await session.get(SchoolClass, class_id)
    if sinf is None or sinf.is_archived:
        raise NotFoundError("Sinf topilmadi.")

    allowed = await accessible_student_ids(session, user)
    students = await _roster(session, class_id)
    if allowed is not None:
        students = [s for s in students if s.id in allowed]

    stmt = (
        select(AttendanceRecord.student_id, AttendanceRecord.status, func.count())
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(
            AttendanceRecord.is_archived.is_(False),
            Lesson.class_id == class_id,
        )
        .group_by(AttendanceRecord.student_id, AttendanceRecord.status)
    )
    stmt = _scope_filter(stmt, allowed)
    if date_from is not None:
        stmt = stmt.where(Lesson.lesson_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Lesson.lesson_date <= date_to)

    yigilgan: dict[uuid.UUID, dict[str, int]] = {}
    for sid, status, count in (await session.execute(stmt)).all():
        yigilgan.setdefault(sid, {})[status] = count

    natija = []
    for s in students:
        h = yigilgan.get(s.id, {})
        natija.append(
            (
                s,
                AttendanceStat(
                    total=sum(h.values()),
                    present=h.get(AttendanceStatus.PRESENT.value, 0),
                    absent=h.get(AttendanceStatus.ABSENT.value, 0),
                    excused=h.get(AttendanceStatus.EXCUSED.value, 0),
                    late=h.get(AttendanceStatus.LATE.value, 0),
                ),
            )
        )
    return natija


@dataclass(frozen=True, slots=True)
class LessonCounts:
    """Dars kartochkasidagi "22/25 belgilandi" uchun."""

    students: int
    marked: int
    present: int


async def lesson_counts(
    session: AsyncSession, lessons: list[Lesson]
) -> dict[uuid.UUID, LessonCounts]:
    """Bir necha dars uchun sanoqlarni IKKI soʻrovda yigʻadi.

    Har dars uchun alohida soʻrov yuborilsa, 7 parali kunda 14 marta
    bazaga borilardi (N+1). Sinf roʻyxati sinf boʻyicha, davomat esa
    dars boʻyicha guruhlanadi.
    """
    if not lessons:
        return {}

    class_ids = {lesson.class_id for lesson in lessons}
    roster_rows = await session.execute(
        select(Student.class_id, func.count())
        .where(Student.class_id.in_(class_ids), Student.is_archived.is_(False))
        .group_by(Student.class_id)
    )
    roster = dict(roster_rows.all())

    lesson_ids = [lesson.id for lesson in lessons]
    mark_rows = await session.execute(
        select(AttendanceRecord.lesson_id, AttendanceRecord.status, func.count())
        .where(
            AttendanceRecord.lesson_id.in_(lesson_ids),
            AttendanceRecord.is_archived.is_(False),
        )
        .group_by(AttendanceRecord.lesson_id, AttendanceRecord.status)
    )
    yigilgan: dict[uuid.UUID, dict[str, int]] = {}
    for lid, status, count in mark_rows.all():
        yigilgan.setdefault(lid, {})[status] = count

    natija = {}
    for lesson in lessons:
        h = yigilgan.get(lesson.id, {})
        natija[lesson.id] = LessonCounts(
            students=roster.get(lesson.class_id, 0),
            marked=sum(h.values()),
            present=sum(h.get(st, 0) for st in _PRESENT_LIKE),
        )
    return natija


async def teacher_lessons(session: AsyncSession, user: CurrentUser, day: date) -> list[Lesson]:
    """Ustozning shu kundagi darslari (DAV-01 ekrani uchun).

    Administrator boshqa ustoz nomidan koʻrmaydi — bu endpoint aynan
    "mening darslarim". Boshqa kesim kerak boʻlsa alohida endpoint.
    """
    rows = await session.execute(
        select(Lesson)
        .options(selectinload(Lesson.school_class), selectinload(Lesson.subject))
        .where(
            Lesson.teacher_id == user.id,
            Lesson.lesson_date == day,
            Lesson.is_archived.is_(False),
        )
        .order_by(Lesson.period)
    )
    return list(rows.scalars())
