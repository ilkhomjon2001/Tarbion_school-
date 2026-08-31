"""Bildirishnomalarni yaratish va oʻqish.

Ikki tomoni bor va ikkalasi ham ataylab sodda:

**Yozish.** Hodisa yuz bergan servis (`attendance_service`,
`appeals_service`) `notify()` ni chaqiradi va KIMGA yuborilishini
aytadi. Boʻlim (`section`) va havola shu yerda, qabul qiluvchining
KABINETI boʻyicha hisoblanadi — chaqiruvchi servis ota-onaning menyusi
qanday tuzilganini bilishi shart emas.

**Oʻqish.** Har bir soʻrov `WHERE user_id = :men` bilan cheklanadi.
Bu X-1 ning eng qulay holati: bildirishnoma yaratilayotgandayoq kimga
tegishli ekani hal qilingan, shuning uchun oʻqishda qayta hisoblash
kerak emas. Boshqa odamning bildirishnomasiga umuman yoʻl yoʻq —
`GET /{id}` kabi endpoint ataylab yozilmagan.
"""

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sections import cabinet_of
from app.core.timeutil import utcnow
from app.models import Notification, NotificationKind, Role, User, UserRole
from app.services.access import CurrentUser

#: Qoʻngʻiroq roʻyxatida bir martada nechta koʻrsatiladi.
DEFAULT_LIMIT = 30
MAX_LIMIT = 100


# ─────────────────────────── Boʻlimga bogʻlash ───────────────────────────

#: Hodisa turi qaysi boʻlimda sanaladi — QABUL QILUVCHINING kabineti
#: boʻyicha. Bitta «kelmadi» ota-onada «Davomat», oʻquvchida esa «Bosh
#: sahifa» boʻlimida koʻrinadi, chunki oʻquvchi kabinetida davomat
#: boʻlimi yoʻq.
#:
#: Kabinet roʻyxatda boʻlmasa bildirishnoma yaratilmaydi: bu «bu rolga
#: bunday xabar bormaydi» degani, xato emas.
_SECTION: dict[str, dict[str, str]] = {
    NotificationKind.ATTENDANCE_ABSENT.value: {
        "parent": "/ota-ona/davomat",
        "student": "/student",
    },
    NotificationKind.ATTENDANCE_LATE.value: {
        "parent": "/ota-ona/davomat",
        "student": "/student",
    },
    NotificationKind.APPEAL_NEW.value: {
        "parent": "/ota-ona/murojaat",
        "teacher": "/teacher/murojaat",
        "admin": "/admin/murojaatlar",
        "director": "/rahbar/murojaatlar",
    },
    NotificationKind.APPEAL_MESSAGE.value: {
        "parent": "/ota-ona/murojaat",
        "teacher": "/teacher/murojaat",
        "admin": "/admin/murojaatlar",
        "director": "/rahbar/murojaatlar",
    },
    NotificationKind.APPEAL_ASSIGNED.value: {
        "teacher": "/teacher/murojaat",
        "admin": "/admin/murojaatlar",
        "director": "/rahbar/murojaatlar",
    },
    NotificationKind.APPEAL_CLOSED.value: {
        "parent": "/ota-ona/murojaat",
        "teacher": "/teacher/murojaat",
        "admin": "/admin/murojaatlar",
        "director": "/rahbar/murojaatlar",
    },
    NotificationKind.GRADE_NEW.value: {
        "parent": "/ota-ona/baholar",
        "student": "/student/grades",
    },
    # Uy vazifasi ota-onaga BORMAYDI. Kunda 6-7 dars boʻladi, har biriga
    # vazifa — bu ota-onaning qoʻngʻirogʻini kuniga oʻn marta toʻldirardi
    # va muhim xabar (kelmadi, murojaat) shovqin ichida yoʻqolardi.
    # Ota-ona vazifani farzandi sahifasida koʻradi.
    NotificationKind.HOMEWORK_NEW.value: {
        "student": "/student/homework",
    },
    # Baholangani — boshqa gap: u kamdan-kam va bahoning oʻzi.
    NotificationKind.HOMEWORK_GRADED.value: {
        "parent": "/ota-ona/baholar",
        "student": "/student/grades",
    },
    # Qaytarilgan ish — oʻquvchidan AMAL talab qiladi, shuning uchun
    # faqat unga.
    NotificationKind.HOMEWORK_RETURNED.value: {
        "student": "/student/homework",
    },
}


async def cabinets_of(
    session: AsyncSession, user_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """Har bir foydalanuvchining kabineti — BITTA soʻrovda.

    Sinf boʻyicha 25 ta ota-onaga xabar yuborilganda har biri uchun
    alohida soʻrov yuborilsa 25 marta bazaga borilardi (N+1).
    """
    ids = list(dict.fromkeys(user_ids))
    if not ids:
        return {}

    rows = await session.execute(
        select(UserRole.user_id, Role.name)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id.in_(ids))
    )
    yigilgan: dict[uuid.UUID, set[str]] = {}
    for user_id, role_name in rows.all():
        yigilgan.setdefault(user_id, set()).add(role_name)

    # Roli yoʻq foydalanuvchi ham boʻlishi mumkin — `cabinet_of` unga
    # standart kabinetni beradi, biz uni roʻyxatdan tushirib
    # qoldirmaymiz.
    return {uid: cabinet_of(yigilgan.get(uid, set())) for uid in ids}


# ─────────────────────────────── Yozish ───────────────────────────────


@dataclass(frozen=True, slots=True)
class Recipient:
    """Kimga va qaysi bola haqida.

    `student_id` qabul qiluvchiga bogʻliq: bitta murojaat boʻyicha
    ota-onaga «Aliyev Ali haqida», ustozga esa xuddi shu bola haqida
    xabar boradi, lekin ota-onada bir necha farzand boʻlishi mumkin va
    u qaysi bola ekanini koʻrishi kerak.
    """

    user_id: uuid.UUID
    student_id: uuid.UUID | None = None


async def family_recipients(
    session: AsyncSession, student_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[Recipient]]:
    """Har bir oʻquvchi uchun oila qabul qiluvchilari — IKKI soʻrovda.

    Oila = vasiylar + oʻquvchining oʻz hisobi. Hisob 1-bosqichda
    hammada boʻlmasligi mumkin, u holda faqat vasiylar qoladi.

    Har bola uchun alohida soʻrov yuborilsa 25 kishilik sinfda 25 marta
    bazaga borilardi (N+1). Chaqiruvchi servis bu ikki soʻrovni oʻzi
    yozmasligi uchun shu yerda: aks holda har modulda takrorlanardi va
    biri oʻquvchi hisobini unutardi.
    """
    from app.models import Guardian, Student  # noqa: PLC0415 — aylanma import

    ids = [sid for sid in dict.fromkeys(student_ids) if sid is not None]
    if not ids:
        return {}

    out: dict[uuid.UUID, list[Recipient]] = {sid: [] for sid in ids}

    rows = await session.execute(
        select(Guardian.student_id, Guardian.user_id).where(
            Guardian.student_id.in_(ids),
            Guardian.is_archived.is_(False),
        )
    )
    for student_id, guardian_user_id in rows.all():
        out[student_id].append(Recipient(user_id=guardian_user_id, student_id=student_id))

    own = await session.execute(
        select(Student.id, Student.user_id).where(
            Student.id.in_(ids), Student.user_id.is_not(None)
        )
    )
    for student_id, user_id in own.all():
        out[student_id].append(Recipient(user_id=user_id, student_id=student_id))

    return out


async def notify(
    session: AsyncSession,
    *,
    recipients: Sequence[Recipient],
    kind: NotificationKind,
    title: str,
    body: str,
    object_type: str | None = None,
    object_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
) -> int:
    """Bildirishnoma yaratadi. Yaratilgan yozuvlar sonini qaytaradi.

    Ikkita qoida shu yerda, chaqiruvchi servisda emas — aks holda har
    bir chaqiruv joyida takrorlanardi va biri unutilardi:

      · **oʻz amalidan xabar kelmaydi.** Ustoz davomatni oʻzi belgilaydi,
        unga «Ali kelmadi» deb xabar berish ortiqcha shovqin;
      · **kabinetiga tegishli boʻlmagan xabar yaratilmaydi.** Oʻquv
        boʻlimi murojaatlarni koʻrmaydi (`_SECTION` da yoʻq), demak
        unga murojaat bildirishnomasi ham bormaydi.

    `commit` qilinmaydi — chaqiruvchi tranzaksiyaning bir qismi. Davomat
    saqlanmasa bildirishnoma ham qolmaydi.
    """
    unique: dict[uuid.UUID, Recipient] = {}
    for r in recipients:
        if r.user_id == actor_id:
            continue
        # Bitta odam roʻyxatga ikki marta tushishi mumkin (ham vasiy,
        # ham masʼul xodim). Unga ikkita bir xil xabar kelmasin.
        unique.setdefault(r.user_id, r)

    if not unique:
        return 0

    routes = _SECTION.get(kind.value, {})
    cabinets = await cabinets_of(session, unique)

    created = 0
    for user_id, recipient in unique.items():
        section = routes.get(cabinets.get(user_id, ""))
        if section is None:
            continue
        session.add(
            Notification(
                user_id=user_id,
                kind=kind.value,
                section=section,
                link=section,
                title=title,
                body=body,
                object_type=object_type,
                object_id=object_id,
                student_id=recipient.student_id,
                actor_id=actor_id,
            )
        )
        created += 1

    return created


# ─────────────────────────────── Oʻqish ───────────────────────────────


def _mine(user: CurrentUser) -> Select:
    """Har bir soʻrovning asosi. Boshqa yoʻl yoʻq — ataylab."""
    return select(Notification).where(
        Notification.user_id == user.id,
        Notification.is_archived.is_(False),
    )


async def list_for(
    session: AsyncSession,
    user: CurrentUser,
    *,
    only_unread: bool = False,
    section: str | None = None,
    limit: int = DEFAULT_LIMIT,
) -> Sequence[Notification]:
    # Tartib IKKI ustun boʻyicha. `created_at` ni `func.now()` toʻldiradi,
    # Postgres'da esa `now()` — TRANZAKSIYA boshlanish vaqti: bitta
    # soʻrovda yaratilgan barcha bildirishnomalar bir xil qiymat oladi.
    # Faqat shu ustun boʻyicha saralasak, ustoz butun sinfga baho
    # qoʻyganda yoki vazifa berilib darhol baholanganda ularning tartibi
    # tasodifiy boʻlardi. `id` — UUIDv7, vaqt boʻyicha oʻsadi va
    # tenglikni aniq hal qiladi.
    stmt = _mine(user).order_by(Notification.created_at.desc(), Notification.id.desc())
    if only_unread:
        stmt = stmt.where(Notification.read_at.is_(None))
    if section:
        stmt = stmt.where(Notification.section == section)
    stmt = stmt.limit(max(1, min(limit, MAX_LIMIT)))
    return list((await session.execute(stmt)).scalars())


async def unread_by_section(session: AsyncSession, user: CurrentUser) -> dict[str, int]:
    """Yon menyudagi sanoq — bitta soʻrov, boʻlim boʻyicha guruhlangan."""
    rows = await session.execute(
        select(Notification.section, func.count())
        .where(
            Notification.user_id == user.id,
            Notification.is_archived.is_(False),
            Notification.read_at.is_(None),
        )
        .group_by(Notification.section)
    )
    return {section: count for section, count in rows.all()}


async def mark_read(
    session: AsyncSession, user: CurrentUser, ids: list[uuid.UUID]
) -> int:
    """Koʻrsatilgan bildirishnomalarni oʻqilgan deb belgilaydi.

    Soʻrov `user_id` bilan cheklangan, shuning uchun begona id yuborilsa
    hech narsa oʻzgarmaydi va javob `0` boʻladi. Ataylab `403` emas:
    xato qaytarish «bunday bildirishnoma bor» degan maʼlumotni oshkor
    qilardi (X-3 mantigʻi).
    """
    if not ids:
        return 0

    result = await session.execute(
        update(Notification)
        .where(
            Notification.id.in_(ids),
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=utcnow())
    )
    await session.commit()
    return int(result.rowcount or 0)


async def mark_all_read(
    session: AsyncSession, user: CurrentUser, *, section: str | None = None
) -> int:
    """Hammasini yoki bitta boʻlimdagilarni oʻqilgan deb belgilaydi."""
    stmt = update(Notification).where(
        Notification.user_id == user.id,
        Notification.read_at.is_(None),
    )
    if section:
        stmt = stmt.where(Notification.section == section)

    result = await session.execute(stmt.values(read_at=utcnow()))
    await session.commit()
    return int(result.rowcount or 0)


# ──────────────────────── Chaqiruvchilar uchun ────────────────────────


async def student_names(
    session: AsyncSession, student_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """Bildirishnomalar roʻyxatidagi bolalar nomi — BITTA soʻrovda.

    Nom yozuvning oʻzida saqlanmaydi: familiya oʻzgarsa eski
    bildirishnomalarda eski nom qolib ketardi.
    """
    from app.models import Student  # noqa: PLC0415 — aylanma importni oldini olish

    ids = [sid for sid in dict.fromkeys(student_ids) if sid is not None]
    if not ids:
        return {}

    rows = await session.execute(
        select(Student.id, Student.last_name, Student.first_name).where(Student.id.in_(ids))
    )
    return {sid: f"{last} {first}" for sid, last, first in rows.all()}


async def staff_recipients(
    session: AsyncSession, role_names: Sequence[str]
) -> list[uuid.UUID]:
    """Rol boʻyicha xodimlar — masʼul tayinlanmagan murojaat uchun.

    Faol va arxivlanmagan hisoblar. Arxivlangan xodimga bildirishnoma
    yozish yozuvni chiqindiga aylantirardi.
    """
    rows = await session.execute(
        select(User.id)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            Role.name.in_(role_names),
            User.is_archived.is_(False),
            User.is_active.is_(True),
        )
        .distinct()
    )
    return list(rows.scalars())
