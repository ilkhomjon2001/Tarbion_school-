"""Oʻquv yili, chorak, taʼtil, qoʻngʻiroq endpointlari (T-007).

TZ: ADM-01, ADM-07.

Oʻqish hammaga ochiq (kirgan foydalanuvchiga): chorak sanalari va dars
vaqtlari maxfiy emas, ular oʻquvchi va ota-ona jadvalida ham koʻrinadi.
Yozish esa `schedule.manage` huquqini talab qiladi — rolning oʻzi
yetarli emas (T-005).
"""

import uuid

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.core.exceptions import NotFoundError
from app.schemas.academic import (
    AcademicYearCreateIn,
    AcademicYearOut,
    AcademicYearUpdateIn,
    BellOut,
    BellsIn,
    HolidayIn,
    HolidayOut,
    TermOut,
    TermsIn,
)
from app.services import academic_service

router = APIRouter(prefix="/academic", tags=["academic"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _year_out(year: object) -> AcademicYearOut:
    return AcademicYearOut.model_validate(year, from_attributes=True)


# ─────────────────────────── Oʻquv yili ───────────────────────────


@router.get("/years", response_model=list[AcademicYearOut])
async def years(user: CurrentUserDep, session: SessionDep) -> list[AcademicYearOut]:
    return [_year_out(y) for y in await academic_service.list_years(session)]


@router.get("/years/current", response_model=AcademicYearOut)
async def current_year(user: CurrentUserDep, session: SessionDep) -> AcademicYearOut:
    """Joriy oʻquv yili. Belgilanmagan boʻlsa `404` — bu sozlama xatosi."""
    year = await academic_service.current_year(session)
    if year is None:
        raise NotFoundError("Joriy oʻquv yili belgilanmagan.")
    return _year_out(year)


@router.post("/years", response_model=AcademicYearOut, status_code=201)
async def create_year(
    payload: AcademicYearCreateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AcademicYearOut:
    """Yangi oʻquv yili (ADM-01). Huquq: `schedule.manage`."""
    year = await academic_service.create_year(
        session,
        actor=user,
        name=payload.name,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        make_current=payload.make_current,
        ip=_client_ip(request),
    )
    return _year_out(year)


@router.patch("/years/{year_id}", response_model=AcademicYearOut)
async def update_year(
    year_id: uuid.UUID,
    payload: AcademicYearUpdateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AcademicYearOut:
    year = await academic_service.update_year(
        session,
        actor=user,
        year_id=year_id,
        name=payload.name,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        ip=_client_ip(request),
    )
    return _year_out(year)


@router.post("/years/{year_id}/current", response_model=AcademicYearOut)
async def make_current(
    year_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> AcademicYearOut:
    """Joriy yilni almashtiradi — bir vaqtda faqat bittasi joriy."""
    year = await academic_service.set_current_year(
        session, actor=user, year_id=year_id, ip=_client_ip(request)
    )
    return _year_out(year)


# ─────────────────────────── Choraklar ───────────────────────────


@router.get("/years/{year_id}/terms", response_model=list[TermOut])
async def terms(year_id: uuid.UUID, user: CurrentUserDep, session: SessionDep) -> list[TermOut]:
    rows = await academic_service.list_terms(session, year_id)
    return [TermOut.model_validate(t, from_attributes=True) for t in rows]


@router.put("/years/{year_id}/terms", response_model=list[TermOut])
async def set_terms(
    year_id: uuid.UUID,
    payload: TermsIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> list[TermOut]:
    """Choraklarni yaxlit yozadi. Qoplanish → `409`."""
    rows = await academic_service.set_terms(
        session,
        actor=user,
        year_id=year_id,
        terms=[
            academic_service.TermIn(
                index=t.index, name=t.name, starts_on=t.starts_on, ends_on=t.ends_on
            )
            for t in payload.terms
        ],
        ip=_client_ip(request),
    )
    return [TermOut.model_validate(t, from_attributes=True) for t in rows]


# ─────────────────────────── Taʼtillar ───────────────────────────


@router.get("/years/{year_id}/holidays", response_model=list[HolidayOut])
async def holidays(
    year_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> list[HolidayOut]:
    rows = await academic_service.list_holidays(session, year_id)
    return [HolidayOut.model_validate(h, from_attributes=True) for h in rows]


@router.post("/years/{year_id}/holidays", response_model=HolidayOut, status_code=201)
async def add_holiday(
    year_id: uuid.UUID,
    payload: HolidayIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> HolidayOut:
    """Taʼtil kuni — bu kunga dars generatsiya qilinmaydi (T-012)."""
    holiday = await academic_service.add_holiday(
        session,
        actor=user,
        year_id=year_id,
        day=payload.day,
        title=payload.title,
        ip=_client_ip(request),
    )
    return HolidayOut.model_validate(holiday, from_attributes=True)


@router.post("/holidays/{holiday_id}/archive", response_model=HolidayOut)
async def archive_holiday(
    holiday_id: uuid.UUID,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> HolidayOut:
    """Roʻyxatdan chiqaradi. Oʻchirish YOʻQ (CLAUDE.md 1-qoida)."""
    holiday = await academic_service.archive_holiday(
        session, actor=user, holiday_id=holiday_id, ip=_client_ip(request)
    )
    return HolidayOut.model_validate(holiday, from_attributes=True)


# ─────────────────────── Qoʻngʻiroqlar jadvali ───────────────────────


@router.get("/years/{year_id}/bells", response_model=list[BellOut])
async def bells(year_id: uuid.UUID, user: CurrentUserDep, session: SessionDep) -> list[BellOut]:
    """Dars vaqtlari (ADM-07). Vaqt mahalliy — Asia/Tashkent."""
    rows = await academic_service.list_bells(session, year_id)
    return [BellOut.model_validate(b, from_attributes=True) for b in rows]


@router.put("/years/{year_id}/bells", response_model=list[BellOut])
async def set_bells(
    year_id: uuid.UUID,
    payload: BellsIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> list[BellOut]:
    """Qoʻngʻiroqlar jadvalini yaxlit yozadi. Vaqt qoplanishi → `409`."""
    rows = await academic_service.set_bells(
        session,
        actor=user,
        year_id=year_id,
        bells=[
            academic_service.BellIn(period=b.period, starts_at=b.starts_at, ends_at=b.ends_at)
            for b in payload.bells
        ],
        ip=_client_ip(request),
    )
    return [BellOut.model_validate(b, from_attributes=True) for b in rows]
