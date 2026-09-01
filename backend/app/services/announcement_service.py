"""Eʼlonlar (T-020, ADM-12).

Ikkita savolga shu yerda javob beriladi va ikkalasi ham serverda:

**Kim bera oladi.** Butun maktabga — faqat `announcements.publish`
huquqi bor xodim. Sinfga — oʻsha sinfda dars beradigan yoki unga
rahbarlik qiladigan ustoz. Fanga — oʻsha fandan haqiqatan dars
beradigan ustoz; qamrov uning jadvalidagi sinflar bilan chegaralanadi.
Manba har doim dars jadvali, `teacher_subjects` emas: fanni bilish
sinfga eʼlon berish huquqini bermaydi.

**Kim koʻradi.** Oʻquvchi va ota-ona — butun maktab eʼlonlari va oʻz
sinfiga tegishlilari. Ustoz — oʻzi bergan eʼlonlar. Rahbariyat —
hammasi. Bu roʻyxat soʻrov darajasida quriladi (X-1 ruhida): frontend
hech narsani filtrlmaydi.

ADM-12 mezoni: yuborishdan OLDIN qabul qiluvchilar soni koʻrsatiladi.
`preview_recipients` shu son uchun — u hech narsa yozmaydi.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.models import (
    Announcement,
    AnnouncementAudience,
    AnnouncementClass,
    AuditAction,
    NotificationKind,
    Permission,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    User,
)
from app.services import audit_service, notifications_service, permissions
from app.services.access import CurrentUser, homeroom_class_ids

AUDIENCES = frozenset(a.value for a in AnnouncementAudience)


@dataclass(frozen=True, slots=True)
class AnnouncementRow:
    ann: Announcement
    author_name: str
    subject_name: str | None
    class_names: list[str]


# ─────────────────────────── Qamrovni aniqlash ───────────────────────────


async def _taught_classes_for_subject(
    session: AsyncSession, teacher_id: uuid.UUID, subject_id: uuid.UUID
) -> set[uuid.UUID]:
    """Ustoz shu fandan dars beradigan sinflar — jadvaldan."""
    rows = await session.execute(
        select(ScheduleEntry.class_id)
        .where(
            ScheduleEntry.teacher_id == teacher_id,
            ScheduleEntry.subject_id == subject_id,
            ScheduleEntry.is_archived.is_(False),
        )
        .distinct()
    )
    return set(rows.scalars())


async def _taught_classes(session: AsyncSession, teacher_id: uuid.UUID) -> set[uuid.UUID]:
    rows = await session.execute(
        select(ScheduleEntry.class_id)
        .where(
            ScheduleEntry.teacher_id == teacher_id,
            ScheduleEntry.is_archived.is_(False),
        )
        .distinct()
    )
    return set(rows.scalars())


async def _resolve_target(
    session: AsyncSession,
    user: CurrentUser,
    *,
    audience: str,
    class_id: uuid.UUID | None,
    subject_id: uuid.UUID | None,
) -> set[uuid.UUID]:
    """Auditoriya → sinflar toʻplami. Ruxsat ham shu yerda tekshiriladi.

    Boʻsh toʻplam = butun maktab (faqat `school` uchun).
    """
    if audience == AnnouncementAudience.SCHOOL.value:
        # Butun maktabga faqat maxsus huquq bilan — ustoz «hammaga»
        # eʼlon berolmaydi, aks holda eʼlonlar taxtasi shovqinga aylanadi.
        await permissions.assert_permission(session, user, Permission.ANNOUNCEMENTS_PUBLISH)
        return set()

    if audience == AnnouncementAudience.CLASS.value:
        if class_id is None:
            raise ValidationError("Sinf tanlanmagan.")
        cls = await session.get(SchoolClass, class_id)
        if cls is None or cls.is_archived:
            raise NotFoundError("Sinf topilmadi.")

        if not user.is_staff_wide:
            ruxsatli = await _taught_classes(session, user.id)
            ruxsatli |= await homeroom_class_ids(session, user.id)
            if class_id not in ruxsatli:
                # X-3: sinf bor-yoʻqligini oshkor qilmaymiz.
                raise PermissionDeniedError("Bu sinfga eʼlon bera olmaysiz.")
        return {class_id}

    if audience == AnnouncementAudience.SUBJECT.value:
        if subject_id is None:
            raise ValidationError("Fan tanlanmagan.")
        subject = await session.get(Subject, subject_id)
        if subject is None or subject.is_archived:
            raise NotFoundError("Fan topilmadi.")

        sinflar = await _taught_classes_for_subject(session, user.id, subject_id)
        if not sinflar:
            raise PermissionDeniedError("Bu fandan dars bermaysiz.")
        return sinflar

    raise ValidationError("Auditoriya notoʻgʻri.")


async def _students_of(
    session: AsyncSession, class_ids: set[uuid.UUID]
) -> list[uuid.UUID]:
    """Qamrovdagi oʻquvchilar. Boʻsh toʻplam — butun maktab."""
    stmt = select(Student.id).where(Student.is_archived.is_(False))
    if class_ids:
        stmt = stmt.where(Student.class_id.in_(class_ids))
    return list((await session.execute(stmt)).scalars())


async def preview_recipients(
    session: AsyncSession,
    user: CurrentUser,
    *,
    audience: str,
    class_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
) -> int:
    """ADM-12: yuborishdan oldin «nechta odamga ketadi».

    Son yozuvda ishlatiladigan hisobning oʻzi bilan bir xil yoʻldan
    chiqadi — taxminiy alohida formula boʻlsa, ikkalasi vaqt oʻtib
    ajralib ketardi.
    """
    class_ids = await _resolve_target(
        session, user, audience=audience, class_id=class_id, subject_id=subject_id
    )
    students = await _students_of(session, class_ids)
    families = await notifications_service.family_recipients(session, students)
    return len({r.user_id for recipients in families.values() for r in recipients})


# ─────────────────────────────── Yozish ───────────────────────────────


async def create(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    audience: str,
    title: str,
    body: str,
    class_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    important: bool = False,
    ip: str | None = None,
) -> Announcement:
    if not title.strip() or not body.strip():
        raise ValidationError("Sarlavha va matn boʻsh boʻlmasin.")

    class_ids = await _resolve_target(
        session, actor, audience=audience, class_id=class_id, subject_id=subject_id
    )

    students = await _students_of(session, class_ids)
    families = await notifications_service.family_recipients(session, students)
    recipients = [r for lst in families.values() for r in lst]
    unique_count = len({r.user_id for r in recipients})

    ann = Announcement(
        author_id=actor.id,
        audience=audience,
        subject_id=subject_id if audience == AnnouncementAudience.SUBJECT.value else None,
        title=title.strip(),
        body=body.strip(),
        important=important,
        recipients_count=unique_count,
    )
    session.add(ann)
    await session.flush()

    for cid in class_ids:
        session.add(AnnouncementClass(announcement_id=ann.id, class_id=cid))

    await notifications_service.notify(
        session,
        recipients=recipients,
        kind=NotificationKind.ANNOUNCEMENT,
        title=ann.title,
        body=ann.body[:400],
        object_type="announcement",
        object_id=ann.id,
        actor_id=actor.id,
    )

    # Butun maktabga ketgan xabar — kim yuborgani keyin albatta soʻraladi.
    audit_service.record(
        session,
        object_type="announcement",
        object_id=ann.id,
        action=AuditAction.CREATE,
        old=None,
        new={
            "audience": audience,
            "title": ann.title,
            "recipients": unique_count,
            "classes": len(class_ids),
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return ann


async def archive(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    announcement_id: uuid.UUID,
    ip: str | None = None,
) -> Announcement:
    """Eʼlonni olib tashlash — arxivlash, oʻchirish emas (1-qoida).

    Faqat muallif yoki rahbariyat. Yaratilgan bildirishnomalar qoladi:
    ular allaqachon yetkazilgan xabar, eʼlon taxtasidan olingani ularni
    «yetkazilmagan» qilmaydi.
    """
    ann = await session.get(Announcement, announcement_id)
    if ann is None or ann.is_archived:
        raise NotFoundError("Eʼlon topilmadi.")

    if ann.author_id != actor.id and not actor.is_staff_wide:
        raise PermissionDeniedError("Bu eʼlonni olib tashlay olmaysiz.")

    ann.is_archived = True
    audit_service.record(
        session,
        object_type="announcement",
        object_id=ann.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return ann


# ─────────────────────────────── Oʻqish ───────────────────────────────


async def _visible_class_ids(session: AsyncSession, user: CurrentUser) -> set[uuid.UUID]:
    """Oʻquvchi/ota-ona qaysi sinflarning eʼlonlarini koʻradi."""
    stmt = select(Student.class_id).where(
        Student.is_archived.is_(False), Student.class_id.is_not(None)
    )
    if user.has("student"):
        stmt = stmt.where(Student.user_id == user.id)
        return set((await session.execute(stmt)).scalars())

    # Ota-ona: farzandlarining sinflari — guardians orqali (X-1).
    from app.models import Guardian  # noqa: PLC0415 — aylanma import

    stmt = stmt.join(Guardian, Guardian.student_id == Student.id).where(
        Guardian.user_id == user.id, Guardian.is_archived.is_(False)
    )
    return set((await session.execute(stmt)).scalars())


async def list_for(
    session: AsyncSession, user: CurrentUser, *, limit: int = 50
) -> list[AnnouncementRow]:
    """Foydalanuvchi koʻradigan eʼlonlar, yangisidan eskisiga.

    Kesim rolga qarab:
      rahbariyat — hammasi;
      ustoz      — oʻzi berganlari (u oila emas, muallif);
      oʻquvchi / ota-ona — butun maktab + oʻz sinflari.
    """
    stmt = (
        select(Announcement)
        .where(Announcement.is_archived.is_(False))
        .order_by(Announcement.created_at.desc())
        .limit(min(limit, 100))
    )

    if user.is_staff_wide:
        pass
    elif user.is_teacher:
        stmt = stmt.where(Announcement.author_id == user.id)
    else:
        sinflar = await _visible_class_ids(session, user)
        maktabga = Announcement.audience == AnnouncementAudience.SCHOOL.value
        if sinflar:
            sinfga = Announcement.id.in_(
                select(AnnouncementClass.announcement_id).where(
                    AnnouncementClass.class_id.in_(sinflar),
                    AnnouncementClass.is_archived.is_(False),
                )
            )
            stmt = stmt.where(maktabga | sinfga)
        else:
            stmt = stmt.where(maktabga)

    anns = list((await session.execute(stmt)).scalars())
    if not anns:
        return []

    ids = [a.id for a in anns]

    # Muallif, fan va sinflar — uchta soʻrovda, N+1 siz.
    authors = dict(
        (
            await session.execute(
                select(User.id, User.last_name + " " + User.first_name).where(
                    User.id.in_({a.author_id for a in anns})
                )
            )
        ).all()
    )
    subject_ids = {a.subject_id for a in anns if a.subject_id}
    subjects = (
        dict(
            (
                await session.execute(
                    select(Subject.id, Subject.name).where(Subject.id.in_(subject_ids))
                )
            ).all()
        )
        if subject_ids
        else {}
    )
    class_rows = await session.execute(
        select(AnnouncementClass.announcement_id, SchoolClass.name)
        .join(SchoolClass, SchoolClass.id == AnnouncementClass.class_id)
        .where(AnnouncementClass.announcement_id.in_(ids))
        .order_by(SchoolClass.name)
    )
    classes_of: dict[uuid.UUID, list[str]] = {}
    for ann_id, name in class_rows.all():
        classes_of.setdefault(ann_id, []).append(name)

    return [
        AnnouncementRow(
            ann=a,
            author_name=authors.get(a.author_id, ""),
            subject_name=subjects.get(a.subject_id),
            class_names=classes_of.get(a.id, []),
        )
        for a in anns
    ]


async def teacher_targets(
    session: AsyncSession, user: CurrentUser
) -> tuple[list[tuple[uuid.UUID, str]], list[tuple[uuid.UUID, str]]]:
    """Ustoz eʼlon bera oladigan sinflar va fanlar — jadvalidan."""
    sinf_ids = await _taught_classes(session, user.id)
    sinf_ids |= await homeroom_class_ids(session, user.id)
    sinflar = (
        (
            await session.execute(
                select(SchoolClass.id, SchoolClass.name)
                .where(SchoolClass.id.in_(sinf_ids), SchoolClass.is_archived.is_(False))
                .order_by(SchoolClass.name)
            )
        ).all()
        if sinf_ids
        else []
    )

    fanlar = (
        await session.execute(
            select(Subject.id, Subject.name)
            .join(ScheduleEntry, ScheduleEntry.subject_id == Subject.id)
            .where(
                ScheduleEntry.teacher_id == user.id,
                ScheduleEntry.is_archived.is_(False),
                Subject.is_archived.is_(False),
            )
            .distinct()
            .order_by(Subject.name)
        )
    ).all()

    return [(i, n) for i, n in sinflar], [(i, n) for i, n in fanlar]
