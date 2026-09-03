"""Faol qurilmalar: roʻyxat, bekor qilish, «eslab qolish» (T-004).

Loyiha egasining soʻrovi (2026-08-29): maktab va umumiy
kompyuterlarda hisob ochiq qolib ketmasin.

Eng muhim testlar:
  · begona `family_id` bilan boshqa odamni chiqarib boʻlmaydi (X-1)
  · begona id ga `404` emas, `revoked: 0` — mavjudligi oshkor
    boʻlmasin (X-3)
  · «hammasidan chiqish» JORIY qurilmani qoldiradi
  · «eslab qolmang» tanlovi yangilashdan keyin ham saqlanadi —
    aks holda vaqtinchalik sessiya jimgina doimiyga aylanardi
"""

import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models import RefreshToken, Role, RoleName, User
from app.services import auth_service

PASSWORD = "Sinov12345!"  # noqa: S106
COOKIE = settings.refresh_cookie_name


async def _user(session: AsyncSession, login: str) -> User:
    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinovov",
        first_name="Sinov",
    )
    u.roles = [roles[RoleName.TEACHER.value]]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    a = await _user(session, "ses.alisher")
    b = await _user(session, "ses.bobur")
    await session.commit()
    return {"a": a, "b": b}


async def _login(
    client: AsyncClient, login: str, *, remember: bool = True, agent: str = "Sinov/1.0"
) -> tuple[str, str]:
    """(access_token, refresh_cookie) qaytaradi."""
    r = await client.post(
        "/api/v1/auth/login",
        json={"login": login, "password": PASSWORD, "remember": remember},
        headers={"User-Agent": agent},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.cookies[COOKIE]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────── Roʻyxat ───────────────────────


async def test_kirmagan_odam_kormaydi(client: AsyncClient, world: dict) -> None:
    r = await client.get("/api/v1/auth/sessions")
    assert r.status_code == 401, r.text


async def test_oz_sessiyasini_koradi(client: AsyncClient, world: dict) -> None:
    token, _ = await _login(client, "ses.alisher")
    r = await client.get("/api/v1/auth/sessions", headers=_auth(token))
    assert r.status_code == 200, r.text
    qatorlar = r.json()
    assert len(qatorlar) == 1
    assert qatorlar[0]["current"] is True
    assert qatorlar[0]["user_agent"] == "Sinov/1.0"
    # Token yoki uning xeshi javobda BOʻLMASLIGI kerak.
    assert "token" not in r.text.lower()


async def test_boshqa_odamning_sessiyasi_korinmaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-1: roʻyxat faqat oʻz `user_id` si boʻyicha."""
    await _login(client, "ses.bobur", agent="Bobur/1.0")
    client.cookies.clear()
    token, _ = await _login(client, "ses.alisher", agent="Alisher/1.0")

    r = await client.get("/api/v1/auth/sessions", headers=_auth(token))
    agentlar = {x["user_agent"] for x in r.json()}
    assert agentlar == {"Alisher/1.0"}


async def test_yangilash_royxatni_kopaytirmaydi(client: AsyncClient, world: dict) -> None:
    """Bitta qurilma = bitta qator, aylantirish qancha boʻlsa ham.

    Aks holda bitta telefon roʻyxatda oʻnlab qator boʻlib chiqardi.
    """
    token, _ = await _login(client, "ses.alisher")
    for _ in range(3):
        r = await client.post("/api/v1/auth/refresh")
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]

    r = await client.get("/api/v1/auth/sessions", headers=_auth(token))
    assert len(r.json()) == 1


# ─────────────────────── Bekor qilish ───────────────────────


async def test_bitta_qurilmani_chiqaradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _login(client, "ses.alisher", agent="Eski/1.0")
    client.cookies.clear()
    token, _ = await _login(client, "ses.alisher", agent="Yangi/1.0")

    qatorlar = (await client.get("/api/v1/auth/sessions", headers=_auth(token))).json()
    eski = next(x for x in qatorlar if not x["current"])

    r = await client.delete(
        f"/api/v1/auth/sessions/{eski['family_id']}", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["revoked"] == 1

    qolgan = (await client.get("/api/v1/auth/sessions", headers=_auth(token))).json()
    assert len(qolgan) == 1
    assert qolgan[0]["current"] is True


async def test_begona_family_id_ga_nol_qaytadi(client: AsyncClient, world: dict) -> None:
    """X-1 va X-3: boshqa odamnikini chiqarib boʻlmaydi, 404 ham berilmaydi."""
    b_token, _ = await _login(client, "ses.bobur")
    b_qator = (await client.get("/api/v1/auth/sessions", headers=_auth(b_token))).json()
    b_family = b_qator[0]["family_id"]

    client.cookies.clear()
    a_token, _ = await _login(client, "ses.alisher")

    r = await client.delete(f"/api/v1/auth/sessions/{b_family}", headers=_auth(a_token))
    assert r.status_code == 200, r.text
    assert r.json()["revoked"] == 0

    # Bobur hali ham ichkarida.
    hali = await client.get("/api/v1/auth/sessions", headers=_auth(b_token))
    assert len(hali.json()) == 1


async def test_hammasidan_chiqish_joriyni_qoldiradi(
    client: AsyncClient, world: dict
) -> None:
    """Joriy sessiya ataylab qoladi — odam parolini almashtirishga ulgursin."""
    await _login(client, "ses.alisher", agent="Telefon/1.0")
    client.cookies.clear()
    await _login(client, "ses.alisher", agent="Planshet/1.0")
    client.cookies.clear()
    token, _ = await _login(client, "ses.alisher", agent="Joriy/1.0")

    r = await client.delete("/api/v1/auth/sessions", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["revoked"] == 2

    qolgan = (await client.get("/api/v1/auth/sessions", headers=_auth(token))).json()
    assert len(qolgan) == 1
    assert qolgan[0]["user_agent"] == "Joriy/1.0"


async def test_chiqarilgan_qurilma_yangilay_olmaydi(
    client: AsyncClient, world: dict
) -> None:
    """Bekor qilish HAQIQIY: eski cookie bilan token yangilanmaydi."""
    _, eski_cookie = await _login(client, "ses.alisher", agent="Eski/1.0")
    client.cookies.clear()
    token, _ = await _login(client, "ses.alisher", agent="Yangi/1.0")

    qatorlar = (await client.get("/api/v1/auth/sessions", headers=_auth(token))).json()
    eski = next(x for x in qatorlar if not x["current"])
    await client.delete(f"/api/v1/auth/sessions/{eski['family_id']}", headers=_auth(token))

    client.cookies.clear()
    client.cookies.set(COOKIE, eski_cookie)
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 401, r.text


# ─────────────────── «Eslab qolish» (AUT-09 kengaytmasi) ───────────────────


async def test_eslab_qolinmasa_sessiya_cookie(client: AsyncClient, world: dict) -> None:
    """Brauzer yopilsa yoʻqolishi uchun `Max-Age` boʻlmasligi kerak."""
    r = await client.post(
        "/api/v1/auth/login",
        json={"login": "ses.alisher", "password": PASSWORD, "remember": False},
    )
    assert r.status_code == 200, r.text
    xom = r.headers["set-cookie"]
    assert "Max-Age" not in xom and "Expires" not in xom, xom


async def test_eslab_qolinsa_max_age_bor(client: AsyncClient, world: dict) -> None:
    r = await client.post(
        "/api/v1/auth/login",
        json={"login": "ses.alisher", "password": PASSWORD, "remember": True},
    )
    assert "Max-Age" in r.headers["set-cookie"]


async def test_eslab_qolinmagan_sessiya_qisqa(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _login(client, "ses.alisher", remember=False)
    qator = await session.scalar(
        select(RefreshToken).where(RefreshToken.user_id == world["a"].id)
    )
    assert qator is not None
    assert qator.remember is False
    umr = qator.expires_at - qator.issued_at
    assert umr == auth_service.VAQTINCHALIK_TTL
    assert umr.days < settings.refresh_token_ttl_days


async def test_yangilash_vaqtinchalikni_doimiyga_aylantirmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Eng nozik joyi: `rotate_refresh` `remember` ni uzatmasa, sessiya
    birinchi yangilanishdayoq 30 kunlik boʻlib qolardi."""
    await _login(client, "ses.alisher", remember=False)

    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 200, r.text
    assert "Max-Age" not in r.headers["set-cookie"]

    yangi = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.user_id == world["a"].id, RefreshToken.revoked_at.is_(None))
        .order_by(RefreshToken.issued_at.desc())
    )
    assert yangi is not None
    assert yangi.remember is False
    assert yangi.expires_at - yangi.issued_at == auth_service.VAQTINCHALIK_TTL


async def test_royxatda_eslab_qolish_korinadi(client: AsyncClient, world: dict) -> None:
    token, _ = await _login(client, "ses.alisher", remember=False)
    qatorlar = (await client.get("/api/v1/auth/sessions", headers=_auth(token))).json()
    assert qatorlar[0]["remember"] is False


# ─────────────────── Access token muddati (AUT-01) ───────────────────


async def test_muddati_otgan_access_token_401(client: AsyncClient, world: dict) -> None:
    """Muddati oʻtgan token bilan API yopiq boʻlishi kerak.

    Bu tekshiruv boʻlmasa, `exp` ni umuman oʻqimaydigan regressiya
    sezilmay oʻtib ketardi: oddiy testlar yangi token bilan ishlaydi
    va hech qachon muddati oʻtganini sinamaydi.
    """
    import jwt

    from app.core.timeutil import utcnow

    otgan = utcnow() - timedelta(minutes=1)
    token = jwt.encode(
        {
            "sub": str(world["a"].id),
            "typ": "access",
            "jti": str(uuid.uuid4()),
            "iat": int((otgan - timedelta(minutes=20)).timestamp()),
            "exp": int(otgan.timestamp()),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    r = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert r.status_code == 401, r.text


async def test_refresh_yangi_access_beradi(client: AsyncClient, world: dict) -> None:
    """Muddati oʻtganda mijoz `/refresh` bilan davom eta oladi."""
    eski_token, _ = await _login(client, "ses.alisher")

    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 200, r.text
    yangi = r.json()["access_token"]
    assert yangi != eski_token

    ok = await client.get("/api/v1/auth/me", headers=_auth(yangi))
    assert ok.status_code == 200, ok.text
