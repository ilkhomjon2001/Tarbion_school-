"""Murojaatlar endpointlari (MUR-01…MUR-06).

Bitta router uchta kabinetga xizmat qiladi: ota-ona, ustoz va
administrator/rahbariyat. Rol boʻyicha ALOHIDA endpoint yozilmadi — u
uchta joyda uchta kirish nazorati degani va biri kechroq unutilardi.
Kesimni `appeals_service._scope()` beradi.

Shu sabab bu routerda `require_roles(...)` darvozasi YOʻQ: ruxsat rolga
emas, maʼlumotga bogʻliq. Har bir endpoint ichida servis tekshiradi.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.models import Appeal, AppealStatus, AppealTarget
from app.schemas.appeals import (
    AppealCreateIn,
    AppealMessageOut,
    AppealNoteCreateIn,
    AppealNoteOut,
    AppealOptionsOut,
    AppealOut,
    AppealSummaryOut,
    AssignIn,
    ClassAppealStatOut,
    MessageCreateIn,
    StatusUpdateIn,
    StudentSearchOut,
)
from app.services import appeals_service

router = APIRouter(prefix="/appeals", tags=["appeals"])


def _to_out(row: tuple, message_count: int = 0) -> AppealOut:
    """Servisdan kelgan qatorni javob sxemasiga oʻgiradi.

    ORM modeli hech qachon toʻgʻridan-toʻgʻri qaytarilmaydi (X-5) —
    `Appeal` ga keyin qoʻshilgan har bir ustun aks holda avtomatik
    tashqariga chiqib ketardi.
    """
    (
        appeal,
        st_last,
        st_first,
        class_name,
        au_last,
        au_first,
        as_last,
        as_first,
        subject_name,
        op_last,
        op_first,
    ) = row
    appeal: Appeal
    return AppealOut(
        id=appeal.id,
        target=appeal.target,
        status=appeal.status,
        title=appeal.title,
        student_id=appeal.student_id,
        student_name=f"{st_last} {st_first}",
        class_name=class_name,
        author_id=appeal.author_id,
        author_name=f"{au_last} {au_first}",
        assignee_id=appeal.assignee_id,
        assignee_name=f"{as_last} {as_first}" if as_last else None,
        subject_name=subject_name,
        created_at=appeal.created_at,
        due_at=appeal.due_at,
        closed_at=appeal.closed_at,
        last_message_at=appeal.last_message_at,
        message_count=message_count,
        created_by_id=appeal.created_by_id,
        created_by_name=f"{op_last} {op_first}" if op_last else None,
    )


@router.get("", response_model=list[AppealOut])
async def list_appeals(
    session: SessionDep,
    user: CurrentUserDep,
    status_filter: Annotated[AppealStatus | None, Query(alias="status")] = None,
    target: AppealTarget | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AppealOut]:
    """Foydalanuvchi koʻrishga haqli murojaatlar.

    Ota-ona oʻzinikini, ustoz oʻziga kelganini, administrator hammasini
    koʻradi — bir xil endpoint, kesimni server hal qiladi.
    """
    rows = await appeals_service.visible_appeals(
        session,
        user,
        status=status_filter.value if status_filter else None,
        target=target.value if target else None,
        limit=limit,
    )
    counts = await appeals_service.message_counts(session, [r[0].id for r in rows])
    return [_to_out(row, counts.get(row[0].id, 0)) for row in rows]


@router.get("/summary", response_model=AppealSummaryOut)
async def appeals_summary(session: SessionDep, user: CurrentUserDep) -> AppealSummaryOut:
    """Kirish qutisi boshidagi raqamlar — foydalanuvchi kesimida."""
    return AppealSummaryOut(**await appeals_service.summary(session, user))


@router.get("/stats/classes", response_model=list[ClassAppealStatOut])
async def stats_classes(session: SessionDep, user: CurrentUserDep) -> list[ClassAppealStatOut]:
    """MUR-06: sinflar kesimi — qayerda muammo koʻp."""
    rows = await appeals_service.stats_by_class(session, user)
    return [
        ClassAppealStatOut(
            class_name=name,
            total=total,
            open=open_count,
            to_management=to_mgmt,
            to_teachers=to_teachers,
            overdue=overdue,
        )
        for name, total, open_count, to_mgmt, to_teachers, overdue in rows
    ]


@router.get("/options", response_model=AppealOptionsOut)
async def compose_options(session: SessionDep, user: CurrentUserDep) -> AppealOptionsOut:
    """MUR-01 formasi uchun: farzandlar va ularga dars beradigan xodimlar."""
    return AppealOptionsOut(children=await appeals_service.compose_options(session, user))


@router.get("/students", response_model=list[StudentSearchOut])
async def search_students(
    session: SessionDep,
    user: CurrentUserDep,
    q: Annotated[str, Query(min_length=2, max_length=80, description="Ism yoki familiya")],
) -> list[StudentSearchOut]:
    """ADM-16: yozishma boshlash uchun oʻquvchi qidiruvi (administrator).

    Vasiy oʻquvchi orqali topiladi — administrator ota-onani roʻyxatdan
    tanlamaydi. Shunda notoʻgʻri oilaga yozib yuborish ehtimoli yoʻqoladi.
    """
    rows = await appeals_service.search_students(session, user, q)
    return [StudentSearchOut(**row) for row in rows]


@router.get("/{appeal_id}", response_model=AppealOut)
async def get_appeal(
    appeal_id: uuid.UUID, session: SessionDep, user: CurrentUserDep
) -> AppealOut:
    """Bitta murojaat — yozishmasi bilan.

    Ichki qaydlar (`AppealNote`) bu javobda YOʻQ: ular alohida endpointda
    va faqat administratorga.
    """
    row = await appeals_service.load_appeal(session, user, appeal_id)
    messages = await appeals_service.thread(session, appeal_id)
    out = _to_out(row, len(messages))
    out.messages = [
        AppealMessageOut(
            id=m.id,
            author_id=m.author_id,
            author_name=f"{last} {first}",
            body=m.body,
            created_at=m.created_at,
        )
        for m, last, first in messages
    ]
    return out


@router.post("", response_model=AppealOut, status_code=status.HTTP_201_CREATED)
async def create_appeal(
    payload: AppealCreateIn, session: SessionDep, user: CurrentUserDep
) -> AppealOut:
    """Yangi yozishma.

    MUR-01 — ota-ona murojaat yozadi.
    ADM-16 — administrator/rahbariyat ota-ona bilan yozishmani boshlaydi
    (telefon suhbatini qayd qilish yoki savol berish).

    Qaysi yoʻl ekanini SERVER aniqlaydi — chaqiruvchining rolidan, soʻrov
    maydonidan emas.
    """
    appeal = await appeals_service.create_appeal(
        session,
        user,
        student_id=payload.student_id,
        target=payload.target.value,
        title=payload.title,
        body=payload.body,
        subject_id=payload.subject_id,
        assignee_id=payload.assignee_id,
        author_id=payload.author_id,
    )
    await session.commit()
    return await get_appeal(appeal.id, session, user)


@router.post(
    "/{appeal_id}/messages",
    response_model=AppealMessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_message(
    appeal_id: uuid.UUID,
    payload: MessageCreateIn,
    session: SessionDep,
    user: CurrentUserDep,
) -> AppealMessageOut:
    """MUR-03: yozishmani davom ettirish."""
    message = await appeals_service.add_message(session, user, appeal_id, payload.body)
    await session.commit()
    return AppealMessageOut(
        id=message.id,
        author_id=message.author_id,
        author_name=user.full_name,
        body=message.body,
        created_at=message.created_at,
    )


@router.patch("/{appeal_id}/status", response_model=AppealOut)
async def update_status(
    appeal_id: uuid.UUID,
    payload: StatusUpdateIn,
    session: SessionDep,
    user: CurrentUserDep,
) -> AppealOut:
    """MUR-05: holatni oʻzgartirish — xodim tomonidan."""
    await appeals_service.set_status(session, user, appeal_id, payload.status.value)
    await session.commit()
    return await get_appeal(appeal_id, session, user)


@router.patch("/{appeal_id}/assignee", response_model=AppealOut)
async def update_assignee(
    appeal_id: uuid.UUID, payload: AssignIn, session: SessionDep, user: CurrentUserDep
) -> AppealOut:
    """Rahbariyatga kelgan murojaatni masʼulga biriktirish (administrator)."""
    await appeals_service.assign(session, user, appeal_id, payload.assignee_id)
    await session.commit()
    return await get_appeal(appeal_id, session, user)


@router.get("/{appeal_id}/notes", response_model=list[AppealNoteOut])
async def list_notes(
    appeal_id: uuid.UUID, session: SessionDep, user: CurrentUserDep
) -> list[AppealNoteOut]:
    """ADM-16: ichki suhbat qaydlari — FAQAT administrator va rahbariyat."""
    rows = await appeals_service.notes_of(session, user, appeal_id)
    return [
        AppealNoteOut(
            id=n.id,
            appeal_id=n.appeal_id,
            kind=n.kind,
            summary=n.summary,
            author_id=n.author_id,
            author_name=f"{last} {first}",
            created_at=n.created_at,
            about_teacher_id=n.about_teacher_id,
            about_teacher_name=f"{t_last} {t_first}" if t_last else None,
            teacher_rating=n.teacher_rating,
            teacher_comment=n.teacher_comment,
        )
        for n, last, first, t_last, t_first in rows
    ]


@router.post(
    "/{appeal_id}/notes", response_model=AppealNoteOut, status_code=status.HTTP_201_CREATED
)
async def create_note(
    appeal_id: uuid.UUID,
    payload: AppealNoteCreateIn,
    session: SessionDep,
    user: CurrentUserDep,
) -> AppealNoteOut:
    """ADM-16: telefon/yuzma-yuz/onlayn suhbat qaydi."""
    note = await appeals_service.add_note(
        session,
        user,
        appeal_id,
        kind=payload.kind.value,
        summary=payload.summary,
        about_teacher_id=payload.about_teacher_id,
        teacher_rating=payload.teacher_rating,
        teacher_comment=payload.teacher_comment,
    )
    await session.commit()
    return AppealNoteOut(
        id=note.id,
        appeal_id=note.appeal_id,
        kind=note.kind,
        summary=note.summary,
        author_id=note.author_id,
        author_name=user.full_name,
        created_at=note.created_at,
        about_teacher_id=note.about_teacher_id,
        teacher_rating=note.teacher_rating,
        teacher_comment=note.teacher_comment,
    )
