"""Alembic muhiti (T-002).

Ikki narsa muhim:

1. Ulanish manzili shu yerda YOZILMAYDI — `app.core.config` dan olinadi,
   u esa `.env` dan o'qiydi. `alembic.ini` git'da, `.env` esa yo'q
   (CLAUDE.md: sekret kodga yozilmaydi).

2. `app.models` to'liq import qilinadi — aks holda `Base.metadata` bo'sh
   bo'ladi va autogenerate "hamma jadvalni o'chirish" degan migratsiya
   yozib qo'yadi.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.config import settings

# Har bir model ro'yxatdan o'tishi uchun — `app.models.__init__` hammasini
# import qiladi. Bu qatorni olib tashlamang.
from app.models import Base  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# URL tashqaridan berilgan bo'lsa (testlar test bazasini shunday uzatadi)
# uni buzmaymiz. Aks holda .env dagi ishchi baza olinadi.
if not config.get_main_option("sqlalchemy.url", ""):
    config.set_main_option("sqlalchemy.url", str(settings.database_url))

target_metadata = Base.metadata


def _configure(connection: Connection | None = None, **kw: object) -> None:
    """Autogenerate uchun umumiy sozlama.

    `compare_type` va `compare_server_default` yoqilgan: aks holda ustun
    tipi yoki server default o'zgarganda Alembic buni sezmaydi va
    migratsiya jimgina bo'sh chiqadi.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        # Naming convention `models/base.py` da — diff har safar bir xil
        # nom bersin, shovqin bo'lmasin.
        render_as_batch=False,
        **kw,  # type: ignore[arg-type]
    )


def run_migrations_offline() -> None:
    """SQL matnini chiqarish (`alembic upgrade head --sql`)."""
    _configure(
        url=str(settings.database_url),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    _configure(connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
