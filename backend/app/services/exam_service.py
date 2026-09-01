"""Imtihonlar va dars rejalari servisi.

Kirish router darajasida (`require_roles`: oʻquv boʻlimi, admin,
superadmin) — direktor routeri bilan bir xil uslub. Servis ichida
qoʻshimcha rol tekshiruvi yoʻq, lekin maʼlumot yaxlitligi shu yerda:
ball 0–100, natija faqat imtihon sinfining oʻquvchisiga, oʻtkazilgan
imtihonning sanasi va sinfi oʻzgarmaydi.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import (
    AuditAction,
    Exam,
    ExamKind,
    ExamResult,
    ExamStatus,
    LessonPlan,
    PlanStatus,
    SchoolClass,
    Student,
    Subject,
    User,
)
from app.services import audit_service
from app.services.access import CurrentUser

KINDS = frozenset(k.value for k in ExamKind)
#: 60 dan past ball «oʻzlashtirmadi» hisoblanadi (mockdagi kelishuv).
PASS_THRESHOLD = 60


@dataclass(frozen=True, slots=True)
class ExamStats:
    entered: int
    absent: int
    average: float | None
    highest: int | None
    lowest: int | None
    pass_rate: int | None


@dataclass(frozen=True, slots=True)
class ExamRow:
    exam: Exam
    subject_name: str
    class_name: str
    stats: ExamStats


@dataclass(frozen=True, slots=True)
class ResultRow:
    student_id: uuid.UUID
    student_name: str
    score: int | None
    absent: bool
    #: Natija hali kiritilmagan oʻquvchi uchun False.
    recorded: bool = True


@dataclass(frozen=True, slots=True)
class PlanRow:
    plan: LessonPlan
    teacher_name: str
    subject_name: str
    class_name: str


@dataclass(frozen=True, slots=True)
class ScoreIn:
    student_id: uuid.UUID
    score: int | None
    absent: bool = False


# ─────────────────────────── Imtihonlar ───────────────────────────


async def _get_exam(session: AsyncSession, exam_id: uuid.UUID) -> Exam:
    exam = await session.get(Exam, exam_id)
    if exam is None or exam.is_archived:
        raise NotFoundError("Imtihon topilmadi.")
    return exam


async def _stats(session: AsyncSession, exam_id: uuid.UUID) -> ExamStats:
    rows = list(
        (
            await session.execute(
                select(ExamResult).where(
                    ExamResult.exam_id == exam_id, ExamResult.is_archived.is_(False)
                )
            )
        ).scalars()
    )
    scored = [r.score for r in rows if not r.absent and r.score is not None]
    absent = sum(1 for r in rows if r.absent)
    if not scored:
        return ExamStats(
            entered=0, absent=absent, average=None, highest=None, lowest=None, pass_rate=None
        )
    return ExamStats(
        entered=len(scored),
        absent=absent,
        average=round(sum(scored) / len(scored), 1),
        highest=max(scored),
        lowest=min(scored),
        pass_rate=round(
            100 * sum(1 for s in scored if s >= PASS_THRESHOLD) / len(scored)
        ),
    )


async def create_exam(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    title: str,
    kind: str,
    subject_id: uuid.UUID,
    class_id: uuid.UUID,
    exam_date: date,
    ip: str | None = None,
) -> Exam:
    if kind not in KINDS:
        raise ValidationError("Imtihon turi notoʻgʻri.")
    if not title.strip():
        raise ValidationError("Nomi boʻsh boʻlmasin.")

    subject = await session.get(Subject, subject_id)
    if subject is None or subject.is_archived:
        raise NotFoundError("Fan topilmadi.")
    cls = await session.get(SchoolClass, class_id)
    if cls is None or cls.is_archived:
        raise NotFoundError("Sinf topilmadi.")

    exam = Exam(
        title=title.strip(),
        kind=kind,
        subject_id=subject_id,
        class_id=class_id,
        exam_date=exam_date,
        created_by_id=actor.id,
    )
    session.add(exam)
    await session.flush()

    audit_service.record(
        session,
        object_type="exam",
        object_id=exam.id,
        action=AuditAction.CREATE,
        old=None,
        new={"title": exam.title, "kind": kind, "date": str(exam_date)},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return exam


async def set_exam_status(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    exam_id: uuid.UUID,
    status: str,
    ip: str | None = None,
) -> Exam:
    """rejada → oʻtkazildi | bekor. Oʻtkazilgan imtihon qaytmaydi:
    unda ballar bor, «rejaga qaytarish» ularni havoda qoldirardi."""
    exam = await _get_exam(session, exam_id)
    ruxsatli = {
        ExamStatus.REJADA.value: {ExamStatus.OTKAZILDI.value, ExamStatus.BEKOR.value},
        ExamStatus.OTKAZILDI.value: set(),
        ExamStatus.BEKOR.value: set(),
    }
    if status not in ruxsatli.get(exam.status, set()):
        raise ConflictError("Bu holatga oʻtkazib boʻlmaydi.")

    eski = exam.status
    exam.status = status
    audit_service.record(
        session,
        object_type="exam",
        object_id=exam.id,
        action=AuditAction.UPDATE,
        old={"status": eski},
        new={"status": status},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return exam


async def list_exams(session: AsyncSession) -> list[ExamRow]:
    rows = await session.execute(
        select(Exam, Subject.name, SchoolClass.name)
        .join(Subject, Subject.id == Exam.subject_id)
        .join(SchoolClass, SchoolClass.id == Exam.class_id)
        .where(Exam.is_archived.is_(False))
        .order_by(Exam.exam_date.desc())
    )
    natija = []
    for exam, subject_name, class_name in rows.all():
        natija.append(
            ExamRow(
                exam=exam,
                subject_name=subject_name,
                class_name=class_name,
                stats=await _stats(session, exam.id),
            )
        )
    return natija


async def exam_results(
    session: AsyncSession, exam_id: uuid.UUID
) -> list[ResultRow]:
    """Imtihon sinfining TOʻLIQ roʻyxati — natijasi yoʻqlar ham.

    Kiritish oynasi shu roʻyxat ustida ishlaydi: «kim qoldi» darhol
    koʻrinadi.
    """
    exam = await _get_exam(session, exam_id)

    students = list(
        (
            await session.execute(
                select(Student)
                .where(Student.class_id == exam.class_id, Student.is_archived.is_(False))
                .order_by(Student.last_name, Student.first_name)
            )
        ).scalars()
    )
    mavjud = {
        r.student_id: r
        for r in (
            await session.execute(
                select(ExamResult).where(
                    ExamResult.exam_id == exam_id, ExamResult.is_archived.is_(False)
                )
            )
        ).scalars()
    }
    natija = []
    for s in students:
        r = mavjud.get(s.id)
        natija.append(
            ResultRow(
                student_id=s.id,
                student_name=s.full_name,
                score=r.score if r else None,
                absent=r.absent if r else False,
                recorded=r is not None,
            )
        )
    return natija


async def enter_results(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    exam_id: uuid.UUID,
    scores: list[ScoreIn],
    ip: str | None = None,
) -> None:
    """Ballarni kiritish (upsert). Imtihon «oʻtkazildi» holatiga oʻtadi.

    Ball faqat imtihon sinfining oʻquvchisiga yoziladi — begona
    `student_id` 422 bilan qaytadi.
    """
    exam = await _get_exam(session, exam_id)
    if exam.status == ExamStatus.BEKOR.value:
        raise ConflictError("Bekor qilingan imtihonga ball kiritilmaydi.")

    sinf_oquvchilari = set(
        (
            await session.execute(
                select(Student.id).where(
                    Student.class_id == exam.class_id, Student.is_archived.is_(False)
                )
            )
        ).scalars()
    )

    mavjud = {
        r.student_id: r
        for r in (
            await session.execute(
                select(ExamResult).where(ExamResult.exam_id == exam_id)
            )
        ).scalars()
    }

    for item in scores:
        if item.student_id not in sinf_oquvchilari:
            raise ValidationError("Roʻyxatda imtihon sinfiga tegishli boʻlmagan oʻquvchi bor.")
        if not item.absent and (item.score is None or not (0 <= item.score <= 100)):
            raise ValidationError("Ball 0 dan 100 gacha boʻlsin.")

        r = mavjud.get(item.student_id)
        if r is None:
            session.add(
                ExamResult(
                    exam_id=exam_id,
                    student_id=item.student_id,
                    score=None if item.absent else item.score,
                    absent=item.absent,
                )
            )
        else:
            r.is_archived = False
            r.score = None if item.absent else item.score
            r.absent = item.absent

    if exam.status == ExamStatus.REJADA.value:
        exam.status = ExamStatus.OTKAZILDI.value

    audit_service.record(
        session,
        object_type="exam",
        object_id=exam.id,
        action=AuditAction.UPDATE,
        old=None,
        new={"results_entered": len(scores)},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()


# ─────────────────────────── Dars rejalari ───────────────────────────


async def list_plans(session: AsyncSession) -> list[PlanRow]:
    rows = await session.execute(
        select(LessonPlan, User.last_name + " " + User.first_name, Subject.name, SchoolClass.name)
        .join(User, User.id == LessonPlan.teacher_id)
        .join(Subject, Subject.id == LessonPlan.subject_id)
        .join(SchoolClass, SchoolClass.id == LessonPlan.class_id)
        .where(LessonPlan.is_archived.is_(False))
        .order_by(LessonPlan.created_at.desc())
    )
    return [
        PlanRow(plan=p, teacher_name=t, subject_name=s, class_name=c)
        for p, t, s, c in rows.all()
    ]


async def create_plan(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    teacher_id: uuid.UUID,
    subject_id: uuid.UUID,
    class_id: uuid.UUID,
    period: str,
    ip: str | None = None,
) -> LessonPlan:
    if not period.strip():
        raise ValidationError("Davr koʻrsatilsin.")

    teacher = await session.get(User, teacher_id)
    if teacher is None or teacher.is_archived:
        raise NotFoundError("Ustoz topilmadi.")

    mavjud = await session.scalar(
        select(LessonPlan).where(
            LessonPlan.teacher_id == teacher_id,
            LessonPlan.subject_id == subject_id,
            LessonPlan.class_id == class_id,
            LessonPlan.period == period.strip(),
            LessonPlan.is_archived.is_(False),
        )
    )
    if mavjud is not None:
        raise ConflictError("Bu davr uchun reja allaqachon roʻyxatda.")

    plan = LessonPlan(
        teacher_id=teacher_id,
        subject_id=subject_id,
        class_id=class_id,
        period=period.strip(),
    )
    session.add(plan)
    await session.flush()
    await session.commit()
    return plan


async def set_plan_status(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    plan_id: uuid.UUID,
    status: str,
    comment: str | None = None,
    ip: str | None = None,
) -> LessonPlan:
    """Tasdiqlash yoki qaytarish. Qaytarishda sabab MAJBURIY —
    sababsiz «qaytarildi» ustozga hech narsa demaydi."""
    plan = await session.get(LessonPlan, plan_id)
    if plan is None or plan.is_archived:
        raise NotFoundError("Reja topilmadi.")

    if status not in {PlanStatus.TASDIQLANDI.value, PlanStatus.QAYTARILDI.value}:
        raise ValidationError("Holat notoʻgʻri.")
    if status == PlanStatus.QAYTARILDI.value and not (comment or "").strip():
        raise ValidationError("Qaytarish sababi koʻrsatilsin.")

    plan.status = status
    plan.comment = (comment or "").strip() or None
    await session.commit()
    return plan
