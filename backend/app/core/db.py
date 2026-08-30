"""Async SQLAlchemy engine va sessiya."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    str(settings.database_url),
    echo=settings.db_echo,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_recycle=settings.db_pool_recycle,
    # Ulanish uzilib qolgan bo'lsa so'rovdan oldin aniqlanadi — VPS qayta
    # ishga tushganda birinchi so'rov 500 bermasligi uchun.
    pool_pre_ping=True,
    # asyncpg statement cache PgBouncer (transaction mode) bilan mos kelmaydi.
    # Hozir PgBouncer yo'q, lekin qo'shilganda shu yer o'zgaradi.
    connect_args={"server_settings": {"jit": "off"}},
)

SessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: so'rov davomida bitta sessiya.

    Commit servis qatlamida qilinadi — router tranzaksiyani boshqarmaydi.
    Xato chiqsa rollback qilinadi va ulanish poolga sog' holatda qaytadi.
    """
    async with SessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# Har bir endpointda yozish o'rniga shu alias ishlatiladi:
#     async def endpoint(session: SessionDep) -> ...
# `Annotated` shakli majburiy: `Depends()` ni argument sukutida yozish
# ruff B008 ni uyg'otadi va FastAPI hujjatida ham eskirgan uslub.
SessionDep = Annotated[AsyncSession, Depends(get_session)]
