"""Oʻquv rejalari (metodik baza) — oʻquv boʻlimi CRUD + Excel oqimi.

Yozish: oʻquv boʻlimi / administrator / super administrator (router
darajasida rol). Joriy rejalarni OʻQISH esa alohida, barcha tizimga
kirganlarga ochiq endpointlarda (`/published...`) — ustoz kabineti
shulardan oladi.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile

from app.api.v1.deps import CurrentUserDep, require_roles
from app.core.db import SessionDep
from app.core.exceptions import ValidationError
from app.models import RoleName
from app.schemas.curriculum import (
    ImportOut,
    LessonCardIn,
    PlanCreateIn,
    PlanLessonsOut,
    PlanRowOut,
    PublishedCatalogOut,
    SearchHitOut,
)
from app.services import curriculum_service

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_UPLOAD = 2 * 1024 * 1024  # 2MB — matnli reja uchun yetarli

router = APIRouter(prefix="/curriculum", tags=["curriculum"])

#: Yozish amallari uchun rol darvozasi.
manage = Depends(
    require_roles(
        RoleName.ACADEMIC.value, RoleName.ADMIN.value, RoleName.SUPERADMIN.value
    )
)


def _row(p) -> PlanRowOut:  # noqa: ANN001
    return PlanRowOut(
        id=p.id,
        fan=p.fan,
        yil=p.yil,
        sinf=p.sinf,
        status=p.status,
        darslar_soni=len(p.lessons),
        source_name=p.source_name,
        created_at=p.created_at,
    )


# ─────────────────── Ochiq (barcha xodim/ustozlar) ───────────────────


@router.get("/published", response_model=PublishedCatalogOut)
async def published_catalog(
    user: CurrentUserDep, session: SessionDep
) -> PublishedCatalogOut:
    """Joriy rejalar katalogi — ustoz kabinetidagi fan tanlagich."""
    return PublishedCatalogOut(fanlar=await curriculum_service.published_catalog(session))


@router.get("/published/plan", response_model=PlanLessonsOut)
async def published_plan(
    fan: str, yil: str, sinf: str, user: CurrentUserDep, session: SessionDep
) -> PlanLessonsOut:
    p = await curriculum_service.published_plan(session, fan=fan, yil=yil, sinf=sinf)
    return PlanLessonsOut(
        id=p.id, fan=p.fan, yil=p.yil, sinf=p.sinf, status=p.status, lessons=p.lessons
    )


# ─────────────────── Boshqaruv (oʻquv boʻlimi) ───────────────────


@router.get("/template", dependencies=[manage])
async def template() -> Response:
    """Boʻsh Excel shablon."""
    return Response(
        content=curriculum_service.build_template(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="reja-shablon.xlsx"'},
    )


@router.get("/plans", response_model=list[PlanRowOut], dependencies=[manage])
async def plans(user: CurrentUserDep, session: SessionDep) -> list[PlanRowOut]:
    return [_row(p) for p in await curriculum_service.list_plans(session)]


@router.get("/plans/{plan_id}", response_model=PlanLessonsOut, dependencies=[manage])
async def plan_lessons(
    plan_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> PlanLessonsOut:
    p = await curriculum_service.get_plan(session, plan_id)
    return PlanLessonsOut(
        id=p.id, fan=p.fan, yil=p.yil, sinf=p.sinf, status=p.status, lessons=p.lessons
    )


@router.post("/import", response_model=ImportOut, status_code=201, dependencies=[manage])
async def import_plan(
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
    fan: Annotated[str, Form()],
    yil: Annotated[str, Form()],
    sinf: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> ImportOut:
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise ValidationError("Fayl 2MB dan oshmasin.")
    natija = await curriculum_service.import_plan(
        session,
        user,
        fan=fan,
        yil=yil,
        sinf=sinf,
        data=data,
        source_name=file.filename,
        ip=request.client.host if request.client else None,
    )
    return ImportOut(plan=_row(natija.plan), warnings=natija.warnings)


# Rol darvozasi ATAYLAB yoʻq: MET-06 boʻyicha kim joriy qila olishi
# SOZLAMAGA bogʻliq va uni servis hal qiladi (`assert_can_publish`).
@router.post("/plans/{plan_id}/publish", response_model=PlanRowOut)
async def publish(
    plan_id: uuid.UUID, request: Request, user: CurrentUserDep, session: SessionDep
) -> PlanRowOut:
    p = await curriculum_service.publish(
        session, user, plan_id, ip=request.client.host if request.client else None
    )
    return _row(p)


@router.post("/plans/{plan_id}/archive", status_code=204, dependencies=[manage])
async def archive(
    plan_id: uuid.UUID, request: Request, user: CurrentUserDep, session: SessionDep
) -> None:
    await curriculum_service.archive(
        session, user, plan_id, ip=request.client.host if request.client else None
    )


@router.get("/plans/{plan_id}/export", dependencies=[manage])
async def export(
    plan_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> Response:
    p = await curriculum_service.get_plan(session, plan_id)
    nom = f"{p.fan}-{p.yil}-{p.sinf}.xlsx".replace(" ", "_")
    return Response(
        content=curriculum_service.export_xlsx(p),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{nom}"'},
    )


# ─────────── Qidiruv, ustoz rejasi, versiyalar (MET-05…MET-07) ───────────


@router.get("/search", response_model=list[SearchHitOut])
async def search(
    session: SessionDep,
    user: CurrentUserDep,
    q: Annotated[str, Query(min_length=2, max_length=80)],
    fan: Annotated[str | None, Query(max_length=80)] = None,
    sinf: Annotated[str | None, Query(max_length=20)] = None,
    chorak: Annotated[int | None, Query(ge=1, le=4)] = None,
) -> list[SearchHitOut]:
    """MET-05: mavzu, atama va jihoz nomi boʻyicha qidiruv.

    Qidiruv faqat JORIY rejalar boʻyicha — qoralama hali hujjat emas.
    Barcha xodimlarga ochiq, `/published` kabi.
    """
    rows = await curriculum_service.search_lessons(
        session, q=q, fan=fan, sinf=sinf, chorak=chorak
    )
    return [
        SearchHitOut(
            plan_id=r.plan_id,
            fan=r.fan,
            yil=r.yil,
            sinf=r.sinf,
            chorak=r.chorak,
            index=r.index,
            title=r.title,
            matched_in=r.matched_in,
        )
        for r in rows
    ]


@router.get("/versions", response_model=list[PlanRowOut], dependencies=[manage])
async def versions(
    session: SessionDep,
    fan: Annotated[str, Query(max_length=80)],
    yil: Annotated[str, Query(max_length=10)],
    sinf: Annotated[str, Query(max_length=20)],
) -> list[PlanRowOut]:
    """MET-07: shu fan/sinf uchun barcha versiyalar, yangisidan eskisiga.

    Eskisiga qaytarish alohida amal emas — oʻsha versiyani qayta joriy
    qilish yetadi (`POST /plans/{id}/publish`).
    """
    rows = await curriculum_service.list_versions(session, fan=fan, yil=yil, sinf=sinf)
    return [_row(p) for p in rows]


@router.post("/plans", response_model=PlanRowOut, status_code=201)
async def create_plan(
    payload: PlanCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> PlanRowOut:
    """MET-06: ustoz oʻz dars rejasini qoʻshadi.

    Rol darvozasi ATAYLAB yoʻq — bu endpoint aynan ustoz uchun.
    Reja QORALAMA boʻlib tugʻiladi va uni joriy qilish alohida amal.
    """
    plan = await curriculum_service.create_plan(
        session,
        user,
        fan=payload.fan,
        yil=payload.yil,
        sinf=payload.sinf,
        lessons=payload.lessons,
        ip=request.client.host if request.client else None,
    )
    return _row(plan)


@router.patch("/plans/{plan_id}/lessons/{index}", response_model=dict)
async def update_lesson_card(
    plan_id: uuid.UUID,
    index: int,
    payload: LessonCardIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> dict:
    """Bitta dars kartochkasini tahrirlaydi (MET-02, MET-03, MET-04).

    Kirish nazorati servisda: oʻquv boʻlimi har doim, ustoz esa faqat
    oʻzi yaratgan QORALAMA rejani.
    """
    return await curriculum_service.update_lesson_card(
        session,
        user,
        plan_id=plan_id,
        index=index,
        changes=payload.model_dump(exclude_unset=True),
        ip=request.client.host if request.client else None,
    )
