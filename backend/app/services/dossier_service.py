"""Oʻquvchi dossieri — rahbar va administrator uchun yigʻma kartochka.

Rahbar qarzdorlar roʻyxatida bir ismni koʻradi va «bu bola kim?» degan
savolga javob topa olmasdi: davomati, tarbiyaviy holati, oila bilan
boʻlgan suhbatlar — hammasi turli ekranlarda, biri ikkinchisiga
bogʻlanmagan. Shu modul ularni bitta joyga yigʻadi.

Yangi maʼlumot QOʻSHILMAYDI. Har bir blok allaqachon bor jadvaldan
oʻqiladi va **oʻz servisining** kirish qoidasidan oʻtadi — bu yerda
qoida takrorlanmaydi, chunki takrorlangan qoida vaqt oʻtib asl
nusxasidan ajralib qoladi.

Kim koʻradi: administrator, rahbar, superadmin — `payment_service.
FINANCE_ROLES` bilan bir xil roʻyxat, va bu ataylab. Dossierda toʻlov
maʼlumoti bor, demak uni koʻra oladigan doira moliyani koʻra oladigan
doiradan keng boʻlishi mumkin emas.

`is_staff_wide` ISHLATILMAYDI: unga oʻquv boʻlimi (`academic`) ham
kiradi, u esa toʻlov va qarzdorlikni koʻrmaydi.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedError
from app.models import (
    Appeal,
    AppealNote,
    AttendanceRecord,
    AttendanceStatus,
    Lesson,
    Subject,
    User,
)
from app.services import (
    academic_service,
    appeals_service,
    payment_service,
    school_service,
    wellbeing_service,
)
from app.services.access import CurrentUser

#: Dossierni koʻra oladigan rollar. Moliya roʻyxati bilan bir xil —
#: sabab modul izohida.
DOSSIER_ROLES = payment_service.FINANCE_ROLES

#: Nechta oxirgi yozuv koʻrsatiladi. Kartochka — xulosa, arxiv emas;
#: toʻliq tarix oʻz boʻlimida ochiladi.
RECENT_LIMIT = 25


@dataclass(frozen=True, slots=True)
class AbsenceRow:
    """Kelmagan yoki kechikkan dars — sababi bilan."""

    lesson_date: date
    period: int
    subject_name: str
    status: str
    note: str | None


@dataclass(frozen=True, slots=True)
class ConversationRow:
    """Oila bilan suhbat qaydi (ADM-16)."""

    id: uuid.UUID
    appeal_id: uuid.UUID
    created_at: datetime
    kind: str
    summary: str
    author_name: str


@dataclass(frozen=True, slots=True)
class Dossier:
    card: school_service.StudentCard
    year_name: str | None
    attendance_counts: dict[str, int]
    absences: list[AbsenceRow]
    wellbeing: list[wellbeing_service.NoteRow]
    conversations: list[ConversationRow]
    finance: object
    months: list


def assert_can_view(user: CurrentUser) -> None:
    """X-3: ruxsat yoʻq boʻlsa 403, 404 emas — obyekt borligi oshkor boʻlmasin."""
    if not user.has(*DOSSIER_ROLES):
        raise PermissionDeniedError("Oʻquvchi dossierini koʻrishga ruxsatingiz yoʻq.")


async def _attendance(
    session: AsyncSession, student_id: uuid.UUID, boshlanish: date | None, tugash: date | None
) -> tuple[dict[str, int], list[AbsenceRow]]:
    """Joriy oʻquv yili kesimidagi davomat: sanoq va sababli qatorlar.

    Sanoq yil bilan chegaralanadi — oʻtgan yillarni qoʻshib yuborsak
    «40 marta kelmagan» degan raqam bugungi holatni emas, butun
    maktab tarixini koʻrsatardi.
    """
    shart = [
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.is_archived.is_(False),
    ]
    if boshlanish is not None:
        shart.append(Lesson.lesson_date >= boshlanish)
    if tugash is not None:
        shart.append(Lesson.lesson_date <= tugash)

    sanoq = await session.execute(
        select(AttendanceRecord.status, func.count())
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(*shart)
        .group_by(AttendanceRecord.status)
    )
    counts = {holat.value: 0 for holat in AttendanceStatus}
    counts.update({k: v for k, v in sanoq.all()})

    qatorlar = await session.execute(
        select(
            Lesson.lesson_date,
            Lesson.period,
            Subject.name,
            AttendanceRecord.status,
            AttendanceRecord.note,
        )
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .join(Subject, Subject.id == Lesson.subject_id)
        .where(*shart, AttendanceRecord.status != AttendanceStatus.PRESENT.value)
        .order_by(Lesson.lesson_date.desc(), Lesson.period.desc())
        .limit(RECENT_LIMIT)
    )
    absences = [
        AbsenceRow(lesson_date=d, period=p, subject_name=s, status=st, note=n)
        for d, p, s, st, n in qatorlar.all()
    ]
    return counts, absences


async def _conversations(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> list[ConversationRow]:
    """Oʻquvchi boʻyicha ichki suhbat qaydlari (ADM-16).

    Qaydlar murojaatga bogʻlangan, murojaat esa oʻquvchiga — shuning
    uchun ikki jadval orqali olinadi.

    `appeals_service.can_read_notes` bu yerda ham tekshiriladi: dossier
    roʻyxati kelajakda kengaysa, ichki qaydlar oʻz-oʻzidan ochilib
    ketmasin.
    """
    if not appeals_service.can_read_notes(user):
        return []
    rows = await session.execute(
        select(AppealNote, User.last_name, User.first_name)
        .join(Appeal, Appeal.id == AppealNote.appeal_id)
        .join(User, User.id == AppealNote.author_id)
        .where(
            Appeal.student_id == student_id,
            AppealNote.is_archived.is_(False),
        )
        .order_by(AppealNote.created_at.desc())
        .limit(RECENT_LIMIT)
    )
    return [
        ConversationRow(
            id=note.id,
            appeal_id=note.appeal_id,
            created_at=note.created_at,
            kind=note.kind,
            summary=note.summary,
            author_name=f"{familiya} {ism}".strip(),
        )
        for note, familiya, ism in rows.all()
    ]


async def build(session: AsyncSession, user: CurrentUser, student_id: uuid.UUID) -> Dossier:
    """Bitta oʻquvchining toʻliq kartochkasi."""
    assert_can_view(user)

    # Profil va vasiylar — `access.py` dan oʻtadi (X-1).
    card = await school_service.student_card(session, user, student_id)

    year = await academic_service.current_year(session)
    counts, absences = await _attendance(
        session,
        student_id,
        year.starts_on if year else None,
        year.ends_on if year else None,
    )

    # Tarbiyaviy va psixologik qaydlar — oʻz matritsasidan oʻtadi.
    wellbeing = await wellbeing_service.list_for_student(session, user, student_id)

    conversations = await _conversations(session, user, student_id)

    # Moliya — oʻz tekshiruvidan oʻtadi. Daftar qatorlari bu yerda
    # kerak emas: kartochkada jamlanma va oylar kesimi koʻrsatiladi.
    finance, _ledger, _discounts, months = await payment_service.student_ledger(
        session, user, student_id
    )

    return Dossier(
        card=card,
        year_name=year.name if year else None,
        attendance_counts=counts,
        absences=absences,
        wellbeing=wellbeing,
        conversations=conversations,
        finance=finance,
        months=months,
    )
