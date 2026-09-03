"""Yetkazilmagan xabarlar jurnali (BOT-06).

TZ: «Yetkazilmagan xabarlar jurnalga yoziladi va qayta yuborish
imkoniyati beriladi.»

Eng muhim salbiy test — PAROL TIKLASH KODI koʻrsatilmasligi. Navbatda
bir martalik kodlar ham turadi; jurnal yetkazish muammosini koʻrish
uchun, xabar mazmunini oʻqish uchun emas. Kodni koʻrsatish uni
oʻgʻirlashga yoʻl ochardi (X-10).
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    NotificationOutbox,
    OutboxStatus,
    Permission,
    Role,
    RoleName,
    User,
    UserPermission,
)
from app.services import outbox_service

PASSWORD = "Sinov12345!"  # noqa: S106


async def _user(session, roles, names, login, **kw):  # noqa: ANN001, ANN003, ANN202
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinovov",
        first_name="Sinov",
        **kw,
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


def _xabar(  # noqa: ANN202
    user_id,  # noqa: ANN001
    kind="attendance_absent",  # noqa: ANN001
    status=OutboxStatus.FAILED,  # noqa: ANN001
    body="Matn",  # noqa: ANN001
    **kw,  # noqa: ANN003
):
    return NotificationOutbox(
        user_id=user_id,
        kind=kind,
        channel="telegram",
        title="Sarlavha",
        body=body,
        status=status.value,
        attempts=3,
        last_error="403: bot bloklangan",
        send_after=utcnow(),
        **kw,
    )


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    admin = await _user(session, roles, [RoleName.ADMIN.value], "ob.admin")
    session.add(
        UserPermission(user_id=admin.id, permission=Permission.ANNOUNCEMENTS_PUBLISH.value)
    )
    ota = await _user(session, roles, [RoleName.PARENT.value], "ob.ota", telegram_id=800001)
    await _user(session, roles, [RoleName.TEACHER.value], "ob.ustoz")

    session.add_all(
        [
            _xabar(ota.id),
            _xabar(ota.id, status=OutboxStatus.SENT, sent_at=utcnow()),
            _xabar(ota.id, kind="password_reset", body="Tasdiqlash kodi: 123456"),
        ]
    )
    await session.commit()
    return {"admin": admin, "ota": ota}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


# ─────────────────────── Kirish ───────────────────────


async def test_huquqsiz_jurnalni_kormaydi(client: AsyncClient, world: dict) -> None:
    """X-2: `announcements.publish` yoʻq — 403."""
    token = await _token(client, "ob.ustoz")
    r = await client.get("/api/v1/notifications/outbox", headers=_auth(token))
    assert r.status_code == 403, r.text


async def test_kirmagan_odam_kormaydi(client: AsyncClient, world: dict) -> None:
    r = await client.get("/api/v1/notifications/outbox")
    assert r.status_code == 401, r.text


# ─────────────────────── Roʻyxat ───────────────────────


async def test_sukut_boyicha_faqat_yiqilganlar(client: AsyncClient, world: dict) -> None:
    """Ekranning maqsadi — muammoni koʻrsatish."""
    token = await _token(client, "ob.admin")
    r = await client.get("/api/v1/notifications/outbox", headers=_auth(token))
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 2
    assert {x["status"] for x in rows} == {"failed"}


async def test_xato_matni_korinadi(client: AsyncClient, world: dict) -> None:
    """Administrator NEGA yiqilganini bilishi kerak."""
    token = await _token(client, "ob.admin")
    r = await client.get("/api/v1/notifications/outbox", headers=_auth(token))
    assert all("bloklangan" in x["last_error"] for x in r.json())


async def test_parol_kodi_KORSATILMAYDI(client: AsyncClient, world: dict) -> None:
    """X-10. Jurnalda bir martalik kod turishi mumkin emas."""
    token = await _token(client, "ob.admin")
    r = await client.get("/api/v1/notifications/outbox", headers=_auth(token))
    kodli = [x for x in r.json() if x["kind"] == "password_reset"]
    assert len(kodli) == 1
    assert "123456" not in kodli[0]["body"]
    assert kodli[0]["body"] == outbox_service.MASKA


async def test_holat_boyicha_filtr(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ob.admin")
    r = await client.get("/api/v1/notifications/outbox?status=sent", headers=_auth(token))
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["status"] == "sent"


async def test_sanoq(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ob.admin")
    r = await client.get("/api/v1/notifications/outbox/counts", headers=_auth(token))
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["failed"] == 2
    assert c["sent"] == 1


# ─────────────────────── Qayta yuborish ───────────────────────


async def test_qayta_yuborish_navbatga_qaytaradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "ob.admin")
    auth = _auth(token)
    rows = (await client.get("/api/v1/notifications/outbox", headers=auth)).json()

    r = await client.post(
        f"/api/v1/notifications/outbox/{rows[0]['id']}/retry", headers=auth
    )
    assert r.status_code == 200, r.text
    assert r.json()["retried"] == 1

    qator = await session.get(NotificationOutbox, rows[0]["id"])
    await session.refresh(qator)
    assert qator.status == OutboxStatus.PENDING.value
    # Sanoq nolga qaytadi — bu yangi qaror, avtomatik urinish davomi emas.
    assert qator.attempts == 0
    assert qator.last_error is None


async def test_yuborilganni_qayta_yuborib_bolmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """U allaqachon ketgan — «qayta yuborish» maʼnosiz."""
    token = await _token(client, "ob.admin")
    auth = _auth(token)
    yuborilgan = await session.scalar(
        select(NotificationOutbox).where(
            NotificationOutbox.status == OutboxStatus.SENT.value
        )
    )
    r = await client.post(
        f"/api/v1/notifications/outbox/{yuborilgan.id}/retry", headers=auth
    )
    assert r.status_code == 200
    assert r.json()["retried"] == 0


async def test_hammasini_qayta_yuborish(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Telegram bir necha soat tushib qolsa oʻnlab xabar yiqiladi."""
    token = await _token(client, "ob.admin")
    r = await client.post(
        "/api/v1/notifications/outbox/retry-failed", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["retried"] == 2

    qolgan = await session.execute(
        select(NotificationOutbox).where(
            NotificationOutbox.status == OutboxStatus.FAILED.value
        )
    )
    assert list(qolgan.scalars()) == []


async def test_huquqsiz_qayta_yuborolmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """X-2."""
    token = await _token(client, "ob.ustoz")
    xabar = await session.scalar(select(NotificationOutbox))
    r = await client.post(
        f"/api/v1/notifications/outbox/{xabar.id}/retry", headers=_auth(token)
    )
    assert r.status_code == 403, r.text
