"""Sababli qoldirish arizasi (DAV-04).

Oqim: vasiy ariza yozadi → sinf rahbari koʻradi → tasdiqlaydi yoki rad
etadi. Tasdiqlanganda oʻsha kunlardagi darslar «sababli» ga oʻtadi.

**Nega tasdiqlash DAV-03 oynasini chetlab oʻtadi.** Davomat 24 soatdan
keyin ustoz uchun yopiladi — bu ustoz jimgina tarixni qayta yozmasligi
uchun. Ariza esa BOSHQA yoʻl: uni oila boshlaydi, hujjat ilova
qilinadi, qaror kim tomonidan va qachon qabul qilingani yoziladi, har
bir davomat oʻzgarishi esa auditga tushadi. Yaʼni bu yerda oynaning
maqsadi buzilmaydi — aksincha, oʻsha maqsad (izsiz oʻzgarish
boʻlmasin) toʻliq bajariladi.

**Kelgan bolaga tegilmaydi.** Agar ustoz «keldi» yoki «kechikdi» deb
belgilagan boʻlsa, bola darsda boʻlgan. Ariza uni «sababli» qilib
qoʻysa, davomat yolgʻon boʻlardi.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.timeutil import local_today, utcnow
from app.models import (
    AbsenceRequest,
    AbsenceStatus,
    AttendanceRecord,
    AttendanceStatus,
    AuditAction,
    Lesson,
    Permission,
    RoleName,
    StoredFile,
    Student,
    User,
)
from app.services import audit_service, storage
from app.services.access import (
    CurrentUser,
    accessible_student_ids,
    assert_can_view_student,
    homeroom_class_ids,
)
from app.services.permissions import has_permission

#: Ariza necha kun orqaga yozilishi mumkin. Chegara bor, chunki
#: cheksiz orqaga ariza butun yilning davomatini qayta yozish
#: imkonini berardi. Oldindan (kelajakka) yozishga cheklov yoʻq —
#: rejalashtirilgan davolanish odatiy holat.
MAX_BACKDATE_DAYS = 30

#: Bir arizada qamrab olinadigan eng uzun muddat.
MAX_RANGE_DAYS = 30

#: Ustoz «keldi» degan darsga tegilmaydi — bola darsda boʻlgan.
_KELGAN = {AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value}


@dataclass(frozen=True, slots=True)
class AbsenceView:
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    class_name: str | None
    date_from: date
    date_to: date
    reason: str
    status: str
    created_by_name: str
    created_at_iso: str
    decided_by_name: str | None
    decision_note: str | None
    marked_lessons: int
    file_name: str | None
    #: Imzolangan havola — faqat arizani koʻrishga haqli boʻlganga (X-7).
    file_url: str | None
    #: Shu foydalanuvchi qaror qabul qila oladimi.
    can_decide: bool


async def _student(session: AsyncSession, student_id: uuid.UUID) -> Student:
    student = await session.get(Student, student_id)
    if student is None or student.is_archived:
        raise NotFoundError("Oʻquvchi topilmadi.")
    return student


async def _can_decide(session: AsyncSession, user: CurrentUser, student: Student) -> bool:
    """Kim tasdiqlaydi: SHU sinfning rahbari, oʻquv boʻlimi, administrator.

    TZ DAV-04 sinf rahbarini nomlaydi. Administrator va oʻquv boʻlimi
    ham qoʻshildi: sinf rahbari taʼtilda boʻlsa ariza osilib qolmasin.
    Direktor yoʻq — u maʼlumot kiritmaydi.
    """
    if user.has(
        RoleName.ADMIN.value, RoleName.SUPERADMIN.value, RoleName.ACADEMIC.value
    ):
        return True
    if await has_permission(session, user, Permission.ATTENDANCE_EDIT_CLOSED):
        return True
    if student.class_id is None:
        return False
    return student.class_id in await homeroom_class_ids(session, user.id)


async def _view(
    session: AsyncSession,
    user: CurrentUser,
    ariza: AbsenceRequest,
    *,
    with_link: bool,
) -> AbsenceView:
    student = await session.get(Student, ariza.student_id)
    muallif = await session.get(User, ariza.created_by_id)
    qaror_qiluvchi = (
        await session.get(User, ariza.decided_by_id)
        if ariza.decided_by_id is not None
        else None
    )
    fayl = (
        await session.get(StoredFile, ariza.file_id) if ariza.file_id is not None else None
    )

    sinf = None
    if student is not None and student.class_id is not None:
        from app.models import SchoolClass  # noqa: PLC0415 — aylanma importni oldini oladi

        obj = await session.get(SchoolClass, student.class_id)
        sinf = obj.name if obj is not None else None

    return AbsenceView(
        id=ariza.id,
        student_id=ariza.student_id,
        student_name=(
            f"{student.last_name} {student.first_name}".strip()
            if student is not None
            else "—"
        ),
        class_name=sinf,
        date_from=ariza.date_from,
        date_to=ariza.date_to,
        reason=ariza.reason,
        status=ariza.status,
        created_by_name=muallif.full_name if muallif is not None else "—",
        created_at_iso=ariza.created_at.isoformat(),
        decided_by_name=qaror_qiluvchi.full_name if qaror_qiluvchi is not None else None,
        decision_note=ariza.decision_note,
        marked_lessons=ariza.marked_lessons,
        file_name=fayl.original_name if fayl is not None else None,
        # Havola faqat SOʻRALGANDA yasaladi. Roʻyxatda yasalsa, har
        # bir qator 15 daqiqalik kalit tarqatgan boʻlardi (X-7).
        file_url=(
            storage.signed_path(fayl.id) if fayl is not None and with_link else None
        ),
        can_decide=(
            student is not None and await _can_decide(session, user, student)
        ),
    )


async def create(
    session: AsyncSession,
    user: CurrentUser,
    *,
    student_id: uuid.UUID,
    date_from: date,
    date_to: date,
    reason: str,
    file_id: uuid.UUID | None = None,
    ip: str | None = None,
) -> AbsenceRequest:
    """Vasiy ariza yozadi (DAV-04).

    Kirish nazorati `access.py` da: ota-ona faqat oʻz farzandiga ariza
    yoza oladi (X-1). Boshqa oilaning bolasini soʻrasa `403`.
    """
    await assert_can_view_student(session, user, student_id)
    await _student(session, student_id)

    matn = reason.strip()
    if len(matn) < 5:
        raise ValidationError("Sababni yozing — kamida bir jumla.")
    if date_to < date_from:
        raise ValidationError("Tugash sanasi boshlanishidan oldin boʻlmasin.")
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise ValidationError(f"Bitta ariza {MAX_RANGE_DAYS} kundan uzun boʻlmasin.")

    bugun = local_today()
    if (bugun - date_from).days > MAX_BACKDATE_DAYS:
        raise ValidationError(
            f"Ariza {MAX_BACKDATE_DAYS} kundan orqaga yozilmaydi. "
            "Eskiroq kun uchun administratorga murojaat qiling."
        )

    if file_id is not None:
        # Fayl bor-yoʻqligi tekshiriladi: mavjud boʻlmagan id bilan
        # ariza yozilsa, keyin «ilova koʻrinmaydi» degan tushunarsiz
        # holat chiqardi.
        await storage.get(session, file_id)

    ariza = AbsenceRequest(
        student_id=student_id,
        created_by_id=user.id,
        date_from=date_from,
        date_to=date_to,
        reason=matn,
        file_id=file_id,
    )
    session.add(ariza)
    await session.flush()

    audit_service.record(
        session,
        object_type="absence_request",
        object_id=ariza.id,
        action=AuditAction.CREATE,
        new={
            "student_id": student_id,
            "date_from": date_from,
            "date_to": date_to,
            "has_file": file_id is not None,
        },
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    await session.refresh(ariza)
    return ariza


async def list_requests(
    session: AsyncSession,
    user: CurrentUser,
    *,
    status: str | None = None,
    student_id: uuid.UUID | None = None,
    limit: int = 100,
) -> list[AbsenceView]:
    """Arizalar roʻyxati — koʻrish doirasi bilan kesilgan.

    Kesish QUERY darajasida (X-1): ota-ona faqat oʻz farzandlarining
    arizasini koʻradi, ustoz — oʻz sinflarinikini. Frontendda filtr
    qoʻyish yetarli emas.
    """
    stmt = select(AbsenceRequest).where(AbsenceRequest.is_archived.is_(False))

    ruxsat = await accessible_student_ids(session, user)
    if ruxsat is not None:
        if not ruxsat:
            return []
        stmt = stmt.where(AbsenceRequest.student_id.in_(ruxsat))

    if status is not None:
        stmt = stmt.where(AbsenceRequest.status == status)
    if student_id is not None:
        await assert_can_view_student(session, user, student_id)
        stmt = stmt.where(AbsenceRequest.student_id == student_id)

    stmt = stmt.order_by(AbsenceRequest.created_at.desc()).limit(min(limit, 200))
    rows = (await session.execute(stmt)).scalars().all()
    return [await _view(session, user, a, with_link=False) for a in rows]


async def get_request(
    session: AsyncSession, user: CurrentUser, request_id: uuid.UUID
) -> AbsenceView:
    """Bitta ariza — ilova havolasi bilan.

    Havola SHU YERDA yasaladi, chunki kirish tekshiruvi ham shu yerda:
    `assert_can_view_student` oʻtmasa havola umuman tugʻilmaydi (X-1).
    """
    ariza = await session.get(AbsenceRequest, request_id)
    if ariza is None or ariza.is_archived:
        raise NotFoundError("Ariza topilmadi.")
    await assert_can_view_student(session, user, ariza.student_id)
    return await _view(session, user, ariza, with_link=True)


async def _mark_excused(
    session: AsyncSession,
    user: CurrentUser,
    ariza: AbsenceRequest,
    *,
    ip: str | None,
) -> int:
    """Ariza kunlaridagi darslarni «sababli» qiladi. Nechtasi oʻzgargani qaytadi.

    Kelgan bolaga tegilmaydi (`present`, `late`) — ustoz uni darsda
    koʻrgan. Belgilanmagan dars ham «sababli» boʻladi: aks holda ariza
    tasdiqlangani bilan davomat boʻsh qolib, DAV-06 foizini buzardi.
    """
    student = await _student(session, ariza.student_id)
    if student.class_id is None:
        return 0

    darslar = (
        (
            await session.execute(
                select(Lesson).where(
                    Lesson.class_id == student.class_id,
                    Lesson.lesson_date >= ariza.date_from,
                    Lesson.lesson_date <= ariza.date_to,
                    Lesson.is_archived.is_(False),
                )
            )
        )
        .scalars()
        .all()
    )
    if not darslar:
        return 0

    dars_ids = [d.id for d in darslar]
    mavjud = {
        r.lesson_id: r
        for r in (
            await session.execute(
                select(AttendanceRecord).where(
                    AttendanceRecord.lesson_id.in_(dars_ids),
                    AttendanceRecord.student_id == ariza.student_id,
                )
            )
        )
        .scalars()
        .all()
    }

    hozir = utcnow()
    ozgardi = 0
    for dars in darslar:
        yozuv = mavjud.get(dars.id)
        if yozuv is not None and yozuv.status in _KELGAN:
            continue
        if yozuv is not None and yozuv.status == AttendanceStatus.EXCUSED.value:
            continue

        eski = yozuv.status if yozuv is not None else None
        if yozuv is None:
            yozuv = AttendanceRecord(
                lesson_id=dars.id,
                student_id=ariza.student_id,
                status=AttendanceStatus.EXCUSED.value,
                note="Sababli qoldirish arizasi boʻyicha",
                marked_by_id=user.id,
                marked_at=hozir,
            )
            session.add(yozuv)
            await session.flush()
        else:
            yozuv.status = AttendanceStatus.EXCUSED.value
            yozuv.note = "Sababli qoldirish arizasi boʻyicha"
            yozuv.marked_by_id = user.id
            yozuv.marked_at = hozir

        # DAV-07: har bir davomat oʻzgarishi auditga. Ariza id si ham
        # yoziladi — «nega bu kun sababli?» savoli izsiz qolmasin.
        audit_service.record(
            session,
            object_type="attendance",
            object_id=yozuv.id,
            action=AuditAction.UPDATE if eski is not None else AuditAction.CREATE,
            old={"status": eski} if eski is not None else None,
            new={
                "status": AttendanceStatus.EXCUSED.value,
                "absence_request_id": ariza.id,
            },
            actor_id=user.id,
            ip=ip,
        )
        ozgardi += 1

    return ozgardi


async def decide(
    session: AsyncSession,
    user: CurrentUser,
    *,
    request_id: uuid.UUID,
    approve: bool,
    note: str | None = None,
    ip: str | None = None,
) -> AbsenceView:
    """Sinf rahbari arizani tasdiqlaydi yoki rad etadi (DAV-04).

    Rad etishda sabab MAJBURIY: «rad etildi» oʻzi javob emas, oila
    nima qilishini bilmay qoladi.
    """
    ariza = await session.get(AbsenceRequest, request_id)
    if ariza is None or ariza.is_archived:
        raise NotFoundError("Ariza topilmadi.")

    student = await _student(session, ariza.student_id)
    if not await _can_decide(session, user, student):
        raise PermissionDeniedError("Bu arizaga qaror qabul qilishga ruxsatingiz yoʻq.")

    if ariza.status != AbsenceStatus.PENDING.value:
        raise ConflictError("Bu ariza boʻyicha qaror allaqachon qabul qilingan.")

    izoh = (note or "").strip()
    if not approve and len(izoh) < 3:
        raise ValidationError("Rad etish sababini yozing.")

    eski = ariza.status
    ariza.status = (
        AbsenceStatus.APPROVED.value if approve else AbsenceStatus.REJECTED.value
    )
    ariza.decided_by_id = user.id
    ariza.decided_at = utcnow()
    ariza.decision_note = izoh or None

    if approve:
        ariza.marked_lessons = await _mark_excused(session, user, ariza, ip=ip)

    audit_service.record(
        session,
        object_type="absence_request",
        object_id=ariza.id,
        action=AuditAction.UPDATE,
        old={"status": eski},
        new={
            "status": ariza.status,
            "note": izoh or None,
            "marked_lessons": ariza.marked_lessons,
        },
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    await session.refresh(ariza)
    return await _view(session, user, ariza, with_link=False)


async def cancel(
    session: AsyncSession,
    user: CurrentUser,
    *,
    request_id: uuid.UUID,
    ip: str | None = None,
) -> AbsenceView:
    """Vasiy oʻz arizasini bekor qiladi — faqat qaror chiqmagunicha.

    Ariza oʻchirilmaydi (CLAUDE.md 1-qoida), holati oʻzgaradi.
    Tasdiqlangan arizani bekor qilib boʻlmaydi: davomat allaqachon
    oʻzgargan va uni orqaga qaytarish boshqa qaror — administrator
    ishi.
    """
    ariza = await session.get(AbsenceRequest, request_id)
    if ariza is None or ariza.is_archived:
        raise NotFoundError("Ariza topilmadi.")
    if ariza.created_by_id != user.id:
        raise PermissionDeniedError("Faqat arizani yozgan odam uni bekor qila oladi.")
    if ariza.status != AbsenceStatus.PENDING.value:
        raise ConflictError("Qaror chiqqan arizani bekor qilib boʻlmaydi.")

    ariza.status = AbsenceStatus.CANCELLED.value
    audit_service.record(
        session,
        object_type="absence_request",
        object_id=ariza.id,
        action=AuditAction.UPDATE,
        old={"status": AbsenceStatus.PENDING.value},
        new={"status": AbsenceStatus.CANCELLED.value},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    await session.refresh(ariza)
    return await _view(session, user, ariza, with_link=False)
