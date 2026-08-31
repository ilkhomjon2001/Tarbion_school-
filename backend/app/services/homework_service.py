"""Uy vazifasi — berish, topshirish, tekshirish (UYV-01…UYV-07).

Ikkita qaror modulni belgilaydi:

1. **Vazifa berilganda har bir oʻquvchi uchun yozuv yaratiladi**
   (`status=assigned`). Shunda "kim topshirmadi" savoli `LEFT JOIN`siz
   ishlaydi va UYV-05 xabarnomasi oson topiladi. Narxi — 25 ta qator,
   arzon.

2. **Baho jurnalga tushadi.** Ustoz ishni baholaganda `grades` ga ham
   yozuv qoʻshiladi (`submission_id` orqali bogʻlangan). Sabab: chorak
   bahosi BITTA manbadan hisoblanishi kerak (JUR-04) — aks holda uy
   vazifasi baholari hisobdan tushib qolardi.

Kirish nazorati: ustoz oʻz vazifasini (`load_homework_for_teacher`),
oʻquvchi va ota-ona faqat oʻzinikini (X-1).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.core.timeutil import utcnow
from app.models import (
    SCALE_MAX,
    AuditAction,
    Grade,
    GradeKind,
    GradingScale,
    Homework,
    HomeworkSubmission,
    Lesson,
    NotificationKind,
    SchoolClass,
    Student,
    Subject,
    SubmissionStatus,
)
from app.services import audit_service, notifications_service
from app.services.access import (
    CurrentUser,
    accessible_student_ids,
    assert_can_view_student,
    load_homework_for_teacher,
)

#: Ustoz bir vaqtda koʻradigan vazifalar soni.
DEFAULT_LIMIT = 100


@dataclass(frozen=True, slots=True)
class HomeworkRow:
    id: uuid.UUID
    class_id: uuid.UUID
    class_name: str
    subject_id: uuid.UUID
    subject_name: str
    title: str
    description: str
    due_at: datetime
    allow_late: bool
    max_score: int
    weight: int
    total_count: int
    submitted_count: int
    graded_count: int


@dataclass(frozen=True, slots=True)
class SubmissionRow:
    id: uuid.UUID
    student_id: uuid.UUID
    full_name: str
    status: str
    submitted_at: datetime | None
    answer_text: str | None
    attachment_name: str | None
    score: int | None
    teacher_comment: str | None


# ─────────────────────────── Ustoz ───────────────────────────


async def _counts(
    session: AsyncSession, homework_ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[int, int, int]]:
    """Har vazifa uchun (jami, topshirgan, baholangan) — bitta soʻrovda.

    Har vazifa uchun alohida sanalsa 20 ta vazifada 60 marta bazaga
    borilardi.
    """
    if not homework_ids:
        return {}

    rows = (
        await session.execute(
            select(
                HomeworkSubmission.homework_id,
                func.count(HomeworkSubmission.id),
                func.count(HomeworkSubmission.submitted_at),
                func.count(HomeworkSubmission.graded_at),
            )
            .where(
                HomeworkSubmission.homework_id.in_(homework_ids),
                HomeworkSubmission.is_archived.is_(False),
            )
            .group_by(HomeworkSubmission.homework_id)
        )
    ).all()
    return {hid: (jami, topshirdi, baholandi) for hid, jami, topshirdi, baholandi in rows}


def _row(hw: Homework, class_name: str, subject_name: str, c: tuple[int, int, int]) -> HomeworkRow:
    return HomeworkRow(
        id=hw.id,
        class_id=hw.class_id,
        class_name=class_name,
        subject_id=hw.subject_id,
        subject_name=subject_name,
        title=hw.title,
        description=hw.description or "",
        due_at=hw.due_at,
        allow_late=hw.allow_late,
        max_score=hw.max_score,
        weight=hw.weight,
        total_count=c[0],
        submitted_count=c[1],
        graded_count=c[2],
    )


async def teacher_homework(
    session: AsyncSession,
    user: CurrentUser,
    *,
    class_id: uuid.UUID | None = None,
    limit: int = DEFAULT_LIMIT,
) -> list[HomeworkRow]:
    """Ustozning bergan vazifalari — eng yangisi birinchi (UYV-06)."""
    stmt = (
        select(Homework, SchoolClass.name, Subject.name)
        .join(SchoolClass, SchoolClass.id == Homework.class_id)
        .join(Subject, Subject.id == Homework.subject_id)
        .where(Homework.is_archived.is_(False))
        .order_by(Homework.due_at.desc())
        .limit(limit)
    )
    if not user.is_staff_wide:
        stmt = stmt.where(Homework.teacher_id == user.id)
    if class_id is not None:
        stmt = stmt.where(Homework.class_id == class_id)

    rows = (await session.execute(stmt)).all()
    counts = await _counts(session, [hw.id for hw, _, _ in rows])

    return [
        _row(hw, cls_name, subj_name, counts.get(hw.id, (0, 0, 0)))
        for hw, cls_name, subj_name in rows
    ]


async def _notify_family(
    session: AsyncSession,
    user: CurrentUser,
    student_id: uuid.UUID,
    *,
    kind: NotificationKind,
    title_suffix: str,
    body: str,
    object_id: uuid.UUID,
) -> None:
    """Bitta oʻquvchi boʻyicha xabar.

    Kim koʻrishi `notifications_service._SECTION` da hal qilinadi:
    baholangan ish ota-onaga ham, qaytarilgan ish faqat oʻquvchiga
    boradi. Shu sabab bu yerda roʻyxat filtrlanmaydi — ikki joyda ikki
    xil qoida paydo boʻlmasin.
    """
    oila = await notifications_service.family_recipients(session, [student_id])
    nomlar = await notifications_service.student_names(session, [student_id])
    ism = nomlar.get(student_id)
    if ism is None:
        return

    await notifications_service.notify(
        session,
        recipients=oila.get(student_id, []),
        kind=kind,
        title=f"{ism} — {title_suffix}",
        body=body[:400],
        object_type="homework",
        object_id=object_id,
        actor_id=user.id,
    )


async def create_homework(
    session: AsyncSession,
    user: CurrentUser,
    *,
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
    title: str,
    description: str,
    due_at: datetime,
    lesson_id: uuid.UUID | None = None,
    allow_late: bool = True,
    max_score: int = SCALE_MAX[GradingScale.FIVE.value],
    weight: int = 1,
    ip: str | None = None,
) -> HomeworkRow:
    """Yangi uy vazifasi (UYV-01).

    Sinf oʻquvchilarining har biri uchun `assigned` yozuv yaratiladi —
    "kim topshirmadi" shundan chiqadi.
    """
    from app.services.grade_service import assert_teaches_class_subject

    await assert_teaches_class_subject(session, user, class_id, subject_id)

    if not title.strip():
        raise ValidationError("Vazifa sarlavhasi boʻsh boʻlmasin.")
    if max_score < 1:
        raise ValidationError("Maksimal ball 1 dan kichik boʻlmasin.")
    if weight < 1:
        raise ValidationError("Vazn 1 dan kichik boʻlmasin.")
    if due_at <= utcnow():
        raise ValidationError("Topshirish muddati kelajakda boʻlsin.")

    cls = await session.get(SchoolClass, class_id)
    if cls is None or cls.is_archived:
        raise NotFoundError("Sinf topilmadi.")
    subject = await session.get(Subject, subject_id)
    if subject is None or subject.is_archived:
        raise NotFoundError("Fan topilmadi.")

    if lesson_id is not None:
        lesson = await session.get(Lesson, lesson_id)
        if lesson is None or lesson.class_id != class_id:
            raise NotFoundError("Dars topilmadi.")

    homework = Homework(
        lesson_id=lesson_id,
        class_id=class_id,
        subject_id=subject_id,
        teacher_id=user.id,
        title=title.strip(),
        description=(description or "").strip(),
        due_at=due_at,
        allow_late=allow_late,
        max_score=max_score,
        weight=weight,
    )
    session.add(homework)
    await session.flush()

    students = list(
        (
            await session.execute(
                select(Student.id).where(
                    Student.class_id == class_id, Student.is_archived.is_(False)
                )
            )
        ).scalars()
    )
    for student_id in students:
        session.add(HomeworkSubmission(homework_id=homework.id, student_id=student_id))

    audit_service.record(
        session,
        object_type="homework",
        object_id=homework.id,
        action=AuditAction.CREATE,
        new={"title": homework.title, "class_id": class_id, "due_at": due_at},
        actor_id=user.id,
        ip=ip,
    )

    # Vazifa haqida faqat OʻQUVCHILARGA xabar beriladi. Ota-onaga ham
    # yuborilsa kuniga olti-yetti xabar borardi (har darsga bitta) va
    # muhim xabar — «kelmadi», murojaat — shovqin ichida yoʻqolardi.
    # Yoʻnalish `notifications_service._SECTION` da qatʼiy: ota-ona
    # kabineti bu turkum uchun roʻyxatda yoʻq.
    oila = await notifications_service.family_recipients(session, students)
    muddat = due_at.strftime("%d.%m.%Y")
    for student_id in students:
        await notifications_service.notify(
            session,
            recipients=oila.get(student_id, []),
            kind=NotificationKind.HOMEWORK_NEW,
            title=f"{subject.name}: {homework.title}",
            body=f"Topshirish muddati — {muddat}",
            object_type="homework",
            object_id=homework.id,
            actor_id=user.id,
        )

    await session.commit()

    return _row(homework, cls.name, subject.name, (len(students), 0, 0))


async def archive_homework(
    session: AsyncSession, user: CurrentUser, homework_id: uuid.UUID, *, ip: str | None = None
) -> None:
    """Vazifani olib tashlaydi. Oʻchirish YOʻQ (CLAUDE.md 1-qoida)."""
    homework = await load_homework_for_teacher(session, user, homework_id)
    homework.is_archived = True
    homework.archived_at = utcnow()

    audit_service.record(
        session,
        object_type="homework",
        object_id=homework.id,
        action=AuditAction.ARCHIVE,
        old={"title": homework.title},
        new={"is_archived": True},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()


async def submissions(
    session: AsyncSession, user: CurrentUser, homework_id: uuid.UUID
) -> tuple[Homework, list[SubmissionRow]]:
    """Vazifa boʻyicha oʻquvchilar roʻyxati va ishlari (UYV-03)."""
    homework = await load_homework_for_teacher(session, user, homework_id)

    rows = list(
        (
            await session.execute(
                select(HomeworkSubmission)
                .options(selectinload(HomeworkSubmission.student))
                .where(
                    HomeworkSubmission.homework_id == homework_id,
                    HomeworkSubmission.is_archived.is_(False),
                )
            )
        ).scalars()
    )
    rows.sort(key=lambda s: (s.student.last_name, s.student.first_name))

    return homework, [
        SubmissionRow(
            id=s.id,
            student_id=s.student_id,
            full_name=s.student.full_name,
            status=s.status,
            submitted_at=s.submitted_at,
            answer_text=s.answer_text,
            attachment_name=s.attachment_name,
            score=s.score,
            teacher_comment=s.teacher_comment,
        )
        for s in rows
    ]


async def grade_submission(
    session: AsyncSession,
    user: CurrentUser,
    submission_id: uuid.UUID,
    *,
    score: int,
    comment: str | None = None,
    ip: str | None = None,
) -> SubmissionRow:
    """Bitta ishni baholaydi (UYV-03) va bahoni jurnalga yozadi.

    Jurnalga yozish ataylab: chorak bahosi bitta manbadan hisoblanadi
    (JUR-04). `Grade.submission_id` unikal, shuning uchun qayta
    baholanganda yangi yozuv emas, mavjudi yangilanadi.
    """
    submission = await session.get(HomeworkSubmission, submission_id)
    if submission is None or submission.is_archived:
        raise NotFoundError("Topshiriq topilmadi.")

    homework = await load_homework_for_teacher(session, user, submission.homework_id)

    if score < 0 or score > homework.max_score:
        raise ValidationError(f"Ball 0 dan {homework.max_score} gacha boʻlsin.")

    izoh = (comment or "").strip() or None
    before = {"score": submission.score, "status": submission.status}

    submission.score = score
    submission.teacher_comment = izoh
    submission.status = SubmissionStatus.GRADED.value
    submission.graded_by_id = user.id
    submission.graded_at = utcnow()

    baho = await session.scalar(
        select(Grade).where(Grade.submission_id == submission.id, Grade.is_archived.is_(False))
    )
    if baho is None:
        session.add(
            Grade(
                student_id=submission.student_id,
                subject_id=homework.subject_id,
                lesson_id=homework.lesson_id,
                submission_id=submission.id,
                teacher_id=user.id,
                kind=GradeKind.CURRENT.value,
                value=score,
                max_value=homework.max_score,
                weight=homework.weight,
                comment=izoh,
            )
        )
    else:
        baho.value = score
        baho.comment = izoh
        baho.teacher_id = user.id

    audit_service.record(
        session,
        object_type="homework_submission",
        object_id=submission.id,
        action=AuditAction.UPDATE,
        old=before,
        new={"score": score, "status": submission.status},
        actor_id=user.id,
        ip=ip,
    )

    # Vazifa bahosi jurnalga ham tushadi (yuqorida), lekin bildirishnoma
    # BITTA: `set_lesson_grades` bu yoʻldan oʻtmaydi, shuning uchun
    # ikkilanish yoʻq. Bu — baho, shuning uchun ota-ona ham koʻradi.
    await _notify_family(
        session,
        user,
        submission.student_id,
        kind=NotificationKind.HOMEWORK_GRADED,
        title_suffix=f"{homework.title} — {score}/{homework.max_score} ball",
        body=izoh or "Uy vazifasi baholandi.",
        object_id=homework.id,
    )

    await session.commit()

    await session.refresh(submission, attribute_names=["student"])
    return SubmissionRow(
        id=submission.id,
        student_id=submission.student_id,
        full_name=submission.student.full_name,
        status=submission.status,
        submitted_at=submission.submitted_at,
        answer_text=submission.answer_text,
        attachment_name=submission.attachment_name,
        score=submission.score,
        teacher_comment=submission.teacher_comment,
    )


async def return_submission(
    session: AsyncSession,
    user: CurrentUser,
    submission_id: uuid.UUID,
    *,
    comment: str,
    ip: str | None = None,
) -> SubmissionRow:
    """UYV-03: qayta ishlash uchun qaytaradi. Izoh MAJBURIY.

    Izohsiz qaytarish oʻquvchiga nima notoʻgʻri ekanini aytmaydi —
    vazifa maʼnosini yoʻqotadi.
    """
    if not comment.strip():
        raise ValidationError("Qaytarish sababi yozilishi kerak.")

    submission = await session.get(HomeworkSubmission, submission_id)
    if submission is None or submission.is_archived:
        raise NotFoundError("Topshiriq topilmadi.")

    homework = await load_homework_for_teacher(session, user, submission.homework_id)

    before = {"status": submission.status}
    submission.status = SubmissionStatus.RETURNED.value
    submission.teacher_comment = comment.strip()
    submission.graded_by_id = user.id
    submission.graded_at = utcnow()

    audit_service.record(
        session,
        object_type="homework_submission",
        object_id=submission.id,
        action=AuditAction.UPDATE,
        old=before,
        new={"status": submission.status},
        actor_id=user.id,
        ip=ip,
    )

    # Qaytarilgan ish oʻquvchidan AMAL talab qiladi — u koʻrmasa vazifa
    # qayta ishlanmaydi. Ota-onaga bormaydi (`_SECTION` da yoʻq): bu
    # baho emas, ish jarayoni.
    await _notify_family(
        session,
        user,
        submission.student_id,
        kind=NotificationKind.HOMEWORK_RETURNED,
        title_suffix=f"{homework.title} — qayta ishlash kerak",
        body=comment.strip(),
        object_id=homework.id,
    )

    await session.commit()

    await session.refresh(submission, attribute_names=["student"])
    return SubmissionRow(
        id=submission.id,
        student_id=submission.student_id,
        full_name=submission.student.full_name,
        status=submission.status,
        submitted_at=submission.submitted_at,
        answer_text=submission.answer_text,
        attachment_name=submission.attachment_name,
        score=submission.score,
        teacher_comment=submission.teacher_comment,
    )


# ─────────────────────── Oʻquvchi va ota-ona ───────────────────────


@dataclass(frozen=True, slots=True)
class StudentHomeworkRow:
    submission_id: uuid.UUID
    homework_id: uuid.UUID
    subject_name: str
    title: str
    description: str
    due_at: datetime
    status: str
    submitted_at: datetime | None
    score: int | None
    max_score: int
    teacher_comment: str | None


async def student_homework(
    session: AsyncSession,
    user: CurrentUser,
    student_id: uuid.UUID,
    *,
    only_open: bool = False,
) -> list[StudentHomeworkRow]:
    """Oʻquvchining vazifalari (UYV-02, UYV-07).

    Ota-ona faqat oʻz farzandiniki — tekshiruv `access.py` da (X-1).
    """
    await assert_can_view_student(session, user, student_id)

    stmt = (
        select(HomeworkSubmission, Homework, Subject.name)
        .join(Homework, Homework.id == HomeworkSubmission.homework_id)
        .join(Subject, Subject.id == Homework.subject_id)
        .where(
            HomeworkSubmission.student_id == student_id,
            HomeworkSubmission.is_archived.is_(False),
            Homework.is_archived.is_(False),
        )
        .order_by(Homework.due_at.desc())
    )
    if only_open:
        stmt = stmt.where(
            HomeworkSubmission.status.in_(
                [SubmissionStatus.ASSIGNED.value, SubmissionStatus.RETURNED.value]
            )
        )

    return [
        StudentHomeworkRow(
            submission_id=s.id,
            homework_id=hw.id,
            subject_name=fan,
            title=hw.title,
            description=hw.description or "",
            due_at=hw.due_at,
            status=s.status,
            submitted_at=s.submitted_at,
            score=s.score,
            max_score=hw.max_score,
            teacher_comment=s.teacher_comment,
        )
        for s, hw, fan in (await session.execute(stmt)).all()
    ]


async def submit(
    session: AsyncSession,
    user: CurrentUser,
    submission_id: uuid.UUID,
    *,
    answer_text: str | None = None,
    ip: str | None = None,
) -> StudentHomeworkRow:
    """Oʻquvchi ishini topshiradi (UYV-02).

    Muddatdan keyin topshirilsa `late` — ustoz buni koʻrib turadi
    (UYV-04). `allow_late=False` boʻlsa umuman qabul qilinmaydi.
    """
    submission = await session.get(HomeworkSubmission, submission_id)
    if submission is None or submission.is_archived:
        raise NotFoundError("Topshiriq topilmadi.")

    ruxsat = await accessible_student_ids(session, user)
    if ruxsat is not None and submission.student_id not in ruxsat:
        raise PermissionDeniedError("Bu topshiriq sizga tegishli emas.")

    homework = await session.get(Homework, submission.homework_id)
    if homework is None or homework.is_archived:
        raise NotFoundError("Uy vazifasi topilmadi.")

    if submission.status == SubmissionStatus.GRADED.value:
        raise ValidationError("Baholangan ishni qayta topshirib boʻlmaydi.")

    hozir = utcnow()
    kechikdi = hozir > homework.due_at
    if kechikdi and not homework.allow_late:
        raise ValidationError("Topshirish muddati tugagan.")

    submission.answer_text = (answer_text or "").strip() or None
    submission.submitted_at = hozir
    submission.status = (
        SubmissionStatus.LATE.value if kechikdi else SubmissionStatus.SUBMITTED.value
    )

    audit_service.record(
        session,
        object_type="homework_submission",
        object_id=submission.id,
        action=AuditAction.UPDATE,
        new={"status": submission.status, "submitted_at": hozir},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()

    fan = await session.get(Subject, homework.subject_id)
    return StudentHomeworkRow(
        submission_id=submission.id,
        homework_id=homework.id,
        subject_name=fan.name if fan else "",
        title=homework.title,
        description=homework.description or "",
        due_at=homework.due_at,
        status=submission.status,
        submitted_at=submission.submitted_at,
        score=submission.score,
        max_score=homework.max_score,
        teacher_comment=submission.teacher_comment,
    )
