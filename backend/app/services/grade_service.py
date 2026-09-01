"""Elektron jurnal — baho qoʻyish va chorak bahosi (JUR-01…JUR-07).

Bu modul loyiha egasi aytgan beshta qoidani bajaradi. Har biri
serverda, chunki frontenddagi tekshiruv himoya emas (CLAUDE.md 7-qoida):

1. **Ustoz faqat oʻzi dars beradigan sinfda baho qoʻyadi** va faqat
   **oʻz fanidan**. Fanni bilishi yetarli emas — jadvalda oʻsha sinfda
   oʻsha fandan darsi boʻlishi kerak.

2. **Baho DARSGA bogʻlanadi**, sanaga emas. Shu sabab ustoz boshqa
   kunning bahosini oʻzgartira olmaydi: u faqat oʻz darsini ochadi va
   davomat oynasi (DAV-03) baho uchun ham amal qiladi.

3. **Kelmagan yoki sababli oʻquvchiga baho qoʻyilmaydi.** Dars
   qoldirgan bola baho ololmaydi — bu jurnalda eng koʻp uchraydigan
   xato.

4. **Chorak va oʻrtacha baho fan ustoziga koʻrsatilmaydi.** U joriy
   baholarni koʻradi; yakuniy koʻrsatkich sinf rahbari, oʻquv boʻlimi
   va ota-onaga tegishli.

5. **Har oʻzgarish auditga** (CLAUDE.md 4-qoida): eski qiymat, yangi
   qiymat, kim, qachon.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    EditWindowClosedError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.timeutil import utcnow
from app.models import (
    SCALE_MAX,
    AttendanceRecord,
    AttendanceStatus,
    AuditAction,
    Grade,
    GradeKind,
    GradingScale,
    Lesson,
    NotificationKind,
    Permission,
    ScheduleEntry,
    Student,
    Subject,
)
from app.services import attendance_service, audit_service, notifications_service
from app.services.access import (
    CurrentUser,
    accessible_student_ids,
    assert_can_view_student,
    homeroom_class_ids,
    load_lesson_for_teacher,
)
from app.services.permissions import has_permission

#: Baho qoʻyib boʻlmaydigan davomat holatlari (3-qoida).
NO_GRADE_STATUSES = frozenset({AttendanceStatus.ABSENT.value, AttendanceStatus.EXCUSED.value})


@dataclass(frozen=True, slots=True)
class GradeRow:
    id: uuid.UUID
    student_id: uuid.UUID
    value: int
    max_value: int
    kind: str
    weight: int
    comment: str | None
    lesson_id: uuid.UUID | None
    lesson_date: date | None


@dataclass(frozen=True, slots=True)
class JournalStudent:
    student_id: uuid.UUID
    full_name: str
    #: Shu darsdagi davomat holati — `null` boʻlsa hali belgilanmagan.
    attendance: str | None
    #: Baho qoʻyish mumkinmi (3-qoida). Sabab `block_reason` da.
    gradable: bool
    block_reason: str | None
    grade: GradeRow | None


@dataclass(frozen=True, slots=True)
class LessonJournal:
    lesson_id: uuid.UUID
    class_name: str
    subject_name: str
    lesson_date: date
    period: int
    topic: str | None
    editable: bool
    max_value: int
    students: list[JournalStudent]


@dataclass(frozen=True, slots=True)
class GradeInput:
    student_id: uuid.UUID
    #: `None` — bahoni olib tashlash (xato qoʻyilgan boʻlsa).
    value: int | None
    comment: str | None = None


# ─────────────────────────── Ruxsat ───────────────────────────


async def teaches_class_subject(
    session: AsyncSession, user: CurrentUser, class_id: uuid.UUID, subject_id: uuid.UUID
) -> bool:
    """Jadvalda shu sinfda shu fandan darsi bormi.

    Manba jadval, `teacher_subjects` emas: fanni bilishi sinfga kirish
    huquqini bermaydi.
    """
    if user.is_staff_wide:
        return True
    bor = await session.scalar(
        select(ScheduleEntry.id).where(
            ScheduleEntry.teacher_id == user.id,
            ScheduleEntry.class_id == class_id,
            ScheduleEntry.subject_id == subject_id,
            ScheduleEntry.is_archived.is_(False),
        )
    )
    return bor is not None


async def assert_teaches_class_subject(
    session: AsyncSession, user: CurrentUser, class_id: uuid.UUID, subject_id: uuid.UUID
) -> None:
    if not await teaches_class_subject(session, user, class_id, subject_id):
        raise PermissionDeniedError("Bu fandan bu sinfda ish yurita olmaysiz.")


async def _assert_teaches(session: AsyncSession, user: CurrentUser, lesson: Lesson) -> None:
    """1-qoida: oʻz sinfi va OʻZ fani.

    `load_lesson_for_teacher` darsning ustozga tegishliligini tekshiradi,
    lekin sinf rahbari uchun u oʻz sinfining HAR QANDAY darsini ochadi
    (DAV-02) — davomat uchun toʻgʻri, baho uchun emas. Sinf rahbari
    boshqa ustozning fanidan baho qoʻymasligi kerak.
    """
    if lesson.teacher_id == user.id:
        return
    if await teaches_class_subject(session, user, lesson.class_id, lesson.subject_id):
        return
    raise PermissionDeniedError("Bu fandan bu sinfda baho qoʻya olmaysiz.")


async def _assert_can_edit(session: AsyncSession, user: CurrentUser, lesson: Lesson) -> None:
    """2-qoida: baho oynasi davomat oynasi bilan bir xil (DAV-03).

    Ustoz oʻtgan haftaning bahosini "tuzatib" qoʻya olmaydi — bu jurnal
    ishonchliligining asosi. Administrator `attendance.edit_closed`
    huquqi bilan tuzatadi va bu auditga tushadi.
    """
    if attendance_service.can_teacher_edit(lesson):
        return
    if await has_permission(session, user, Permission.ATTENDANCE_EDIT_CLOSED):
        return
    raise EditWindowClosedError(
        "Bu darsga baho qoʻyish muddati tugagan. Administratorga murojaat qiling."
    )


# ─────────────────────────── Dars jurnali ───────────────────────────


async def lesson_journal(
    session: AsyncSession, user: CurrentUser, lesson_id: uuid.UUID
) -> LessonJournal:
    """Bitta darsning jurnali: oʻquvchi, davomati va bahosi.

    Davomat bilan birga qaytadi — ustoz "kimga baho qoʻysam boʻladi"
    degan savolga bitta ekranda javob olsin (3-qoida).
    """
    lesson = await load_lesson_for_teacher(session, user, lesson_id)
    await _assert_teaches(session, user, lesson)
    await session.refresh(lesson, attribute_names=["school_class", "subject"])

    students = list(
        (
            await session.execute(
                select(Student)
                .where(Student.class_id == lesson.class_id, Student.is_archived.is_(False))
                .order_by(Student.last_name, Student.first_name)
            )
        ).scalars()
    )

    davomat = {
        r.student_id: r.status
        for r in (
            await session.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.lesson_id == lesson_id,
                    AttendanceRecord.is_archived.is_(False),
                )
            )
        ).scalars()
    }

    baholar = {
        g.student_id: g
        for g in (
            await session.execute(
                select(Grade).where(Grade.lesson_id == lesson_id, Grade.is_archived.is_(False))
            )
        ).scalars()
    }

    tahrirlanadi = attendance_service.can_teacher_edit(lesson) or await has_permission(
        session, user, Permission.ATTENDANCE_EDIT_CLOSED
    )

    qatorlar = []
    for s in students:
        holat = davomat.get(s.id)
        sabab = _block_reason(holat)
        g = baholar.get(s.id)
        qatorlar.append(
            JournalStudent(
                student_id=s.id,
                full_name=s.full_name,
                attendance=holat,
                gradable=sabab is None,
                block_reason=sabab,
                grade=_row(g, lesson.lesson_date) if g else None,
            )
        )

    return LessonJournal(
        lesson_id=lesson.id,
        class_name=lesson.school_class.name,
        subject_name=lesson.subject.name,
        lesson_date=lesson.lesson_date,
        period=lesson.period,
        topic=lesson.topic,
        editable=tahrirlanadi,
        max_value=SCALE_MAX[GradingScale.FIVE.value],
        students=qatorlar,
    )


def _block_reason(status: str | None) -> str | None:
    """3-qoida. Davomat belgilanmagan boʻlsa ham baho qoʻyilmaydi.

    Sabab: davomatsiz baho "keldi" ni sukut boʻyicha nazarda tutadi va
    keyin davomat "kelmadi" qilib belgilansa, jurnalda ziddiyat qoladi.
    """
    if status is None:
        return "Avval davomat belgilansin."
    if status in NO_GRADE_STATUSES:
        return "Darsda boʻlmagan oʻquvchiga baho qoʻyilmaydi."
    return None


def _row(g: Grade, lesson_date: date | None) -> GradeRow:
    return GradeRow(
        id=g.id,
        student_id=g.student_id,
        value=g.value,
        max_value=g.max_value,
        kind=g.kind,
        weight=g.weight,
        comment=g.comment,
        lesson_id=g.lesson_id,
        lesson_date=lesson_date,
    )


async def set_lesson_grades(
    session: AsyncSession,
    user: CurrentUser,
    lesson_id: uuid.UUID,
    rows: list[GradeInput],
    *,
    kind: str = GradeKind.CURRENT.value,
    weight: int = 1,
    ip: str | None = None,
) -> LessonJournal:
    """Darsga baho qoʻyadi yoki oʻzgartiradi (JUR-01).

    Bitta tranzaksiya: yarim yozilgan jurnal qolmasin. Oʻzgarmagan baho
    auditga tushmaydi — aks holda jurnal har ochilganda audit shishadi.
    """
    lesson = await load_lesson_for_teacher(session, user, lesson_id)
    await _assert_teaches(session, user, lesson)
    await _assert_can_edit(session, user, lesson)

    if kind not in {k.value for k in GradeKind}:
        raise ValidationError("Nomaʼlum baho turi.")
    if weight < 1:
        raise ValidationError("Vazn 1 dan kichik boʻlmasin.")

    max_value = SCALE_MAX[GradingScale.FIVE.value]

    sinf_oquvchilari = set(
        (
            await session.execute(
                select(Student.id).where(
                    Student.class_id == lesson.class_id, Student.is_archived.is_(False)
                )
            )
        ).scalars()
    )

    davomat = {
        r.student_id: r.status
        for r in (
            await session.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.lesson_id == lesson_id,
                    AttendanceRecord.is_archived.is_(False),
                )
            )
        ).scalars()
    }

    mavjud = {
        g.student_id: g
        for g in (
            await session.execute(
                select(Grade).where(Grade.lesson_id == lesson_id, Grade.is_archived.is_(False))
            )
        ).scalars()
    }

    #: Kim haqida oilaga xabar beriladi: (oʻquvchi, baho).
    #: Faqat YANGI baho va QIYMATI oʻzgargani. Izoh tuzatilgani yoki
    #: vazn oʻzgargani oilaga xabar boʻlmaydi — ular baho emas.
    xabar_uchun: list[tuple[uuid.UUID, int]] = []

    for row in rows:
        if row.student_id not in sinf_oquvchilari:
            raise ValidationError("Oʻquvchi bu sinfga tegishli emas.")

        eski = mavjud.get(row.student_id)

        if row.value is None:
            # Xato qoʻyilgan bahoni olib tashlash — arxivlanadi (1-qoida).
            if eski is None:
                continue
            eski.is_archived = True
            eski.archived_at = utcnow()
            audit_service.record(
                session,
                object_type="grade",
                object_id=eski.id,
                action=AuditAction.ARCHIVE,
                old={"value": eski.value},
                new={"is_archived": True},
                actor_id=user.id,
                ip=ip,
            )
            continue

        sabab = _block_reason(davomat.get(row.student_id))
        if sabab is not None:
            raise ValidationError(sabab)

        if row.value < 0 or row.value > max_value:
            raise ValidationError(f"Baho 0 dan {max_value} gacha boʻlsin.")

        izoh = (row.comment or "").strip() or None

        if eski is None:
            yangi = Grade(
                student_id=row.student_id,
                subject_id=lesson.subject_id,
                lesson_id=lesson.id,
                teacher_id=user.id,
                kind=kind,
                value=row.value,
                max_value=max_value,
                weight=weight,
                comment=izoh,
            )
            session.add(yangi)
            await session.flush()
            audit_service.record(
                session,
                object_type="grade",
                object_id=yangi.id,
                action=AuditAction.CREATE,
                new={"student_id": row.student_id, "value": row.value, "kind": kind},
                actor_id=user.id,
                ip=ip,
            )
            xabar_uchun.append((row.student_id, row.value))
            continue

        before = {"value": eski.value, "kind": eski.kind, "comment": eski.comment}
        after = {"value": row.value, "kind": kind, "comment": izoh}
        old_diff, new_diff = audit_service.diff(before, after)
        if not new_diff:
            continue

        # Xabar faqat BAHO oʻzgarganda. Ustoz izohni tuzatgan boʻlsa
        # oilaga «yangi baho» deb ikkinchi marta xabar bermaymiz.
        if eski.value != row.value:
            xabar_uchun.append((row.student_id, row.value))

        eski.value = row.value
        eski.kind = kind
        eski.comment = izoh
        eski.weight = weight
        eski.teacher_id = user.id
        audit_service.record(
            session,
            object_type="grade",
            object_id=eski.id,
            action=AuditAction.UPDATE,
            old=old_diff,
            new=new_diff,
            actor_id=user.id,
            ip=ip,
        )

    await _notify_family(session, user, lesson, max_value, xabar_uchun)
    try:
        await session.commit()
    except IntegrityError as e:
        # Y7: parallel ikki soʻrov bir oʻquvchiga bir darsda baho yozsa,
        # ikkinchisi unique indeksga uriladi — 500 emas, aniq 409.
        await session.rollback()
        raise ConflictError(
            "Baho boshqa oynada allaqachon qoʻyilgan — sahifani yangilang."
        ) from e
    return await lesson_journal(session, user, lesson_id)


async def _notify_family(
    session: AsyncSession,
    user: CurrentUser,
    lesson: Lesson,
    max_value: int,
    changes: list[tuple[uuid.UUID, int]],
) -> None:
    """Yangi baho boʻyicha oilaga xabar (ota-ona va oʻquvchining oʻzi).

    Xabar baho bilan BIR tranzaksiyada yaratiladi: jurnal saqlanmasa
    bildirishnoma ham qolmaydi.

    Ustozning oʻziga xabar ketmaydi — buni `notify()` hal qiladi
    (`actor_id`).
    """
    if not changes:
        return

    student_ids = [sid for sid, _ in changes]
    oila = await notifications_service.family_recipients(session, student_ids)
    nomlar = await notifications_service.student_names(session, student_ids)

    # Fan nomi alohida soʻrov bilan — `lesson.subject` ga murojaat
    # `MissingGreenlet` beradi (`attendance_service` dagi izohga qarang).
    fan = await session.scalar(select(Subject.name).where(Subject.id == lesson.subject_id))
    kun = lesson.lesson_date.strftime("%d.%m.%Y")

    for student_id, value in changes:
        ism = nomlar.get(student_id)
        if ism is None:
            continue
        await notifications_service.notify(
            session,
            recipients=oila.get(student_id, []),
            kind=NotificationKind.GRADE_NEW,
            title=f"{ism} — {fan or 'fan'} fanidan {value} baho",
            body=f"{kun} · {value}/{max_value}",
            object_type="grade",
            object_id=lesson.id,
            actor_id=user.id,
        )


# ─────────────────────── Sinf jurnali (kesim) ───────────────────────


@dataclass(frozen=True, slots=True)
class ClassJournalRow:
    student_id: uuid.UUID
    full_name: str
    #: sana → baho. Bir kunda bir nechta baho boʻlishi mumkin emas
    #: (bitta dars = bitta baho), shuning uchun sana kalit sifatida yetarli.
    grades: dict[str, int]
    #: 4-qoida: fan ustoziga `None`.
    average: float | None


@dataclass(frozen=True, slots=True)
class ClassJournal:
    class_id: uuid.UUID
    subject_id: uuid.UUID
    dates: list[date]
    rows: list[ClassJournalRow]
    #: Oʻrtacha koʻrsatkich koʻrsatiladimi (4-qoida).
    shows_average: bool


async def _can_see_average(session: AsyncSession, user: CurrentUser, class_id: uuid.UUID) -> bool:
    """4-qoida: chorak va oʻrtacha baho fan ustoziga koʻrinmaydi.

    Koʻrsatiladi: administrator, direktor, oʻquv boʻlimi va SHU sinfning
    rahbariga. Sabab — yakuniy koʻrsatkich tarbiyaviy suhbat va hisobot
    uchun; fan ustozi uni koʻrsa, bilmasdan unga qarab baho qoʻya
    boshlaydi.
    """
    if user.is_staff_wide:
        return True
    return class_id in await homeroom_class_ids(session, user.id)


async def class_journal(
    session: AsyncSession,
    user: CurrentUser,
    *,
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
    date_from: date,
    date_to: date,
) -> ClassJournal:
    """Sinf × fan jurnali sana oraligʻida (JUR-01).

    Ustoz oʻz fanini koʻradi; boshqa fanni soʻrasa `403` (1-qoida).
    """
    if date_to < date_from:
        raise ValidationError("Tugash sanasi boshlanishidan keyin boʻlsin.")

    if not user.is_staff_wide:
        ruxsat = await session.scalar(
            select(ScheduleEntry.id).where(
                ScheduleEntry.teacher_id == user.id,
                ScheduleEntry.class_id == class_id,
                ScheduleEntry.subject_id == subject_id,
                ScheduleEntry.is_archived.is_(False),
            )
        )
        if ruxsat is None and class_id not in await homeroom_class_ids(session, user.id):
            raise PermissionDeniedError("Bu sinf jurnalini koʻrishga ruxsatingiz yoʻq.")

    students = list(
        (
            await session.execute(
                select(Student)
                .where(Student.class_id == class_id, Student.is_archived.is_(False))
                .order_by(Student.last_name, Student.first_name)
            )
        ).scalars()
    )

    # Baholar darslar orqali — bitta soʻrovda, N+1 boʻlmasin.
    rows = (
        await session.execute(
            select(Grade, Lesson.lesson_date)
            .join(Lesson, Lesson.id == Grade.lesson_id)
            .where(
                Grade.subject_id == subject_id,
                Grade.is_archived.is_(False),
                Lesson.class_id == class_id,
                Lesson.lesson_date.between(date_from, date_to),
            )
        )
    ).all()

    sanalar: set[date] = set()
    by_student: dict[uuid.UUID, dict[str, int]] = {}
    ogirlik: dict[uuid.UUID, tuple[int, int]] = {}

    for g, kun in rows:
        sanalar.add(kun)
        by_student.setdefault(g.student_id, {})[kun.isoformat()] = g.value
        sum_v, sum_w = ogirlik.get(g.student_id, (0.0, 0))
        # K1: 100 ballik baho (uy vazifasi) 5 ballik shkalaga keltiriladi —
        # aks holda 85/100 jurnalda "85" sifatida qoʻshilib oʻrtachani buzardi.
        ogirlik[g.student_id] = (sum_v + _normalized(g) * g.weight, sum_w + g.weight)

    koʻrsatiladi = await _can_see_average(session, user, class_id)

    return ClassJournal(
        class_id=class_id,
        subject_id=subject_id,
        dates=sorted(sanalar),
        shows_average=koʻrsatiladi,
        rows=[
            ClassJournalRow(
                student_id=s.id,
                full_name=s.full_name,
                grades=by_student.get(s.id, {}),
                average=_average(ogirlik.get(s.id)) if koʻrsatiladi else None,
            )
            for s in students
        ],
    )


def _normalized(g: Grade) -> float:
    """Bahoni 5 ballik shkalaga keltiradi (K1).

    Jurnal oʻrtachasi BITTA shkalada boʻlishi shart: 100 ballik uy
    vazifasi bahosi (masalan 85/100) xom holida qoʻshilsa, oʻquvchining
    "oʻrtachasi" 20+ boʻlib chiqardi. `max_value >= 1` servisda
    kafolatlangan.
    """
    scale = SCALE_MAX[GradingScale.FIVE.value]
    if g.max_value == scale:
        return float(g.value)
    return g.value * scale / g.max_value


def _average(pair: tuple[float, int] | None) -> float | None:
    """Vaznli oʻrtacha (JUR-03). Baho yoʻq boʻlsa `None` — 0 EMAS.

    0 "ikki oldi" degan maʼnoni berardi; baho qoʻyilmagani boshqa narsa.
    """
    if pair is None or pair[1] == 0:
        return None
    return round(pair[0] / pair[1], 2)


# ─────────────────────── Oʻquvchi kesimi ───────────────────────


@dataclass(frozen=True, slots=True)
class StudentSubjectGrades:
    subject_id: uuid.UUID
    subject_name: str
    grades: list[GradeRow]
    average: float | None


async def student_grades(
    session: AsyncSession,
    user: CurrentUser,
    student_id: uuid.UUID,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StudentSubjectGrades]:
    """Bitta oʻquvchining fanlar kesimidagi baholari (JUR-05).

    Ota-ona kabineti va oʻquvchi kabineti shu yerdan oziqlanadi.
    Kirish nazorati `access.py` da — ota-ona faqat oʻz farzandini
    koʻradi (X-1).
    """
    await assert_can_view_student(session, user, student_id)

    stmt = (
        select(Grade, Lesson.lesson_date, Subject.name)
        .join(Subject, Subject.id == Grade.subject_id)
        .join(Lesson, Lesson.id == Grade.lesson_id, isouter=True)
        .where(Grade.student_id == student_id, Grade.is_archived.is_(False))
        .order_by(Subject.name, Lesson.lesson_date)
    )
    if date_from is not None:
        stmt = stmt.where(Lesson.lesson_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Lesson.lesson_date <= date_to)

    yigilgan: dict[uuid.UUID, dict[str, object]] = {}
    for g, kun, fan in (await session.execute(stmt)).all():
        item = yigilgan.setdefault(g.subject_id, {"name": fan, "rows": [], "sum": 0.0, "weight": 0})
        item["rows"].append(_row(g, kun))  # type: ignore[union-attr]
        item["sum"] = float(item["sum"]) + _normalized(g) * g.weight  # type: ignore[arg-type]
        item["weight"] = int(item["weight"]) + g.weight  # type: ignore[arg-type]

    return [
        StudentSubjectGrades(
            subject_id=sid,
            subject_name=str(v["name"]),
            grades=v["rows"],  # type: ignore[arg-type]
            average=_average((float(v["sum"]), int(v["weight"]))),  # type: ignore[arg-type]
        )
        for sid, v in yigilgan.items()
    ]


async def class_average_by_subject(
    session: AsyncSession, user: CurrentUser, *, class_id: uuid.UUID
) -> dict[str, float]:
    """Sinfning fanlar boʻyicha oʻrtacha bahosi — hisobot uchun (JUR-06).

    Faqat oʻrtachani koʻra oladiganga (4-qoida).
    """
    if not await _can_see_average(session, user, class_id):
        raise PermissionDeniedError("Oʻrtacha koʻrsatkichni koʻrishga ruxsatingiz yoʻq.")

    ruxsat = await accessible_student_ids(session, user)

    stmt = (
        select(
            Subject.name,
            # K1: shkala normalizatsiyasi SQLda ham — 100 ballik baho
            # 5 ballikka keltiriladi (max_value >= 1 kafolatlangan).
            func.sum(Grade.value * Grade.weight * 5.0 / Grade.max_value),
            func.sum(Grade.weight),
        )
        .join(Subject, Subject.id == Grade.subject_id)
        .join(Student, Student.id == Grade.student_id)
        .where(
            Student.class_id == class_id,
            Student.is_archived.is_(False),
            Grade.is_archived.is_(False),
        )
        .group_by(Subject.name)
    )
    if ruxsat is not None:
        stmt = stmt.where(Grade.student_id.in_(ruxsat))

    return {
        fan: round(float(summa) / float(vazn), 2)
        for fan, summa, vazn in (await session.execute(stmt)).all()
        if vazn
    }


@dataclass(frozen=True, slots=True)
class StudentRating:
    """Oʻquvchining sinf ichidagi oʻrni (REY-01).

    X-6: sinfdoshlar ismi va baholari QAYTMAYDI — faqat oʻz oʻrni,
    sinf hajmi va oʻz koʻrsatkichlari. Reyting formulasi: vaznli,
    5 ballik shkalaga normallashgan oʻrtacha baho (jurnal bilan bir
    xil); baho teng boʻlsa davomat foizi ustun.
    """

    rank: int | None
    total_students: int
    average: float | None
    attendance_percent: float


async def student_rating(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> StudentRating:
    await assert_can_view_student(session, user, student_id)

    student = await session.get(Student, student_id)
    if student is None or student.class_id is None:
        return StudentRating(rank=None, total_students=0, average=None, attendance_percent=0.0)

    # Sinfdagi faol oʻquvchilarning oʻrtachasi — bitta soʻrovda.
    rows = (
        await session.execute(
            select(
                Grade.student_id,
                func.sum(Grade.value * Grade.weight * 5.0 / Grade.max_value),
                func.sum(Grade.weight),
            )
            .join(Student, Student.id == Grade.student_id)
            .where(
                Student.class_id == student.class_id,
                Student.is_archived.is_(False),
                Grade.is_archived.is_(False),
            )
            .group_by(Grade.student_id)
        )
    ).all()
    averages = {sid: round(float(sv) / float(sw), 2) for sid, sv, sw in rows if sw}

    total = (
        await session.scalar(
            select(func.count()).select_from(Student).where(
                Student.class_id == student.class_id, Student.is_archived.is_(False)
            )
        )
    ) or 0

    from app.services import attendance_service

    stat = await attendance_service.attendance_stats(session, user, student_id=student_id)

    mine = averages.get(student_id)
    if mine is None:
        return StudentRating(
            rank=None, total_students=total, average=None, attendance_percent=stat.percent
        )

    # Oʻrin: oʻrtachasi kattaroqlar soni + 1 (teng oʻrtacha — teng oʻrin).
    rank = 1 + sum(1 for v in averages.values() if v > mine)
    return StudentRating(
        rank=rank, total_students=total, average=mine, attendance_percent=stat.percent
    )
