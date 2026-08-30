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
from collections.abc import AsyncGenerator
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

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
