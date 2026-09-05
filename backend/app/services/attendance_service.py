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
from datetime import date, datetime, timedelta

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    EditWindowClosedError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.timeutil import utcnow
from app.models import (
    AttendanceRecord,
    AttendanceStatus,
    AuditAction,
    Guardian,
    Lesson,
    NotificationKind,
    Permission,
    SchoolClass,
    SchoolSettings,
    Student,
    Subject,
    User,
)
from app.services import (
    audit_service,
    notifications_service,
    outbox_service,
    template_service,
)
from app.services.access import (
    CurrentUser,
    accessible_student_ids,
    homeroom_class_ids,
    load_lesson_for_teacher,
    taught_class_ids,
)
from app.services.permissions import has_permission

_VALID = {s.value for s in AttendanceStatus}
#: Davomat foizida "kelgan" deb hisoblanadigan holatlar. Kechikkan
#: oʻquvchi darsda boʻlgan — uni kelmaganga qoʻshish notoʻgʻri boʻlardi.
_PRESENT_LIKE = (AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value)
#: Oilaga xabar yuboriladigan holatlar. «Sababli» bu roʻyxatda yoʻq —
#: uni oila oʻzi maʼlum qilgan, qaytarib xabar berish ortiqcha.
_NOTIFY_STATUSES = (AttendanceStatus.ABSENT.value, AttendanceStatus.LATE.value)


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
    """Dars boshlanganidan to 24 soatlik oynagacha (DAV-03).

    Boshlanmagan darsga ham yozib boʻlmaydi — aks holda ustoz kelasi
    haftani oldindan "toʻldirib" qoʻyishi mumkin edi.
    """
    hozir = utcnow()
    return lesson.starts_at <= hozir <= edit_deadline(lesson)


async def _assert_can_edit(session: AsyncSession, user: CurrentUser, lesson: Lesson) -> None:
    """Kim tahrirlay oladi.

    Ustoz — faqat 24 soatlik oyna ichida. Oynadan keyin faqat
    `attendance.edit_closed` HUQUQI bor odam (T-005). Administrator
    roli yolgʻiz yetarli emas: super administrator ikkita adminning
    birigina bu huquqni berishi mumkin.

    Superadminda bu huquq avtomatik bor (`has_permission` ga qara).

    ADM-10: bekor qilingan darsga davomat OLINMAYDI — dars oʻtmagan,
    demak «keldi/kelmadi» degan savolning oʻzi yoʻq. Bu tekshiruv
    huquqdan oldin turadi: administrator ham bekor qilingan darsga
    davomat yozmasin, avval bekor qilishni qaytarsin.
    """
    if lesson.cancelled_at is not None:
        raise ValidationError(
            "Bu dars bekor qilingan — davomat olinmaydi. "
            "Kerak boʻlsa administrator bekor qilishni qaytaradi."
        )

    if can_teacher_edit(lesson):
        return

    if await has_permission(session, user, Permission.ATTENDANCE_EDIT_CLOSED):
        return

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


@dataclass(frozen=True, slots=True)
class _LessonChange:
    """Bitta darsdagi oʻzgarish — hali `commit` qilinmagan."""

    result: MarkResult
    changes: list[tuple[uuid.UUID, str]]
    cancels: list[uuid.UUID]
    records: dict[uuid.UUID, AttendanceRecord]


async def _apply_lesson(
    session: AsyncSession,
    user: CurrentUser,
    lesson: Lesson,
    rows: list[MarkRow],
    *,
    topic: str | None,
    ip: str | None,
    now: datetime,
) -> _LessonChange:
    """Bitta darsning davomatini yozadi. `flush`/`commit` QILMAYDI.

    Ajratilgan sabab: kunlik ekran (DAV-02) bir necha darsni BITTA
    tranzaksiyada saqlaydi. Ikkinchi nusxa yozilsa, DAV-03 tekshiruvi
    yoki audit yozuvi ikki joyda ikki xil boʻlib qolardi.
    """
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
        select(AttendanceRecord).where(AttendanceRecord.lesson_id == lesson.id)
    )
    mavjud = {r.student_id: r for r in mavjud_rows.scalars()}

    created = updated = unchanged = 0
    #: Kim haqida oilaga xabar beriladi. Faqat HOLATI OʻZGARGAN va
    #: yangi holati «kelmadi»/«kechikdi» boʻlgan oʻquvchilar. Ustoz
    #: jurnalni qayta saqlaganda takror xabar ketmasligi uchun shart
    #: aynan oʻzgarishga bogʻlangan.
    xabar_uchun: list[tuple[uuid.UUID, str]] = []
    #: Kimning navbatdagi xabari BEKOR qilinadi: holati «kelmadi» yoki
    #: «kechikdi» dan boshqasiga oʻzgargan. Ustoz kech qolgan bolani
    #: keyin «keldi» ga tuzatsa, ota-ona «kelmadi» degan xabar
    #: olmasligi kerak — DAV-05 dagi kechikish aynan shu uchun bor.
    bekor_uchun: list[uuid.UUID] = []
    #: Har bir tegilgan yozuv — navbatdagi xabar aynan SHU yozuvga
    #: bogʻlanadi. Darsga bogʻlansa, bitta bolani tuzatish butun
    #: sinfning xabarini bekor qilardi.
    yozuvlar: dict[uuid.UUID, AttendanceRecord] = {}

    for row in rows:
        eski = mavjud.get(row.student_id)
        note = (row.note or "").strip() or None

        if eski is None:
            yangi = AttendanceRecord(
                lesson_id=lesson.id,
                student_id=row.student_id,
                status=row.status,
                note=note,
                marked_by_id=user.id,
                marked_at=now,
            )
            session.add(yangi)
            yozuvlar[row.student_id] = yangi
            created += 1
            audit_service.record(
                session,
                object_type="attendance",
                object_id=lesson.id,
                action=AuditAction.CREATE,
                new={"student_id": row.student_id, "status": row.status, "note": note},
                actor_id=user.id,
                ip=ip,
            )
            if row.status in _NOTIFY_STATUSES:
                xabar_uchun.append((row.student_id, row.status))
            continue

        if eski.status == row.status and eski.note == note and not eski.is_archived:
            # Oʻzgarmagan qator auditga tushmaydi — jurnal shovqin bilan
            # toʻlsa, haqiqiy oʻzgarishni topib boʻlmay qoladi.
            unchanged += 1
            continue

        audit_service.record(
            session,
            object_type="attendance",
            object_id=lesson.id,
            action=AuditAction.UPDATE,
            old={"student_id": row.student_id, "status": eski.status, "note": eski.note},
            new={"student_id": row.student_id, "status": row.status, "note": note},
            actor_id=user.id,
            ip=ip,
        )
        # Xabar faqat HOLAT oʻzgarganda. Ustoz izohni tuzatgan boʻlsa
        # oilaga «Ali kelmadi» deb ikkinchi marta xabar bermaymiz.
        if eski.status != row.status:
            if row.status in _NOTIFY_STATUSES:
                xabar_uchun.append((row.student_id, row.status))
            elif eski.status in _NOTIFY_STATUSES:
                bekor_uchun.append(row.student_id)
        yozuvlar[row.student_id] = eski

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
                object_id=lesson.id,
                action=AuditAction.UPDATE,
                old={"topic": lesson.topic},
                new={"topic": yangi_mavzu},
                actor_id=user.id,
                ip=ip,
            )
            lesson.topic = yangi_mavzu

    lesson.attendance_marked_at = now
    return _LessonChange(
        result=MarkResult(created=created, updated=updated, unchanged=unchanged),
        changes=xabar_uchun,
        cancels=bekor_uchun,
        records=yozuvlar,
    )


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

    ozgarish = await _apply_lesson(
        session, user, lesson, rows, topic=topic, ip=ip, now=utcnow()
    )
    # Yangi yozuvlar `id` olishi uchun — xabar aynan yozuvga bogʻlanadi.
    await session.flush()
    await _notify_family(
        session, user, lesson, ozgarish.changes, ozgarish.cancels, ozgarish.records
    )
    await session.commit()
    return ozgarish.result


#: DAV-05 sukut qiymati — TZ talabi. Sozlama qatori boʻlmasa shu.
DEFAULT_NOTIFY_DELAY_MINUTES = 30


async def _notify_delay(session: AsyncSession) -> int:
    """Xabar necha daqiqadan keyin yuborilsin (DAV-05).

    Administrator sozlamasidan olinadi. Sozlama qatori hali
    yaratilmagan boʻlishi mumkin — u holda TZ dagi sukut ishlaydi,
    xabar butunlay toʻxtab qolmaydi.
    """
    qiymat = await session.scalar(
        select(SchoolSettings.attendance_notify_delay_minutes)
        .where(SchoolSettings.is_archived.is_(False))
        .order_by(SchoolSettings.created_at.desc())
        .limit(1)
    )
    return DEFAULT_NOTIFY_DELAY_MINUTES if qiymat is None else max(0, qiymat)


async def _guardian_ids(
    session: AsyncSession, student_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[uuid.UUID]]:
    """Oʻquvchi → vasiylarining `user_id` lari.

    `notifications_service.family_recipients` dan farqi: bu yerda
    oʻquvchining OʻZ hisobi yoʻq. Ilova B boʻyicha «Farzand darsga
    kelmadi» xabari vasiyga ketadi.
    """
    out: dict[uuid.UUID, list[uuid.UUID]] = {sid: [] for sid in student_ids}
    if not student_ids:
        return out
    rows = await session.execute(
        select(Guardian.student_id, Guardian.user_id).where(
            Guardian.student_id.in_(student_ids),
            Guardian.is_archived.is_(False),
        )
    )
    for student_id, user_id in rows.all():
        out[student_id].append(user_id)
    return out


async def _notify_family(
    session: AsyncSession,
    user: CurrentUser,
    lesson: Lesson,
    changes: list[tuple[uuid.UUID, str]],
    cancels: list[uuid.UUID],
    records: dict[uuid.UUID, AttendanceRecord],
) -> None:
    """Kelmagan va kechikkan oʻquvchilar boʻyicha oilaga xabar.

    Xabar davomat bilan BIR tranzaksiyada yaratiladi: davomat saqlanmasa
    bildirishnoma ham qolmaydi. Aks holda ota-onaga «kelmadi» deb xabar
    ketib, jurnalda hech narsa boʻlmasligi mumkin edi.

    Oila roʻyxati va nomlar bitta joydan olinadi
    (`notifications_service.family_recipients`) — 25 kishilik sinfda har
    bola uchun alohida soʻrov yuborilsa N+1 boʻlardi.
    """
    # Tuzatilgan davomat: navbatdagi, hali yuborilmagan xabar bekor
    # qilinadi (T-019 mezoni). Yuborilgani bekor qilinmaydi — u ketgan.
    for student_id in cancels:
        yozuv = records.get(student_id)
        if yozuv is not None:
            await outbox_service.cancel_for_object(
                session, object_type="attendance_record", object_id=yozuv.id
            )

    if not changes:
        return

    student_ids = [sid for sid, _ in changes]
    oila = await notifications_service.family_recipients(session, student_ids)
    nomlar = await notifications_service.student_names(session, student_ids)

    # Fan nomi ATAYLAB alohida soʻrov bilan. `lesson.subject` ga
    # murojaat qilish `MissingGreenlet` beradi: `load_lesson_for_teacher`
    # dan kelgan obyekt identity map dan chiqishi mumkin va bogʻliqlik
    # yuklanmagan boʻladi (`get_lesson_attendance` dagi izohga qarang).
    fan = await session.scalar(select(Subject.name).where(Subject.id == lesson.subject_id))
    kun = lesson.lesson_date.strftime("%d.%m.%Y")

    # DAV-05: kechikish administrator sozlamasidan. Sozlama boʻlmasa
    # TZ dagi sukut — 30 daqiqa.
    kechikish = await _notify_delay(session)
    # Telegram xabari FAQAT vasiyga (Ilova B). `family_recipients`
    # oʻquvchining oʻz hisobini ham qaytaradi — bolaga «sen darsga
    # kelmading» deb yozishning maʼnosi yoʻq.
    vasiylar = await _guardian_ids(session, student_ids)

    for student_id, status in changes:
        ism = nomlar.get(student_id)
        if ism is None:
            continue

        if status == AttendanceStatus.ABSENT.value:
            kind = NotificationKind.ATTENDANCE_ABSENT
            sarlavha = f"{ism} darsga kelmadi"
        else:
            kind = NotificationKind.ATTENDANCE_LATE
            sarlavha = f"{ism} darsga kechikdi"

        await notifications_service.notify(
            session,
            recipients=oila.get(student_id, []),
            kind=kind,
            title=sarlavha,
            body=f"{kun} · {fan or 'dars'} · {lesson.period}-dars",
            object_type="attendance",
            object_id=lesson.id,
            actor_id=user.id,
        )

        # ── Telegram navbati (T-019) ──
        yozuv = records.get(student_id)
        if yozuv is None:
            continue
        tur = (
            "attendance_absent"
            if status == AttendanceStatus.ABSENT.value
            else "attendance_late"
        )
        tg_sarlavha, tg_matn = await template_service.render_kind(
            session,
            tur,
            student_name=ism,
            date=kun,
            subject=fan or "dars",
            period=lesson.period,
            class_name=None,
        )
        for vasiy_id in vasiylar.get(student_id, []):
            await outbox_service.enqueue(
                session,
                user_id=vasiy_id,
                kind=tur,
                title=tg_sarlavha,
                body=tg_matn,
                object_type="attendance_record",
                object_id=yozuv.id,
                send_after=utcnow() + timedelta(minutes=kechikish),
            )


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
        """Kelgan (kechikkan ham) ulushi. Dars boʻlmasa 100 emas, 0.

        O1 (kelishilgan qoida): SABABLI kelmagan kun maxrajdan chiqadi —
        kasal bola davomat foizida jazolanmaydi. Foiz = (kelgan) /
        (jami − sababli). Hamma kunlar sababli boʻlsa foiz 100 emas, 0 —
        "kelgan kun yoʻq" degani.
        """
        maxraj = self.total - self.excused
        if maxraj <= 0:
            return 0.0
        kelgan = self.present + self.late
        return round(kelgan * 100 / maxraj, 1)


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
        .where(
            AttendanceRecord.is_archived.is_(False),
            # O2: bekor qilingan (arxivlangan) dars yozuvlari foizni buzmasin.
            Lesson.is_archived.is_(False),
        )
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
            Lesson.is_archived.is_(False),
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


async def teacher_lessons_range(
    session: AsyncSession, user: CurrentUser, date_from: date, date_to: date
) -> list[Lesson]:
    """Ustozning oraliqdagi darslari — jadval ekrani uchun (MET-09).

    `teacher_lessons` bitta kunni beradi; jadvalda oy koʻrinishi ham bor,
    31 kunni 31 marta soʻrash N+1 boʻlardi.
    """
    rows = await session.execute(
        select(Lesson)
        .options(selectinload(Lesson.school_class), selectinload(Lesson.subject))
        .where(
            Lesson.teacher_id == user.id,
            Lesson.lesson_date.between(date_from, date_to),
            Lesson.is_archived.is_(False),
        )
        .order_by(Lesson.lesson_date, Lesson.period)
    )
    return list(rows.scalars())


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


# ────────────────── DAV-02: sinf rahbari kunlik ekrani ──────────────────


@dataclass(frozen=True, slots=True)
class DayLesson:
    """Kunlik jadvaldagi bitta para."""

    lesson: Lesson
    subject_name: str
    teacher_name: str
    #: Shu darsni HOZIR tahrirlash mumkinmi (DAV-03 oynasi).
    editable: bool


@dataclass(frozen=True, slots=True)
class ClassDay:
    students: list[Student]
    lessons: list[DayLesson]
    #: `(student_id, lesson_id)` → holat. Belgilanmagani roʻyxatda yoʻq.
    marks: dict[tuple[uuid.UUID, uuid.UUID], str]
    notes: dict[tuple[uuid.UUID, uuid.UUID], str]


async def class_day(
    session: AsyncSession, user: CurrentUser, class_id: uuid.UUID, day: date
) -> ClassDay:
    """Butun sinfning bir kunlik davomati — BITTA soʻrovda (DAV-02).

    Qatorlar oʻquvchi, ustunlar para. Ustoz 8 ta darsni 8 marta ochib
    yurmasin: sinf rahbari kuniga bir marta butun kunni koʻrib chiqadi.

    Roʻyxat toʻliq qaytadi — belgilanmagan katak ham boʻsh boʻlib
    koʻrinadi, aks holda ustoz nima qolganini bilmasdi.
    """
    await _assert_class_access(session, user, class_id)

    ustoz = User.__table__.alias("ustoz")
    rows = await session.execute(
        select(Lesson, Subject.name, ustoz.c.last_name, ustoz.c.first_name)
        .join(Subject, Subject.id == Lesson.subject_id)
        .join(ustoz, ustoz.c.id == Lesson.teacher_id)
        .where(
            Lesson.class_id == class_id,
            Lesson.lesson_date == day,
            Lesson.is_archived.is_(False),
        )
        .order_by(Lesson.period)
    )
    darslar = [
        DayLesson(
            lesson=lesson,
            subject_name=fan,
            teacher_name=f"{familiya} {ism[:1]}." if ism else familiya,
            editable=can_teacher_edit(lesson),
        )
        for lesson, fan, familiya, ism in rows.all()
    ]

    students = await _roster(session, class_id)

    marks: dict[tuple[uuid.UUID, uuid.UUID], str] = {}
    notes: dict[tuple[uuid.UUID, uuid.UUID], str] = {}
    if darslar:
        yozuvlar = await session.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.lesson_id.in_([d.lesson.id for d in darslar]),
                AttendanceRecord.is_archived.is_(False),
            )
        )
        for r in yozuvlar.scalars():
            marks[(r.student_id, r.lesson_id)] = r.status
            if r.note:
                notes[(r.student_id, r.lesson_id)] = r.note

    return ClassDay(students=students, lessons=darslar, marks=marks, notes=notes)


async def _assert_class_access(
    session: AsyncSession, user: CurrentUser, class_id: uuid.UUID
) -> None:
    """Kim sinfning kunlik ekranini ocha oladi.

    Sinf rahbari — oʻz sinfi (DAV-02). Fan ustozi — dars beradigan
    sinfi: u ham oʻz darslarini shu ekrandan belgilay oladi, lekin
    boshqa ustozning darsi unga YOPIQ boʻlib koʻrinadi (`editable`).
    """
    if user.is_staff_wide:
        return
    if user.is_teacher:
        if class_id in await homeroom_class_ids(session, user.id):
            return
        if class_id in await taught_class_ids(session, user.id):
            return
    raise PermissionDeniedError("Bu sinf sizga biriktirilmagan.")


@dataclass(frozen=True, slots=True)
class DayEntry:
    """Bitta darsga tegishli belgilar."""

    lesson_id: uuid.UUID
    rows: list[MarkRow]


async def mark_day(
    session: AsyncSession,
    user: CurrentUser,
    class_id: uuid.UUID,
    day: date,
    entries: list[DayEntry],
    *,
    ip: str | None = None,
) -> MarkResult:
    """Bir kunlik bir necha darsni BITTA tranzaksiyada saqlaydi.

    Yarmi saqlanib yarmi saqlanmasligi mumkin emas: ustoz butun kunni
    koʻrib chiqib «saqlash» bosadi va natija yaxlit boʻlishi kerak.

    Tahrirlab boʻlmaydigan dars (DAV-03 oynasi yopilgan) roʻyxatga
    tushsa — butun soʻrov rad etiladi. Jimgina oʻtkazib yuborish
    yomonroq: ustoz belgiladim deb oʻylab ketardi.
    """
    await _assert_class_access(session, user, class_id)
    if not entries:
        raise ValidationError("Saqlanadigan dars koʻrsatilmagan.")

    # BIRINCHI oʻtish — faqat tekshiruv, hech narsa yozilmaydi.
    #
    # Ikki oʻtishga boʻlingan sabab: agar tekshiruv yozish bilan
    # aralashsa, uchinchi darsdagi xato birinchi ikkitasi allaqachon
    # sessiyaga qoʻshilgandan keyin chiqardi. Tranzaksiya orqaga
    # qaytarilsa ham, bu «yozib boʻlib, keyin bekor qilish» —
    # tekshiruvni oldin qilish soddaroq va ishonchliroq.
    darslar: list[tuple[Lesson, DayEntry]] = []
    for entry in entries:
        lesson = await load_lesson_for_teacher(session, user, entry.lesson_id)
        if lesson.class_id != class_id or lesson.lesson_date != day:
            # X-3: dars boshqa sinfniki ekanini oshkor qilmaymiz.
            raise ValidationError("Roʻyxatda shu kunga tegishli boʻlmagan dars bor.")
        await _assert_can_edit(session, user, lesson)
        darslar.append((lesson, entry))

    now = utcnow()
    natijalar: list[tuple[Lesson, _LessonChange]] = []
    created = updated = unchanged = 0

    for lesson, entry in darslar:
        ozgarish = await _apply_lesson(
            session, user, lesson, entry.rows, topic=None, ip=ip, now=now
        )
        natijalar.append((lesson, ozgarish))
        created += ozgarish.result.created
        updated += ozgarish.result.updated
        unchanged += ozgarish.result.unchanged

    await session.flush()
    for lesson, ozgarish in natijalar:
        await _notify_family(
            session, user, lesson, ozgarish.changes, ozgarish.cancels, ozgarish.records
        )
    await session.commit()
    return MarkResult(created=created, updated=updated, unchanged=unchanged)
