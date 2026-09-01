"""Soʻrovnomalar servisi.

Uch tomon bor va uchalasining chegarasi shu yerda:

  · administrator (`surveys.manage`) — tuzadi, faollashtiradi, yopadi,
    natijani koʻradi;
  · ota-ona — FAQAT farzandiga dars beradigan ustozlarni baholaydi.
    Roʻyxat uning uchun serverda quriladi (X-1 ruhi): begona ustozga
    javob yuborsa 403;
  · ustozning oʻzi — natijalarni KOʻRMAYDI. Bu rahbariyat vositasi;
    ustozga koʻrsatish qarori keyin, alohida qabul qilinadi.

Anonimlik: natijada ota-onaning kimligi yoʻq — faqat sinf nomi
(«7-A ota-onasi») va matn. Javob egasi bazada bor (takror javobni
toʻsish uchun), lekin natija sxemasiga chiqmaydi (X-5 ruhi).
"""

import uuid
from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.models import (
    AuditAction,
    Guardian,
    Permission,
    ScheduleEntry,
    SchoolClass,
    Student,
    Survey,
    SurveyQuestion,
    SurveyResponse,
    SurveyScore,
    SurveyStatus,
    User,
)
from app.services import audit_service, permissions
from app.services.access import CurrentUser


@dataclass(frozen=True, slots=True)
class SurveyRow:
    survey: Survey
    questions: list[SurveyQuestion]
    response_count: int


@dataclass(frozen=True, slots=True)
class TeacherToRate:
    teacher_id: uuid.UUID
    teacher_name: str
    subjects: list[str]
    class_name: str
    answered: bool


@dataclass(frozen=True, slots=True)
class QuestionAvg:
    text: str
    average: float


@dataclass(frozen=True, slots=True)
class TeacherResult:
    teacher_id: uuid.UUID
    teacher_name: str
    response_count: int
    average: float
    #: 1..5 yaxlitlangan oʻrtacha boʻyicha taqsimot.
    distribution: dict[int, int] = field(default_factory=dict)
    criteria: list[QuestionAvg] = field(default_factory=list)
    #: (sinf nomi, matn) — muallifsiz.
    comments: list[tuple[str, str]] = field(default_factory=list)


async def _assert_manage(session: AsyncSession, actor: CurrentUser) -> None:
    await permissions.assert_permission(session, actor, Permission.SURVEYS_MANAGE)


async def _get(session: AsyncSession, survey_id: uuid.UUID) -> Survey:
    survey = await session.get(Survey, survey_id)
    if survey is None or survey.is_archived:
        raise NotFoundError("Soʻrovnoma topilmadi.")
    return survey


async def questions_of(session: AsyncSession, survey_id: uuid.UUID) -> list[SurveyQuestion]:
    rows = await session.execute(
        select(SurveyQuestion)
        .where(SurveyQuestion.survey_id == survey_id, SurveyQuestion.is_archived.is_(False))
        .order_by(SurveyQuestion.position)
    )
    return list(rows.scalars())


# ─────────────────────────── Boshqarish ───────────────────────────


async def create(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    title: str,
    questions: list[str],
    ip: str | None = None,
) -> Survey:
    await _assert_manage(session, actor)
    if not title.strip():
        raise ValidationError("Sarlavha boʻsh boʻlmasin.")
    toza = [q.strip() for q in questions if q.strip()]
    if not (1 <= len(toza) <= 15):
        raise ValidationError("Savollar soni 1 dan 15 gacha boʻlsin.")

    survey = Survey(title=title.strip(), created_by_id=actor.id)
    session.add(survey)
    await session.flush()
    for i, text in enumerate(toza, start=1):
        session.add(SurveyQuestion(survey_id=survey.id, text=text, position=i))

    audit_service.record(
        session,
        object_type="survey",
        object_id=survey.id,
        action=AuditAction.CREATE,
        old=None,
        new={"title": survey.title, "questions": len(toza)},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return survey


async def set_status(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    survey_id: uuid.UUID,
    status: str,
    ip: str | None = None,
) -> Survey:
    """draft → active → closed. Orqaga yoʻl yoʻq: qayta ochilgan
    soʻrovnomada eski va yangi javoblar aralashib ketardi."""
    await _assert_manage(session, actor)
    survey = await _get(session, survey_id)

    ruxsatli = {
        SurveyStatus.DRAFT.value: {SurveyStatus.ACTIVE.value},
        SurveyStatus.ACTIVE.value: {SurveyStatus.CLOSED.value},
        SurveyStatus.CLOSED.value: set(),
    }
    if status not in ruxsatli.get(survey.status, set()):
        raise ConflictError("Bu holatga oʻtkazib boʻlmaydi.")

    eski = survey.status
    survey.status = status
    audit_service.record(
        session,
        object_type="survey",
        object_id=survey.id,
        action=AuditAction.UPDATE,
        old={"status": eski},
        new={"status": status},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return survey


async def list_surveys(session: AsyncSession, actor: CurrentUser) -> list[SurveyRow]:
    await _assert_manage(session, actor)
    surveys = list(
        (
            await session.execute(
                select(Survey)
                .where(Survey.is_archived.is_(False))
                .order_by(Survey.created_at.desc())
            )
        ).scalars()
    )
    natija = []
    for s in surveys:
        soni = (
            await session.scalar(
                select(func.count(SurveyResponse.id)).where(
                    SurveyResponse.survey_id == s.id,
                    SurveyResponse.is_archived.is_(False),
                )
            )
        ) or 0
        natija.append(
            SurveyRow(survey=s, questions=await questions_of(session, s.id), response_count=soni)
        )
    return natija


# ─────────────────────────── Ota-ona tomoni ───────────────────────────


async def _children_class_ids(
    session: AsyncSession, parent_id: uuid.UUID
) -> dict[uuid.UUID, str]:
    """Farzandlarining sinflari — guardians orqali (X-1)."""
    rows = await session.execute(
        select(SchoolClass.id, SchoolClass.name)
        .join(Student, Student.class_id == SchoolClass.id)
        .join(Guardian, Guardian.student_id == Student.id)
        .where(
            Guardian.user_id == parent_id,
            Guardian.is_archived.is_(False),
            Student.is_archived.is_(False),
            SchoolClass.is_archived.is_(False),
        )
        .distinct()
    )
    return dict(rows.all())


async def active_survey(session: AsyncSession) -> Survey | None:
    return await session.scalar(
        select(Survey)
        .where(Survey.status == SurveyStatus.ACTIVE.value, Survey.is_archived.is_(False))
        .order_by(Survey.created_at.desc())
        .limit(1)
    )


async def teachers_for_parent(
    session: AsyncSession, user: CurrentUser, survey_id: uuid.UUID
) -> list[TeacherToRate]:
    """Ota-ona baholay oladigan ustozlar — farzandining jadvalidan."""
    survey = await _get(session, survey_id)
    sinflar = await _children_class_ids(session, user.id)
    if not sinflar:
        return []

    rows = await session.execute(
        select(
            ScheduleEntry.teacher_id,
            User.last_name,
            User.first_name,
            ScheduleEntry.class_id,
            ScheduleEntry.subject_id,
        )
        .join(User, User.id == ScheduleEntry.teacher_id)
        .where(
            ScheduleEntry.class_id.in_(sinflar),
            ScheduleEntry.is_archived.is_(False),
            User.is_archived.is_(False),
        )
        .distinct()
    )

    from app.models import Subject  # noqa: PLC0415 — aylanma import

    subject_names = dict(
        (await session.execute(select(Subject.id, Subject.name))).all()
    )

    javob_bergan = set(
        (
            await session.execute(
                select(SurveyResponse.teacher_id).where(
                    SurveyResponse.survey_id == survey.id,
                    SurveyResponse.respondent_id == user.id,
                    SurveyResponse.is_archived.is_(False),
                )
            )
        ).scalars()
    )

    yigilgan: dict[uuid.UUID, dict] = {}
    for teacher_id, last, first, class_id, subject_id in rows.all():
        t = yigilgan.setdefault(
            teacher_id,
            {"name": f"{last} {first}", "subjects": set(), "class_name": sinflar[class_id]},
        )
        nom = subject_names.get(subject_id)
        if nom:
            t["subjects"].add(nom)

    return [
        TeacherToRate(
            teacher_id=tid,
            teacher_name=t["name"],
            subjects=sorted(t["subjects"]),
            class_name=t["class_name"],
            answered=tid in javob_bergan,
        )
        for tid, t in sorted(yigilgan.items(), key=lambda x: x[1]["name"])
    ]


async def respond(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    survey_id: uuid.UUID,
    teacher_id: uuid.UUID,
    scores: dict[uuid.UUID, int],
    comment: str | None = None,
) -> SurveyResponse:
    """Ota-onaning bitta ustoz haqidagi javobi.

    Uchta tekshiruv, uchalasi serverda:
      · soʻrovnoma faol boʻlsin;
      · ustoz haqiqatan farzandiga dars bersin (403, aks holda
        istalgan ustozga baho «sepish» mumkin boʻlardi);
      · har savolga 1–5 oraligʻida baho boʻlsin.
    """
    survey = await _get(session, survey_id)
    if survey.status != SurveyStatus.ACTIVE.value:
        raise ConflictError("Soʻrovnoma faol emas.")

    ruxsatli = await teachers_for_parent(session, actor, survey_id)
    tanlangan = next((t for t in ruxsatli if t.teacher_id == teacher_id), None)
    if tanlangan is None:
        raise PermissionDeniedError("Bu ustozni baholay olmaysiz.")
    if tanlangan.answered:
        raise ConflictError("Bu ustozga allaqachon javob bergansiz.")

    savollar = await questions_of(session, survey_id)
    kutilgan = {q.id for q in savollar}
    if set(scores) != kutilgan:
        raise ValidationError("Har bir savolga baho qoʻyilsin.")
    if not all(1 <= b <= 5 for b in scores.values()):
        raise ValidationError("Baho 1 dan 5 gacha.")

    javob = SurveyResponse(
        survey_id=survey_id,
        teacher_id=teacher_id,
        respondent_id=actor.id,
        class_name=tanlangan.class_name,
        comment=(comment or "").strip()[:500] or None,
    )
    session.add(javob)
    await session.flush()
    for question_id, score in scores.items():
        session.add(
            SurveyScore(response_id=javob.id, question_id=question_id, score=score)
        )
    # Audit YOʻQ — ataylab: anonim javobning egasini audit jurnaliga
    # yozish anonimlikni teshib qoʻyardi. Takror javob unique bilan toʻsilgan.
    await session.commit()
    return javob


# ─────────────────────────── Natijalar ───────────────────────────


async def results(
    session: AsyncSession, actor: CurrentUser, survey_id: uuid.UUID
) -> list[TeacherResult]:
    await _assert_manage(session, actor)
    survey = await _get(session, survey_id)
    savollar = await questions_of(session, survey.id)
    savol_matni = {q.id: q.text for q in savollar}

    javoblar = list(
        (
            await session.execute(
                select(SurveyResponse).where(
                    SurveyResponse.survey_id == survey.id,
                    SurveyResponse.is_archived.is_(False),
                )
            )
        ).scalars()
    )
    if not javoblar:
        return []

    balllar: dict[uuid.UUID, list[SurveyScore]] = {}
    rows = await session.execute(
        select(SurveyScore).where(
            SurveyScore.response_id.in_([j.id for j in javoblar]),
            SurveyScore.is_archived.is_(False),
        )
    )
    for sc in rows.scalars():
        balllar.setdefault(sc.response_id, []).append(sc)

    teacher_names = dict(
        (
            await session.execute(
                select(User.id, User.last_name + " " + User.first_name).where(
                    User.id.in_({j.teacher_id for j in javoblar})
                )
            )
        ).all()
    )

    natija: dict[uuid.UUID, dict] = {}
    for j in javoblar:
        t = natija.setdefault(
            j.teacher_id,
            {"scores": [], "per_question": {}, "comments": [], "dist": {}},
        )
        j_balllar = balllar.get(j.id, [])
        if j_balllar:
            ortacha = sum(s.score for s in j_balllar) / len(j_balllar)
            t["scores"].append(ortacha)
            yaxlit = round(ortacha)
            t["dist"][yaxlit] = t["dist"].get(yaxlit, 0) + 1
        for s in j_balllar:
            t["per_question"].setdefault(s.question_id, []).append(s.score)
        if j.comment:
            t["comments"].append((j.class_name or "—", j.comment))

    return sorted(
        (
            TeacherResult(
                teacher_id=tid,
                teacher_name=teacher_names.get(tid, ""),
                response_count=len(t["scores"]),
                average=round(sum(t["scores"]) / len(t["scores"]), 2) if t["scores"] else 0.0,
                distribution=t["dist"],
                criteria=[
                    QuestionAvg(
                        text=savol_matni.get(qid, ""),
                        average=round(sum(vals) / len(vals), 2),
                    )
                    for qid, vals in t["per_question"].items()
                ],
                comments=t["comments"],
            )
            for tid, t in natija.items()
        ),
        key=lambda r: -r.average,
    )
