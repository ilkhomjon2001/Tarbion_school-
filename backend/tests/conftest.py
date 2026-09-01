"""Pytest fixture'lari (T-002).

Uch qoida:

1. **Testlar alohida bazada ishlaydi** (`TEST_DATABASE_URL`). Berilmasa
   testlar ishga tushmaydi — sukut bo'yicha ishchi bazaga tushib qolish
   juda qimmatga tushadi.

2. **Sxema Alembic migratsiyalari bilan quriladi**, `create_all` bilan
   emas. Sabab: shunda testlar migratsiyalarni ham tekshiradi. `create_all`
   ishlatilsa, buzilgan migratsiya bilan ham testlar yashil bo'lib turadi
   va xato faqat serverga chiqqanda ko'rinadi.

3. **Har test o'z tranzaksiyasida**, oxirida rollback. Tozalash kodi
   yozilmaydi, testlar bir-biriga ta'sir qilmaydi va tez ishlaydi.
"""

import asyncio
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path

import pytest
import pytest_asyncio
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from alembic import command
from app.core.config import settings
from app.core.db import get_session
from app.core.ratelimit import limiter
from app.main import app

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _test_url() -> str:
    if settings.test_database_url is None:
        raise RuntimeError(
            "TEST_DATABASE_URL berilmagan. backend/.env ga qo'shing — "
            "testlar ishchi bazada ISHLAMAYDI."
        )
    url = str(settings.test_database_url)
    if url == str(settings.database_url):
        raise RuntimeError(
            "TEST_DATABASE_URL va DATABASE_URL bir xil. Testlar ishchi "
            "bazadagi ma'lumotni o'chirib yuborardi."
        )
    return url


async def _reset_schema(url: str) -> None:
    """Sxemani butunlay tozalaydi — oldingi ishga tushishdan qoldiq qolmasin."""
    engine = create_async_engine(url, isolation_level="AUTOCOMMIT")
    async with engine.connect() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _prepare_database() -> None:
    """Test bazasini tozalab, migratsiyalarni yuguradi.

    Sinxron fixture: Alembic `env.py` ichida `asyncio.run` chaqiradi, u esa
    ishlab turgan hodisa siklida ishlamaydi.
    """
    url = _test_url()
    asyncio.run(_reset_schema(url))

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")


@pytest_asyncio.fixture(scope="session")
async def engine() -> AsyncGenerator[object, None]:
    eng = create_async_engine(_test_url(), poolclass=None)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:  # noqa: ANN001
    """Har test uchun sessiya. Oxirida hamma narsa qaytariladi.

    `join_transaction_mode="create_savepoint"` muhim: servis qatlami
    `commit()` chaqiradi (router tranzaksiyani boshqarmaydi), lekin tashqi
    tranzaksiya baribir rollback bo'ladi — test o'zidan keyin iz qoldirmaydi.
    """
    async with engine.connect() as conn:  # type: ignore[attr-defined]
        trans = await conn.begin()
        db = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield db
        finally:
            await db.close()
            await trans.rollback()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTP mijoz. Endpointlar testdagi sessiyani oladi.

    Shu sababli so'rov ichida yozilgan ma'lumotni test darhol o'qiy oladi,
    va test tugagach hammasi qaytariladi.
    """

    async def _override() -> AsyncGenerator[AsyncSession, None]:
        yield session

    # Rate limiter jarayon xotirasida — testlar orasida qoladi va
    # keyingi test 429 olib qolardi.
    limiter.reset()

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _two_factor_not_required(request: pytest.FixtureRequest) -> Iterator[None]:
    """Boshqa testlarda 2FA majburiyligi oʻchiriladi.

    X-14 boʻyicha administrator, direktor va super administrator 2FA
    yoqmaguncha API ga kira olmaydi. Bu toʻgʻri, lekin `test_school_api`
    yoki `test_schedule_api` da u SHOVQIN: oʻsha fayllar maʼlumotnoma
    va jadval mantiqini sinaydi, kirish oqimini emas.

    Majburiylikning oʻzi `test_twofactor.py` da toʻliq tekshiriladi —
    shu sababli u fayl bu fixture'dan chetda qoladi.

    Muhim: bu yerda 2FA XUSUSIYATI emas, faqat MAJBURIYLIGI oʻchadi.
    Yoqilgan 2FA bilan kirish oqimi hamma joyda ishlaydi.
    """
    if request.node.path.name == "test_twofactor.py":
        yield
        return

    from app.services import twofactor_service

    asl = twofactor_service.is_required
    twofactor_service.is_required = lambda _user: False  # type: ignore[assignment]
    try:
        yield
    finally:
        twofactor_service.is_required = asl  # type: ignore[assignment]


@pytest.fixture(scope="session", autouse=True)
def _tez_argon2() -> Iterator[None]:
    """Testlarda argon2 parametrlari yengillashtiriladi.

    Ishlab chiqarishda argon2 ATAYLAB sekin: 64 MiB xotira va 3
    iteratsiya bitta xeshni ~126 ms qiladi va brute-force'ni qimmat
    qiladi. Testda esa bu faqat kutish — har fixture 5 ta foydalanuvchi
    yaratadi, ya'ni 630 ms, va butun to'plamda ~4 daqiqa.

    Nima OʻZGARMAYDI: algoritm oʻsha argon2id, chaqiruv joylari,
    tekshiruv mantigʻi. Faqat narx tushadi. Parametrlarning oʻzi kod
    emas, sozlama — ular ishlab chiqarish uchun `core/security.py` da
    qat'iy yozilgan va u yerda tekshiriladi.
    """
    from argon2 import PasswordHasher

    from app.core import security

    asl_hasher = security._hasher
    asl_dummy = security._DUMMY_HASH

    security._hasher = PasswordHasher(
        time_cost=1, memory_cost=8, parallelism=1, hash_len=16
    )
    # Soxta xesh ham yangi parametrlar bilan qayta yasaladi: aks holda
    # «foydalanuvchi topilmadi» yoʻli eski, qimmat xeshni tekshirib
    # sekin qolardi.
    security._DUMMY_HASH = security._hasher.hash("sinov-uchun-soxta-qiymat")

    yield

    security._hasher = asl_hasher
    security._DUMMY_HASH = asl_dummy
