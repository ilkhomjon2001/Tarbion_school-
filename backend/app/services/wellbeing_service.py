"""Tarbiyaviy va psixologik qaydlar — kirish qoidalari.

Bu loyihadagi eng nozik yozuvlar, shuning uchun qoidalar jadval
koʻrinishida va har biri testda mixlangan:

                      behavior          psychology
  yozadi              dars beradigan    faqat rahbariyat (psixolog
                      ustoz, rahbar     roli hozircha alohida emas)
  vasiy               koʻradi           koʻradi
  sinf rahbari        koʻradi           koʻradi
  fan ustozi          koʻradi (oʻz      KOʻRMAYDI
                      sinfida)
  rahbariyat          koʻradi           koʻradi
  oʻquvchining oʻzi   KOʻRMAYDI         KOʻRMAYDI

Oʻquvchining oʻzi koʻrmasligi ataylab: bu yozuvlar kattalar orasidagi
muloqot — «bolaning oldida bola haqida gaplashilmaydi». Vasiy zarur
deb bilsa oʻzi aytadi.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.models import (
    AuditAction,
    Guardian,
    Student,
    Subject,
    User,
    WellbeingKind,
    WellbeingNote,
    WellbeingTone,
)
from app.services import audit_service
from app.services.access import CurrentUser, homeroom_class_ids, taught_class_ids

KINDS = frozenset(k.value for k in WellbeingKind)
TONES = frozenset(t.value for t in WellbeingTone)


@dataclass(frozen=True, slots=True)
class NoteRow:
    note: WellbeingNote
    author_name: str
    subject_name: str | None


async def _teacher_class_ids(session: AsyncSession, user: CurrentUser) -> set[uuid.UUID]:
    return await taught_class_ids(session, user.id) | await homeroom_class_ids(session, user.id)


async def _get_student(session: AsyncSession, student_id: uuid.UUID) -> Student:
    student = await session.get(Student, student_id)
    if student is None or student.is_archived:
        # 404 emas: mavjud boʻlmagan id 404, ruxsatsiz id 403 qaytarsa,
        # farqdan oʻquvchi idʼlarini sanab chiqish mumkin boʻlardi (X-3).
        raise PermissionDeniedError("Bu oʻquvchi maʼlumotini koʻrishga ruxsatingiz yoʻq.")
    return student


async def _is_guardian(
    session: AsyncSession, user_id: uuid.UUID, student_id: uuid.UUID
) -> bool:
    row = await session.scalar(
        select(Guardian.id).where(
            Guardian.user_id == user_id,
            Guardian.student_id == student_id,
            Guardian.is_archived.is_(False),
        )
    )
    return row is not None


async def _can_read(
    session: AsyncSession, user: CurrentUser, student: Student
) -> tuple[bool, bool]:
    """(behavior koʻradimi, psychology koʻradimi).

    Ikkalasi bitta joyda hisoblanadi — ikki alohida funksiya boʻlsa,
    yangi rol qoʻshilganda biri yangilanib ikkinchisi unutilardi.
    """
    if user.is_staff_wide:
        return True, True

    if await _is_guardian(session, user.id, student.id):
        return True, True

    if user.is_teacher and student.class_id is not None:
        rahbar = student.class_id in await homeroom_class_ids(session, user.id)
        if rahbar:
            return True, True
        oqitadi = student.class_id in await taught_class_ids(session, user.id)
        # Fan ustozi faqat tarbiyaviy yozuvlarni koʻradi — psixologik
        # yozuv unga tegishli emas.
        return oqitadi, False

    return False, False


async def create(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    kind: str,
    tone: str,
    text: str,
    subject_id: uuid.UUID | None = None,
    ip: str | None = None,
) -> WellbeingNote:
    if kind not in KINDS:
        raise ValidationError("Yozuv turi notoʻgʻri.")
    if tone not in TONES:
        raise ValidationError("Baholash notoʻgʻri.")
    if len(text.strip()) < 5:
        raise ValidationError("Matn juda qisqa.")

    student = await _get_student(session, student_id)

    if kind == WellbeingKind.PSYCHOLOGY.value:
        # Psixologik yozuvni faqat rahbariyat kiritadi. Maktabda alohida
        # psixolog roli paydo boʻlsa, shu shart kengayadi — boshqa joy emas.
        if not actor.is_staff_wide:
            raise PermissionDeniedError("Psixologik yozuvni kiritishga ruxsatingiz yoʻq.")
    else:
        if not actor.is_staff_wide:
            if not actor.is_teacher or student.class_id is None:
                raise PermissionDeniedError("Bu oʻquvchiga yozuv kirita olmaysiz.")
            if student.class_id not in await _teacher_class_ids(session, actor):
                # X-3: oʻquvchi bor-yoʻqligini oshkor qilmaymiz.
                raise PermissionDeniedError("Bu oʻquvchiga yozuv kirita olmaysiz.")

    if subject_id is not None:
        subject = await session.get(Subject, subject_id)
        if subject is None or subject.is_archived:
            raise NotFoundError("Fan topilmadi.")

    note = WellbeingNote(
        student_id=student_id,
        author_id=actor.id,
        kind=kind,
        tone=tone,
        subject_id=subject_id,
        text=text.strip(),
    )
    session.add(note)
    await session.flush()

    # Bola haqidagi har bir yozuv izli — 4-qoida ruhida, undan nozikroq.
    audit_service.record(
        session,
        object_type="wellbeing_note",
        object_id=note.id,
        action=AuditAction.CREATE,
        old=None,
        new={"student_id": str(student_id), "kind": kind, "tone": tone},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return note


async def archive(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    note_id: uuid.UUID,
    ip: str | None = None,
) -> WellbeingNote:
    """Faqat muallif yoki rahbariyat. Oʻchirish yoʻq (1-qoida)."""
    note = await session.get(WellbeingNote, note_id)
    if note is None or note.is_archived:
        raise NotFoundError("Yozuv topilmadi.")
    if note.author_id != actor.id and not actor.is_staff_wide:
        raise PermissionDeniedError("Bu yozuvni olib tashlay olmaysiz.")

    note.is_archived = True
    audit_service.record(
        session,
        object_type="wellbeing_note",
        object_id=note.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return note


async def list_for_student(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> list[NoteRow]:
    """Bitta oʻquvchining yozuvlari — koʻrish huquqi turga qarab.

    Huquq yoʻq boʻlsa 403 — yozuv bor-yoʻqligi ham maʼlumot (X-3).
    """
    student = await _get_student(session, student_id)
    behavior_ok, psychology_ok = await _can_read(session, user, student)
    if not behavior_ok and not psychology_ok:
        raise PermissionDeniedError("Bu oʻquvchining yozuvlarini koʻra olmaysiz.")

    stmt = (
        select(WellbeingNote)
        .where(
            WellbeingNote.student_id == student_id,
            WellbeingNote.is_archived.is_(False),
        )
        .order_by(WellbeingNote.created_at.desc())
    )
    ruxsatli_turlar: list[str] = []
    if behavior_ok:
        ruxsatli_turlar.append(WellbeingKind.BEHAVIOR.value)
    if psychology_ok:
        ruxsatli_turlar.append(WellbeingKind.PSYCHOLOGY.value)
    stmt = stmt.where(WellbeingNote.kind.in_(ruxsatli_turlar))

    notes = list((await session.execute(stmt)).scalars())
    if not notes:
        return []

    authors = dict(
        (
            await session.execute(
                select(User.id, User.last_name + " " + User.first_name).where(
                    User.id.in_({n.author_id for n in notes})
                )
            )
        ).all()
    )
    subject_ids = {n.subject_id for n in notes if n.subject_id}
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
    return [
        NoteRow(
            note=n,
            author_name=authors.get(n.author_id, ""),
            subject_name=subjects.get(n.subject_id),
        )
        for n in notes
    ]
