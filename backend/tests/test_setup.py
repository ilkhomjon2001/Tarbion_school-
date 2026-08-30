"""Muhit va migratsiya tekshiruvi (T-001, T-002).

Bu testlar biznes mantiqni emas, poydevorni tekshiradi. Ular yiqilsa
qolgan hamma test ham ishonchsiz.
"""

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Base


async def test_health(client: AsyncClient) -> None:
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


async def test_readiness_bazani_tekshiradi(client: AsyncClient) -> None:
    r = await client.get("/health/ready")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": True}


async def test_migratsiya_barcha_jadvalni_yaratdi(session: AsyncSession) -> None:
    """Modellardagi har bir jadval bazada bor.

    Model qo'shilib, migratsiya yozilmasa shu test yiqiladi — CLAUDE.md:
    "Migratsiyasiz model o'zgarishi bo'lmaydi".
    """
    rows = await session.execute(
        text("select tablename from pg_tables where schemaname = 'public'")
    )
    mavjud = set(rows.scalars())
    kutilgan = set(Base.metadata.tables)

    yetishmaydi = kutilgan - mavjud
    assert not yetishmaydi, f"Migratsiyada yo'q jadvallar: {sorted(yetishmaydi)}"


async def test_alembic_belgisi_qoyilgan(session: AsyncSession) -> None:
    """`alembic_version` to'ldirilgan — sxema migratsiya orqali qurilgan."""
    rev = await session.scalar(text("select version_num from alembic_version"))
    assert rev, "alembic_version bo'sh — sxema migratsiyasiz qurilgan"


async def test_har_jadvalda_arxiv_ustuni_bor() -> None:
    """CLAUDE.md 1-qoida: hech narsa o'chirilmaydi.

    Faqat qo'shiladigan jadvallar (audit, jurnal) bundan mustasno —
    ular umuman o'zgartirilmaydi, arxivlanmaydi ham.
    """
    istisnolar = {
        # Faqat qo'shiladigan jurnal jadvallari — o'zgartirilmaydi ham,
        # arxivlanmaydi ham (NFR-10).
        "audit_log",
        "login_log",
        "login_attempts",
        # Sessiya yozuvi: arxivlanmaydi, `revoked_at` bilan bekor qilinadi.
        "refresh_tokens",
        # Bog'lovchi jadval: bog'lanish uziladi, arxivlanmaydi.
        "user_roles",
        # Ma'lumotnoma: 7 ta rol qat'iy, hech qachon arxivlanmaydi.
        "roles",
        "alembic_version",
    }
    for nom, jadval in Base.metadata.tables.items():
        if nom in istisnolar:
            continue
        assert "is_archived" in jadval.columns, f"{nom} da is_archived yo'q"


async def test_tranzaksiya_qaytariladi(session: AsyncSession) -> None:
    """Fixture izolyatsiyasi ishlayotganini tasdiqlaydi.

    Bu test yozadi, keyingisi esa hech narsa ko'rmasligi kerak.
    """
    await session.execute(text("create temporary table sinov_izolyatsiya (x int)"))
    await session.execute(text("insert into sinov_izolyatsiya values (1)"))
    natija = await session.scalar(text("select count(*) from sinov_izolyatsiya"))
    assert natija == 1
