"""Maʼlumotnoma endpointlari (T-008, T-009).

TZ: ADM-02…ADM-06, ADM-11, AUT-03.

Routerda rol darvozasi yoʻq: kim nimani koʻrishini `access.py`,
kim nima qila olishini `Permission` hal qiladi. Ustoz oʻz sinfining
oʻquvchilarini koʻradi, ota-ona faqat oʻz farzandini, administrator
hammasini — bitta endpoint, kesim soʻrov darajasida (X-1).
"""

import uuid

from fastapi import APIRouter, Query, Request, Response

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.core.exceptions import NotFoundError
from app.models import Guardian, User
from app.schemas.school import (
    ClassCreateIn,
    ClassOut,
    ClassSubjectIn,
    ClassSubjectOut,
    GuardianCreatedOut,
    GuardianCreateIn,
    GuardianLinkIn,
    GuardianOut,
    GuardianRowOut,
    GuardianUnlinkIn,
    HomeroomIn,
    PasswordResetOut,
    StaffCreatedOut,
    StaffCreateIn,
    StaffOut,
    StaffSubjectsIn,
    StudentArchiveIn,
    StudentCardOut,
    StudentCreateIn,
    StudentListRowOut,
    StudentMoveIn,
    SubjectCreateIn,
    SubjectOut,
)
from app.services import guardian_service, reference_service, school_service, user_service

router = APIRouter(prefix="/school", tags=["school"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _card_out(card: school_service.StudentCard) -> StudentCardOut:
    s = card.student
    return StudentCardOut(
        id=s.id,
        last_name=s.last_name,
        first_name=s.first_name,
        middle_name=s.middle_name,
        full_name=s.full_name,
        birth_date=s.birth_date,
        class_id=s.class_id,
        class_name=card.class_name,
        is_archived=s.is_archived,
        guardians=[
            GuardianOut(
                user_id=g.user_id,
                full_name=g.full_name,
                relation=g.relation,
                phone=g.phone,
            )
            for g in card.guardians
        ],
    )


# ─────────────────────────── Maʼlumotnomalar ───────────────────────────


@router.get("/subjects", response_model=list[SubjectOut])
async def subjects(user: CurrentUserDep, session: SessionDep) -> list[SubjectOut]:
    rows = await school_service.list_subjects(session)
    return [SubjectOut(id=s.id, name=s.name, short_name=s.short_name) for s in rows]


@router.get("/classes", response_model=list[ClassOut])
async def classes(user: CurrentUserDep, session: SessionDep) -> list[ClassOut]:
    """Joriy oʻquv yilidagi sinflar (ADM-02)."""
    rows = await school_service.list_classes(session)
    return [
        ClassOut(
            id=c.id,
            name=c.name,
            academic_year=c.academic_year,
            homeroom_teacher=c.homeroom_teacher,
            homeroom_teacher_id=c.homeroom_teacher_id,
            student_count=c.student_count,
        )
        for c in rows
    ]


@router.get("/classes/{class_id}/subjects", response_model=list[ClassSubjectOut])
async def subjects_of_class(
    class_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[ClassSubjectOut]:
    """Sinfda oʻqitiladigan fanlar va haftalik soati (ADM-03)."""
    rows = await school_service.class_subjects(session, class_id)
    return [ClassSubjectOut(subject_id=s.id, subject_name=s.name, weekly_hours=h) for s, h in rows]


@router.get("/staff", response_model=list[StaffOut])
async def staff(user: CurrentUserDep, session: SessionDep) -> list[StaffOut]:
    """Xodimlar — ustoz, administrator, rahbariyat (ADM-04)."""
    rows = await school_service.list_staff(session, user)
    return [
        StaffOut(
            user_id=r.user_id,
            login=r.login,
            full_name=r.full_name,
            roles=r.roles,
            subjects=r.subjects,
            subject_ids=r.subject_ids,
            is_active=r.is_active,
        )
        for r in rows
    ]


# ─────────────────────────── Oʻquvchilar ───────────────────────────


@router.get("/students", response_model=list[StudentListRowOut])
async def students(
    user: CurrentUserDep,
    session: SessionDep,
    class_id: uuid.UUID | None = None,
    q: str | None = Query(default=None, description="Ism yoki familiya"),
    archived: bool = False,
    limit: int = Query(default=200, le=500),
) -> list[StudentListRowOut]:
    """Oʻquvchilar roʻyxati (ADM-05).

    Tugʻilgan sana, telefon va vasiy maʼlumoti QAYTMAYDI (X-6) — ular
    kartochkada. Ota-ona bu endpointdan faqat oʻz farzandini oladi.
    """
    rows = await school_service.list_students(
        session, user, class_id=class_id, query=q, archived=archived, limit=limit
    )
    return [
        StudentListRowOut(
            id=s.id,
            full_name=s.full_name,
            class_name=class_name,
            is_archived=s.is_archived,
        )
        for s, class_name in rows
    ]


@router.get("/students/{student_id}", response_model=StudentCardOut)
async def student_card(
    student_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> StudentCardOut:
    """Bitta oʻquvchi — vasiylari bilan.

    Ruxsat yoʻq boʻlsa `403` (X-3: `404` obyekt mavjudligini oshkor
    qilardi).
    """
    return _card_out(await school_service.student_card(session, user, student_id))


@router.post("/students", response_model=StudentCardOut, status_code=201)
async def create_student(
    payload: StudentCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentCardOut:
    """Yangi oʻquvchi. Huquq: `students.manage`."""
    student = await school_service.create_student(
        session,
        actor=user,
        last_name=payload.last_name,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        birth_date=payload.birth_date,
        class_id=payload.class_id,
        ip=_client_ip(request),
    )
    return _card_out(await school_service.student_card(session, user, student.id))


@router.put("/students/{student_id}/class", response_model=StudentCardOut)
async def move_student(
    student_id: uuid.UUID,
    payload: StudentMoveIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentCardOut:
    """Boshqa sinfga koʻchirish (ADM-06)."""
    await school_service.move_student(
        session,
        actor=user,
        student_id=student_id,
        class_id=payload.class_id,
        ip=_client_ip(request),
    )
    return _card_out(await school_service.student_card(session, user, student_id))


@router.post("/students/{student_id}/archive", response_model=StudentCardOut)
async def archive_student(
    student_id: uuid.UUID,
    payload: StudentArchiveIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentCardOut:
    """Arxivlaydi. Oʻchirish YOʻQ (CLAUDE.md 1-qoida). Sabab majburiy."""
    await school_service.archive_student(
        session,
        actor=user,
        student_id=student_id,
        reason=payload.reason,
        ip=_client_ip(request),
    )
    return _card_out(await school_service.student_card(session, user, student_id))


@router.post("/students/{student_id}/restore", response_model=StudentCardOut)
async def restore_student(
    student_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentCardOut:
    """Arxivdan qaytaradi — xato bilan arxivlangan boʻlsa."""
    await school_service.restore_student(
        session, actor=user, student_id=student_id, ip=_client_ip(request)
    )
    return _card_out(await school_service.student_card(session, user, student_id))


@router.post("/staff", response_model=StaffCreatedOut, status_code=201)
async def create_staff(
    payload: StaffCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StaffCreatedOut:
    """Yangi xodim hisobi (ADM-04). Huquq: `users.create`.

    Login `familiya.ism` shaklida tizim tomonidan yasaladi. Boshlangʻich
    parol javobda BIR MARTA qaytadi — keyin tiklab boʻlmaydi.
    """
    yaratildi = await school_service.create_staff(
        session,
        actor=user,
        last_name=payload.last_name,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        roles=payload.roles,
        phone=payload.phone,
        email=payload.email,
        subject_ids=payload.subject_ids,
        ip=_client_ip(request),
    )
    return StaffCreatedOut(
        user_id=yaratildi.user.id,
        login=yaratildi.user.login,
        full_name=yaratildi.user.full_name,
        initial_password=yaratildi.initial_password,
    )


@router.put("/staff/{user_id}/subjects", status_code=204)
async def set_staff_subjects(
    user_id: uuid.UUID,
    payload: StaffSubjectsIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Ustozga fan biriktiradi (ADM-04). Huquq: `users.manage`.

    Roʻyxatdan chiqqan biriktirish arxivlanadi — oʻtgan baho va davomat
    oʻsha ustoz-fan juftiga bogʻlangan.
    """
    await school_service.set_teacher_subjects(
        session,
        actor=user,
        teacher_id=user_id,
        subject_ids=payload.subject_ids,
        ip=_client_ip(request),
    )
    return Response(status_code=204)


@router.post("/staff/{user_id}/reset-password", response_model=PasswordResetOut)
async def reset_staff_password(
    user_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> PasswordResetOut:
    """Yangi boshlangʻich parol. Huquq: `users.reset_password`.

    Xodim keyingi kirishda uni almashtirishga majbur boʻladi.
    """
    parol = await user_service.reset_password(
        session, actor=user, user_id=user_id, ip=_client_ip(request)
    )
    xodim = await session.get(User, user_id)
    await session.commit()
    return PasswordResetOut(login=xodim.login if xodim else "", new_password=parol)


@router.post("/staff/{user_id}/archive", status_code=204)
async def archive_staff(
    user_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Xodimni arxivlaydi. Oʻchirish YOʻQ (CLAUDE.md 1-qoida)."""
    await user_service.archive_user(session, actor=user, user_id=user_id, ip=_client_ip(request))
    await session.commit()
    return Response(status_code=204)


# ─────────────── Maʼlumotnomani boshqarish (ADM-02, ADM-03) ───────────────


@router.post("/subjects", response_model=SubjectOut, status_code=201)
async def create_subject(
    payload: SubjectCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> SubjectOut:
    """Yangi fan. Huquq: `students.manage`.

    Arxivdagi bir xil nomli fan boʻlsa — u qaytariladi, yangi yozuv
    yaratilmaydi: oʻtgan baholar aynan oʻsha fanga bogʻlangan.
    """
    s = await reference_service.create_subject(
        session,
        actor=user,
        name=payload.name,
        short_name=payload.short_name,
        ip=_client_ip(request),
    )
    return SubjectOut(id=s.id, name=s.name, short_name=s.short_name)


@router.post("/subjects/{subject_id}/archive", response_model=SubjectOut)
async def archive_subject(
    subject_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> SubjectOut:
    """Oʻquv rejasidan chiqaradi. Jadvalda ishlatilayotgan fan → `409`."""
    s = await reference_service.archive_subject(
        session, actor=user, subject_id=subject_id, ip=_client_ip(request)
    )
    return SubjectOut(id=s.id, name=s.name, short_name=s.short_name)


async def _class_out(session: SessionDep, class_id: uuid.UUID) -> ClassOut:
    """Sinfni roʻyxat bilan bir xil shaklda qaytaradi.

    Roʻyxat funksiyasi qayta ishlatiladi: oʻquvchi soni va rahbar
    ismini ikkinchi marta yigʻish kodni ikkiga boʻlardi.
    """
    rows = await school_service.list_classes(session)
    c = next((x for x in rows if x.id == class_id), None)
    if c is None:
        raise NotFoundError("Sinf topilmadi.")
    return ClassOut(
        id=c.id,
        name=c.name,
        academic_year=c.academic_year,
        homeroom_teacher=c.homeroom_teacher,
        homeroom_teacher_id=c.homeroom_teacher_id,
        student_count=c.student_count,
    )


@router.post("/classes", response_model=ClassOut, status_code=201)
async def create_class(
    payload: ClassCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> ClassOut:
    """Yangi sinf joriy oʻquv yilida (ADM-02).

    Sinf rahbari koʻrsatilsa, unga `homeroom_teacher` roli ham
    beriladi — rolsiz u sinf rahbari ekranlarini koʻra olmasdi.
    """
    cls = await reference_service.create_class(
        session,
        actor=user,
        name=payload.name,
        homeroom_teacher_id=payload.homeroom_teacher_id,
        ip=_client_ip(request),
    )
    return await _class_out(session, cls.id)


@router.put("/classes/{class_id}/homeroom", response_model=ClassOut)
async def set_homeroom(
    class_id: uuid.UUID,
    payload: HomeroomIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> ClassOut:
    """Sinf rahbarini almashtiradi. `null` — olib tashlash."""
    await reference_service.set_homeroom_teacher(
        session,
        actor=user,
        class_id=class_id,
        teacher_id=payload.teacher_id,
        ip=_client_ip(request),
    )
    return await _class_out(session, class_id)


@router.post("/classes/{class_id}/archive", status_code=204)
async def archive_class(
    class_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Arxivlaydi. Oʻquvchisi bor sinf → `409`."""
    await reference_service.archive_class(
        session, actor=user, class_id=class_id, ip=_client_ip(request)
    )
    return Response(status_code=204)


@router.put("/classes/{class_id}/subjects", status_code=204)
async def set_class_subject(
    class_id: uuid.UUID,
    payload: ClassSubjectIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> Response:
    """Sinfga fan biriktiradi (ADM-03). `weekly_hours=0` — chiqaradi."""
    await reference_service.set_class_subject(
        session,
        actor=user,
        class_id=class_id,
        subject_id=payload.subject_id,
        weekly_hours=payload.weekly_hours,
        ip=_client_ip(request),
    )
    return Response(status_code=204)


# ─────────────────────────── Vasiylar (T-009) ───────────────────────────


async def _guardian_row(session: SessionDep, link: Guardian, vasiy: User) -> GuardianRowOut:
    return GuardianRowOut(
        id=link.id,
        user_id=vasiy.id,
        full_name=vasiy.full_name,
        login=vasiy.login,
        relation=link.relation,
        phone=vasiy.phone,
        is_primary=link.is_primary,
        is_archived=link.is_archived,
        children_count=await guardian_service.children_count(session, vasiy.id),
    )


@router.get("/students/{student_id}/guardians", response_model=list[GuardianRowOut])
async def student_guardians(
    student_id: uuid.UUID,
    user: CurrentUserDep,
    session: SessionDep,
    archived: bool = False,
) -> list[GuardianRowOut]:
    """Oʻquvchining vasiylari.

    Kirish huquqi kartochka orqali tekshiriladi — ota-ona bu yerdan
    begona oilaning vasiylarini koʻra olmaydi (X-1).
    """
    await school_service.student_card(session, user, student_id)
    rows = await guardian_service.list_guardians(session, student_id, include_archived=archived)
    return [await _guardian_row(session, g, u) for g, u in rows]


@router.post(
    "/students/{student_id}/guardians", response_model=GuardianCreatedOut, status_code=201
)
async def create_guardian(
    student_id: uuid.UUID,
    payload: GuardianCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> GuardianCreatedOut:
    """Yangi ota-ona hisobi ochib bogʻlaydi. Huquq: `students.manage`.

    Telefon boshqa ota-onada boʻlsa `409` — bu odatda ikkinchi farzand,
    mavjud hisobga bogʻlash kerak.
    """
    link, created = await guardian_service.create_and_link(
        session,
        actor=user,
        student_id=student_id,
        last_name=payload.last_name,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        phone=payload.phone,
        email=payload.email,
        relation=payload.relation,
        is_primary=payload.is_primary,
        ip=_client_ip(request),
    )
    return GuardianCreatedOut(
        guardian=await _guardian_row(session, link, created.user),
        initial_password=created.initial_password,
    )


@router.put("/students/{student_id}/guardians", response_model=GuardianRowOut)
async def link_guardian(
    student_id: uuid.UUID,
    payload: GuardianLinkIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> GuardianRowOut:
    """Mavjud hisobni vasiy qilib bogʻlaydi — ikkinchi farzand shu yoʻldan."""
    link = await guardian_service.link_existing(
        session,
        actor=user,
        student_id=student_id,
        user_id=payload.user_id,
        relation=payload.relation,
        is_primary=payload.is_primary,
        ip=_client_ip(request),
    )
    vasiy = await session.get(User, payload.user_id)
    assert vasiy is not None
    return await _guardian_row(session, link, vasiy)


@router.post(
    "/students/{student_id}/guardians/{guardian_id}/primary", response_model=GuardianRowOut
)
async def make_primary(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> GuardianRowOut:
    """Asosiy vasiy — xabarnoma birinchi navbatda shunga ketadi."""
    link = await guardian_service.set_primary(
        session,
        actor=user,
        student_id=student_id,
        guardian_id=guardian_id,
        ip=_client_ip(request),
    )
    vasiy = await session.get(User, link.user_id)
    assert vasiy is not None
    return await _guardian_row(session, link, vasiy)


@router.post(
    "/students/{student_id}/guardians/{guardian_id}/unlink", response_model=GuardianRowOut
)
async def unlink_guardian(
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    payload: GuardianUnlinkIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> GuardianRowOut:
    """Bogʻlanishni arxivlaydi — kirish huquqi shu zahoti yopiladi.

    Oʻchirish endpointi ATAYLAB yoʻq (1-qoida): «kim qachon kimga
    bogʻlangan edi» tarixi qolishi kerak.
    """
    link = await guardian_service.unlink(
        session,
        actor=user,
        student_id=student_id,
        guardian_id=guardian_id,
        reason=payload.reason,
        ip=_client_ip(request),
    )
    vasiy = await session.get(User, link.user_id)
    assert vasiy is not None
    return await _guardian_row(session, link, vasiy)
