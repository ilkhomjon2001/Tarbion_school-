"""Telegram hisobini bogʻlash (T-017, BOT-01).

TZ: «Vasiy telefon raqami va bir martalik kod orqali botga ulanadi.»

Bu yerda bogʻlanish MANTIQI tekshiriladi, aiogram qobigʻi emas: botni
sinash uchun Telegram serveri kerak boʻlardi, mantiq esa butunlay
servisda (X-8) va aynan shu joyda xato qilish qimmat — notoʻgʻri
bogʻlangan hisob boshqa oilaning davomat va baho xabarlarini olardi.
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    NotificationOutbox,
    OutboxStatus,
    Role,
    RoleName,
    TelegramLinkCode,
    User,
)
from app.services import telegram_link_service as tls

PASSWORD = "Sinov12345!"  # noqa: S106
TELEFON = "+998901112233"
TG = 700100


async def _user(session: AsyncSession, login: str, **kw) -> User:  # noqa: ANN003
    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Otayev",
        first_name="Vali",
        **kw,
    )
    u.roles = [roles[RoleName.PARENT.value]]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def ota(session: AsyncSession) -> User:
    u = await _user(session, "tg.ota", phone=TELEFON)
    await session.commit()
    return u


# ─────────────────────── Kod berish ───────────────────────


async def test_kod_beriladi_va_xeshlanadi(session: AsyncSession, ota: User) -> None:
    kod = await tls.issue_code(session, ota.id)
    assert len(kod) == tls.CODE_DIGITS
    assert kod.isdigit()

    row = await session.scalar(select(TelegramLinkCode))
    assert row is not None
    # Kod XOM saqlanmaydi (X-10).
    assert row.code_hash != kod


async def test_yangi_kod_eskisini_kuydiradi(session: AsyncSession, ota: User) -> None:
    """Odam kodni birovga koʻrsatib, keyin yangisini olsa eskisi oʻlsin."""
    eski = await tls.issue_code(session, ota.id)
    await tls.issue_code(session, ota.id)

    with pytest.raises(tls.LinkError):
        await tls.link(session, phone=TELEFON, code=eski, telegram_id=TG)


# ─────────────────────── Bogʻlash ───────────────────────


async def test_telefon_va_kod_bilan_boglanadi(session: AsyncSession, ota: User) -> None:
    kod = await tls.issue_code(session, ota.id)
    user = await tls.link(session, phone=TELEFON, code=kod, telegram_id=TG)
    assert user.id == ota.id
    assert user.telegram_id == TG


async def test_raqam_formati_ahamiyatsiz(session: AsyncSession, ota: User) -> None:
    """Odam «90 111 22 33» deb yozadi, bazada `+998901112233`."""
    kod = await tls.issue_code(session, ota.id)
    user = await tls.link(session, phone="90 111 22 33", code=kod, telegram_id=TG)
    assert user.telegram_id == TG


async def test_notanish_raqam_rad_etiladi(session: AsyncSession, ota: User) -> None:
    kod = await tls.issue_code(session, ota.id)
    with pytest.raises(tls.LinkError, match="topilmadi"):
        await tls.link(session, phone="+998900000000", code=kod, telegram_id=TG)


async def test_notogri_kod_rad_etiladi(session: AsyncSession, ota: User) -> None:
    await tls.issue_code(session, ota.id)
    with pytest.raises(tls.LinkError):
        await tls.link(session, phone=TELEFON, code="000000", telegram_id=TG)


async def test_kod_bir_marta_ishlaydi(session: AsyncSession, ota: User) -> None:
    kod = await tls.issue_code(session, ota.id)
    await tls.link(session, phone=TELEFON, code=kod, telegram_id=TG)

    # Ikkinchi Telegram hisobi oʻsha kod bilan ulana olmaydi.
    await tls.unlink(session, TG)
    with pytest.raises(tls.LinkError):
        await tls.link(session, phone=TELEFON, code=kod, telegram_id=TG + 1)


async def test_muddati_otgan_kod_ishlamaydi(session: AsyncSession, ota: User) -> None:
    kod = await tls.issue_code(session, ota.id)
    row = await session.scalar(select(TelegramLinkCode))
    row.expires_at = utcnow() - timedelta(seconds=1)
    await session.commit()

    with pytest.raises(tls.LinkError):
        await tls.link(session, phone=TELEFON, code=kod, telegram_id=TG)


async def test_kop_urinishdan_keyin_kod_kuyadi(session: AsyncSession, ota: User) -> None:
    """6 raqam — million variant, cheklovsiz topib boʻlardi."""
    kod = await tls.issue_code(session, ota.id)
    for _ in range(tls.MAX_ATTEMPTS):
        with pytest.raises(tls.LinkError):
            await tls.link(session, phone=TELEFON, code="000000", telegram_id=TG)

    with pytest.raises(tls.LinkError):
        await tls.link(session, phone=TELEFON, code=kod, telegram_id=TG)


# ─────────────────────── Bir akkaunt — bir odam ───────────────────────


async def test_bitta_telegram_ikki_odamga_boglanmaydi(
    session: AsyncSession, ota: User
) -> None:
    """BOT-01 mezoni. Aks holda bitta akkaunt ikki oilaning xabarini olardi."""
    boshqa = await _user(session, "tg.boshqa", phone="+998901112244")
    await session.commit()

    kod1 = await tls.issue_code(session, ota.id)
    await tls.link(session, phone=TELEFON, code=kod1, telegram_id=TG)

    kod2 = await tls.issue_code(session, boshqa.id)
    with pytest.raises(tls.LinkError, match="boshqa foydalanuvchiga"):
        await tls.link(session, phone="+998901112244", code=kod2, telegram_id=TG)


async def test_boglangan_hisobga_ikkinchi_telegram_ulanmaydi(
    session: AsyncSession, ota: User
) -> None:
    kod1 = await tls.issue_code(session, ota.id)
    await tls.link(session, phone=TELEFON, code=kod1, telegram_id=TG)

    kod2 = await tls.issue_code(session, ota.id)
    with pytest.raises(tls.LinkError, match="boshqa Telegram"):
        await tls.link(session, phone=TELEFON, code=kod2, telegram_id=TG + 5)


async def test_ozini_qayta_boglash_mumkin(session: AsyncSession, ota: User) -> None:
    """Bir xil Telegram bilan qayta ulanish xato emas — odam /start ni
    ikki marta bosgan boʻlishi mumkin."""
    kod1 = await tls.issue_code(session, ota.id)
    await tls.link(session, phone=TELEFON, code=kod1, telegram_id=TG)

    kod2 = await tls.issue_code(session, ota.id)
    user = await tls.link(session, phone=TELEFON, code=kod2, telegram_id=TG)
    assert user.telegram_id == TG


# ─────────────────────── Uzish ───────────────────────


async def test_uzish_boglanishni_ochiradi(session: AsyncSession, ota: User) -> None:
    kod = await tls.issue_code(session, ota.id)
    await tls.link(session, phone=TELEFON, code=kod, telegram_id=TG)

    assert await tls.unlink(session, TG) is True
    await session.refresh(ota)
    assert ota.telegram_id is None


async def test_uzilmagan_hisobni_uzish_xato_emas(session: AsyncSession) -> None:
    assert await tls.unlink(session, 999999) is False


async def test_uzishda_navbatdagi_xabarlar_bekor_qilinadi(
    session: AsyncSession, ota: User
) -> None:
    """Yuboradigan joy qolmadi — xabar uch marta urinib «yiqilgan»
    boʻlib, administrator ekranini soxta xatolar bilan toʻldirmasin."""
    kod = await tls.issue_code(session, ota.id)
    await tls.link(session, phone=TELEFON, code=kod, telegram_id=TG)

    session.add(
        NotificationOutbox(
            user_id=ota.id,
            kind="attendance_absent",
            channel="telegram",
            title="A",
            body="B",
            status=OutboxStatus.PENDING.value,
            attempts=0,
            send_after=utcnow(),
        )
    )
    await session.commit()

    await tls.unlink(session, TG)
    xabar = await session.scalar(select(NotificationOutbox))
    assert xabar.status == OutboxStatus.CANCELLED.value


# ─────────────────────── Endpoint ───────────────────────


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def test_kod_endpointi_kirmaganga_yopiq(client: AsyncClient, ota: User) -> None:
    """X-2: token yoʻq — 401. Aks holda istalgan kishi kod yasab olardi."""
    r = await client.post("/api/v1/auth/telegram/code")
    assert r.status_code == 401, r.text


async def test_kabinetdan_kod_olinadi(client: AsyncClient, ota: User) -> None:
    token = await _token(client, "tg.ota")
    auth = {"Authorization": f"Bearer {token}"}

    holat = await client.get("/api/v1/auth/telegram", headers=auth)
    assert holat.status_code == 200
    assert holat.json()["linked"] is False

    r = await client.post("/api/v1/auth/telegram/code", headers=auth)
    assert r.status_code == 200, r.text
    assert len(r.json()["code"]) == tls.CODE_DIGITS
