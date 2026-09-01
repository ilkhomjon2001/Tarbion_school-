"""FastAPI ilovasi — kirish nuqtasi (T-001).

Bu yerda faqat yigʻish boʻladi: sozlama, middleware, xato handlerlari va
router'larni ulash. Biznes mantiq `services/` da, endpointlar `api/v1/` da.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from sqlalchemy import text

from app.api.v1 import academic as academic_router
from app.api.v1 import access as access_router
from app.api.v1 import announcements as announcements_router
from app.api.v1 import appeals as appeals_router
from app.api.v1 import attendance as attendance_router
from app.api.v1 import audit as audit_router
from app.api.v1 import auth as auth_router
from app.api.v1 import director as director_router
from app.api.v1 import documents as documents_router
from app.api.v1 import hr as hr_router
from app.api.v1 import journal as journal_router
from app.api.v1 import notifications as notifications_router
from app.api.v1 import parent as parent_router
from app.api.v1 import schedule as schedule_router
from app.api.v1 import school as school_router
from app.api.v1 import surveys as surveys_router
from app.api.v1 import tests as tests_router
from app.api.v1 import wellbeing as wellbeing_router
from app.core.config import settings
from app.core.db import SessionDep, engine
from app.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from app.core.middleware import (
    BodySizeLimitMiddleware,
    RateLimitMiddleware,
    RealClientIPMiddleware,
    SecurityHeadersMiddleware,
)
from app.schemas.common import HealthOut, ReadinessOut


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Ilova toʻxtaganda ulanish puli toza yopiladi.

    Bu muhim: systemd `restart` qilganda ochiq qolgan ulanishlar Postgres
    tomonida bir necha daqiqa osilib turadi va `max_connections` ni yeydi.
    """
    yield
    await engine.dispose()


def operation_id(route: APIRoute) -> str:
    """OpenAPI operationId — `director_overview` koʻrinishida.

    FastAPI standart holda `overview_api_v1_director_overview_get` kabi
    nom yasaydi va generatsiya qilingan TS funksiyasi
    `overviewApiV1DirectorOverviewGet` boʻlib chiqadi — oʻqib boʻlmaydi.
    Teg + funksiya nomi yetarli va barqaror.
    """
    tag = route.tags[0] if route.tags else "app"
    return f"{tag}_{route.name}"


app = FastAPI(
    title="Tarbion API",
    description="Tarbion maktab boshqaruv platformasi",
    version="0.1.0",
    lifespan=lifespan,
    # Ishlab chiqarishda interaktiv hujjat yopiladi: API tuzilishini
    # ochiq koʻrsatish hujum yuzasini kengaytiradi.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
    generate_unique_id_function=operation_id,
)

# Middleware TARTIBI teskari ishlaydi: oxirgi qoʻshilgani soʻrovni
# birinchi koʻradi. Shuning uchun eng tashqi qatlam — haqiqiy IP ni
# aniqlash, chunki qolgan hamma qatlam (bloklash, audit) unga tayanadi.
#
# Cookie bilan ishlaymiz (X-4), shuning uchun `allow_credentials=True` va
# manzillar aniq roʻyxat — "*" bilan birga ishlamaydi va xavfli ham.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    max_age=600,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(RealClientIPMiddleware)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

# Router'lar. Prefiks bitta joyda — versiya oshganda shu yer oʻzgaradi.
API_V1 = "/api/v1"
app.include_router(auth_router.router, prefix=API_V1)
app.include_router(access_router.router, prefix=API_V1)
app.include_router(announcements_router.router, prefix="/api/v1")
app.include_router(wellbeing_router.router, prefix="/api/v1")
app.include_router(documents_router.router, prefix="/api/v1")
app.include_router(surveys_router.router, prefix="/api/v1")
app.include_router(hr_router.router, prefix="/api/v1")
app.include_router(academic_router.router, prefix=API_V1)
app.include_router(director_router.router, prefix=API_V1)
app.include_router(appeals_router.router, prefix=API_V1)
app.include_router(attendance_router.router, prefix=API_V1)
app.include_router(audit_router.router, prefix=API_V1)
app.include_router(parent_router.router, prefix=API_V1)
app.include_router(journal_router.router, prefix=API_V1)
app.include_router(school_router.router, prefix=API_V1)
app.include_router(schedule_router.router, prefix=API_V1)
app.include_router(notifications_router.router, prefix=API_V1)
app.include_router(tests_router.router, prefix=API_V1)


@app.get("/health", response_model=HealthOut, tags=["service"])
async def health() -> HealthOut:
    """Ilova tirikmi (liveness).

    Ataylab bazaga tegmaydi: baza yiqilganda ham ilovaning oʻzi tirik va
    systemd uni qayta ishga tushirishi shart emas. Bazaga tegadigan
    tekshiruv — `/health/ready`.
    """
    return HealthOut(status="ok")


@app.get("/health/ready", response_model=ReadinessOut, tags=["service"])
async def readiness(response: Response, session: SessionDep) -> ReadinessOut:
    """Soʻrov qabul qilishga tayyormi (readiness).

    Bazaga haqiqiy soʻrov yuboradi. Baza yiqilgan boʻlsa `503` qaytaradi —
    Caddy/systemd shunda trafikni yubormaydi va sabab logda koʻrinadi.
    """
    try:
        await session.execute(text("select 1"))
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessOut(status="degraded", database=False)
    return ReadinessOut(status="ok", database=True)
