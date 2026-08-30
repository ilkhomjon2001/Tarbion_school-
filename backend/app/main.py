"""FastAPI ilovasi — kirish nuqtasi (T-001).

Bu yerda faqat yigʻish boʻladi: sozlama, middleware, xato handlerlari va
router'larni ulash. Biznes mantiq `services/` da, endpointlar `api/v1/` da.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import engine
from app.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from app.schemas.common import HealthOut


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Ilova toʻxtaganda ulanish puli toza yopiladi.

    Bu muhim: systemd `restart` qilganda ochiq qolgan ulanishlar Postgres
    tomonida bir necha daqiqa osilib turadi va `max_connections` ni yeydi.
    """
    yield
    await engine.dispose()


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
)

# Cookie bilan ishlaymiz (X-4), shuning uchun `allow_credentials=True` va
# manzillar aniq roʻyxat — "*" bilan birga ishlamaydi va xavfli ham.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.get("/health", response_model=HealthOut, tags=["service"])
async def health() -> HealthOut:
    """Ilova tirikmi (liveness).

    Ataylab bazaga tegmaydi: baza yiqilganda ham ilovaning oʻzi tirik va
    systemd uni qayta ishga tushirishi shart emas. Bazani tekshiradigan
    readiness endpointi T-002 da qoʻshiladi.
    """
    return HealthOut(status="ok")
