"""Superadmin foydalanuvchi boshqaruvi: parol oʻrnatish, arxivlash.

Eng muhim testlar — chegaralar:
  · parol/arxiv FAQAT superadmin uchun — `permissions.grant` huquqi bor
    admin ham kira olmaydi (X-2)
  · oʻzini va boshqa superadminni arxivlab boʻlmaydi
  · arxivlangan odam login qila olmaydi, sessiyalari oʻlik
  · auditda parolning OʻZI yoʻq, faqat almashtirilgan FAKTI (X-10)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models import AuditAction, AuditLog, Permission, RefreshToken, Role, RoleName, User
from app.services import permissions
from app.services.access import CurrentUser

PASSWORD = "Sinov12345!"  # noqa: S106
COOKIE = settings.refresh_cookie_name


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(
    session: AsyncSession, roles: dict[str, Role], role_names: list[str], login: str
) -> User:
    user = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinov",
        first_name=login.split(".")[-1].capitalize(),
    )
    user.roles = [roles[r] for r in role_names]
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, User]:
    roles = await _roles(session)
    return {
        "superadmin": await _user(session, roles, [RoleName.SUPERADMIN.value], "uad.superadmin"),
        "superadmin2": await _user(session, roles, [RoleName.SUPERADMIN.value], "uad.superadmin2"),
        "admin": await _user(session, roles, [RoleName.ADMIN.value], "uad.admin"),
        "teacher": await _user(session, roles, [RoleName.TEACHER.value], "uad.ustoz"),
        "parent": await _user(session, roles, [RoleName.PARENT.value], "uad.otaona"),
    }


def _cookie_qiymati(r) -> str:  # noqa: ANN001 — httpx.Response
    """`Set-Cookie` sarlavhasidan refresh qiymatini oladi.

    `r.cookies` ga tayanib boʻlmaydi: CI da cookie `Secure` bilan keladi
    va httpx uni `http://` transportda saqlamaydi (test_sessions.py ga qara).
    """
    xom = r.headers.get("set-cookie", "")
    for qism in xom.split(";"):
        nom, _, qiymat = qism.strip().partition("=")
        if nom == COOKIE:
            return qiymat
    raise AssertionError(f"{COOKIE} cookie topilmadi: {xom!r}")


async def _login(
    client: AsyncClient, login: str, password: str = PASSWORD
) -> tuple[str, str]:
    """(access_token, refresh_cookie) qaytaradi."""
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], _cookie_qiymati(r)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────── Parol oʻrnatish ───────────────────────


async def test_superadmin_parol_ornatadi_eski_sessiya_oladi(
    client: AsyncClient, world: dict
) -> None:
    """Yangi parol ishlaydi, eskisi ishlamaydi, eski refresh sessiya oʻlik."""
    # Ustoz kirib turadi — sessiya bekor qilinishini tekshiramiz.
    _, eski_refresh = await _login(client, "uad.ustoz")

    sa_token, _ = await _login(client, "uad.superadmin")
    r = await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/password",
        headers=_auth(sa_token),
        json={"new_password": "YangiParol9x"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["login"] == "uad.ustoz"
    assert body["new_password"] == "YangiParol9x"

    # Eski parol endi ishlamaydi.
    eski = await client.post(
        "/api/v1/auth/login", json={"login": "uad.ustoz", "password": PASSWORD}
    )
    assert eski.status_code == 401

    # Eski refresh sessiya oʻlik.
    client.cookies.set(COOKIE, eski_refresh)
    yangilash = await client.post("/api/v1/auth/refresh")
    assert yangilash.status_code == 401
    client.cookies.delete(COOKIE)

    # Yangi parol bilan kiradi.
    yangi = await client.post(
        "/api/v1/auth/login", json={"login": "uad.ustoz", "password": "YangiParol9x"}
    )
    assert yangi.status_code == 200, yangi.text


async def test_generatsiya_rejimi_parol_bilan_kiriladi(
    client: AsyncClient, world: dict
) -> None:
    """`new_password` berilmasa server oʻzi 10 belgili parol yasaydi."""
    sa_token, _ = await _login(client, "uad.superadmin")
    r = await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/password",
        headers=_auth(sa_token),
        json={},
    )
    assert r.status_code == 200, r.text
    parol = r.json()["new_password"]

    assert len(parol) == 10
    assert parol.startswith("tarb-")
    # Oʻxshash belgilar (0/O, 1/l/i) boʻlmasligi kerak.
    assert not set(parol) & set("0O1lIi")

    kirish = await client.post(
        "/api/v1/auth/login", json={"login": "uad.ustoz", "password": parol}
    )
    assert kirish.status_code == 200, kirish.text


async def test_qisqa_parol_rad_etiladi(client: AsyncClient, world: dict) -> None:
    sa_token, _ = await _login(client, "uad.superadmin")
    r = await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/password",
        headers=_auth(sa_token),
        json={"new_password": "qisqa"},
    )
    assert r.status_code == 422


async def test_parolni_faqat_superadmin_ornatadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """X-2: admin (hatto `permissions.grant` bilan), ustoz, ota-ona — 403.

    `permissions.grant` huquq markazining boshqa amallariga yoʻl ochadi,
    lekin parol KUCHLIROQ amal — huquq orqali berilmaydi.
    """
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=Permission.PERMISSIONS_GRANT,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    yol = f"/api/v1/access/users/{world['teacher'].id}/password"
    for login in ("uad.admin", "uad.ustoz", "uad.otaona"):
        token, _ = await _login(client, login)
        r = await client.post(yol, headers=_auth(token), json={})
        assert r.status_code == 403, f"{login}: {r.status_code} {r.text}"


# ─────────────────────── Arxivlash chegaralari ───────────────────────


async def test_ozini_arxivlab_bolmaydi(client: AsyncClient, world: dict) -> None:
    sa_token, _ = await _login(client, "uad.superadmin")
    r = await client.post(
        f"/api/v1/access/users/{world['superadmin'].id}/archive", headers=_auth(sa_token)
    )
    assert r.status_code == 409, r.text


async def test_boshqa_superadminni_arxivlab_bolmaydi(
    client: AsyncClient, world: dict
) -> None:
    sa_token, _ = await _login(client, "uad.superadmin")
    r = await client.post(
        f"/api/v1/access/users/{world['superadmin2'].id}/archive", headers=_auth(sa_token)
    )
    assert r.status_code == 409, r.text


async def test_arxivni_faqat_superadmin_boshqaradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """X-2: `permissions.grant` huquqi bor admin ham arxivlay olmaydi."""
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=Permission.PERMISSIONS_GRANT,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    token, _ = await _login(client, "uad.admin")
    for amal in ("archive", "unarchive"):
        r = await client.post(
            f"/api/v1/access/users/{world['teacher'].id}/{amal}", headers=_auth(token)
        )
        assert r.status_code == 403, f"{amal}: {r.status_code} {r.text}"


# ─────────────────────── Arxiv va login oqimi ───────────────────────


async def test_arxivlangan_kira_olmaydi_unarchive_dan_keyin_kiradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    _, eski_refresh = await _login(client, "uad.ustoz")

    sa_token, _ = await _login(client, "uad.superadmin")
    r = await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/archive", headers=_auth(sa_token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_archived"] is True

    # Arxivlangan odam kira olmaydi — umumiy 403 (X-3 ruhida).
    kirish = await client.post(
        "/api/v1/auth/login", json={"login": "uad.ustoz", "password": PASSWORD}
    )
    assert kirish.status_code == 403

    # Faol sessiyalari ham bekor qilingan.
    client.cookies.set(COOKIE, eski_refresh)
    yangilash = await client.post("/api/v1/auth/refresh")
    assert yangilash.status_code in (401, 403)
    client.cookies.delete(COOKIE)

    faol = await session.scalar(
        select(RefreshToken).where(
            RefreshToken.user_id == world["teacher"].id, RefreshToken.revoked_at.is_(None)
        )
    )
    assert faol is None

    # Arxivdan chiqarilgach eski paroli bilan yana kiradi.
    r = await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/unarchive", headers=_auth(sa_token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_archived"] is False

    qayta = await client.post(
        "/api/v1/auth/login", json={"login": "uad.ustoz", "password": PASSWORD}
    )
    assert qayta.status_code == 200, qayta.text


async def test_arxivlangan_royxatda_korinadi(client: AsyncClient, world: dict) -> None:
    """Filtr frontendda — roʻyxat arxivlanganni ham qaytaradi, bayroq bilan."""
    sa_token, _ = await _login(client, "uad.superadmin")
    await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/archive", headers=_auth(sa_token)
    )

    r = await client.get("/api/v1/access/users", headers=_auth(sa_token))
    assert r.status_code == 200
    qator = next(u for u in r.json() if u["login"] == "uad.ustoz")
    assert qator["is_archived"] is True
    assert qator["roles"] == [RoleName.TEACHER.value]
    assert qator["full_name"].startswith("Sinov")


# ─────────────────────── Audit (X-10) ───────────────────────


async def test_parol_almashtirish_auditda_parolsiz(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Auditga faqat FAKT tushadi — parolning oʻzi hech qayerda yoʻq."""
    sa_token, _ = await _login(client, "uad.superadmin")
    r = await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/password",
        headers=_auth(sa_token),
        json={},
    )
    parol = r.json()["new_password"]

    yozuv = await session.scalar(
        select(AuditLog)
        .where(
            AuditLog.object_type == "user",
            AuditLog.object_id == world["teacher"].id,
            AuditLog.action == AuditAction.UPDATE,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    assert yozuv is not None
    assert yozuv.actor_id == world["superadmin"].id
    assert yozuv.new_value == {"password_set_by_superadmin": True}
    assert parol not in str(yozuv.new_value)
    assert yozuv.old_value is None


async def test_arxivlash_auditga_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    sa_token, _ = await _login(client, "uad.superadmin")
    await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/archive", headers=_auth(sa_token)
    )
    await client.post(
        f"/api/v1/access/users/{world['teacher'].id}/unarchive", headers=_auth(sa_token)
    )

    yozuvlar = (
        await session.execute(
            select(AuditLog)
            .where(
                AuditLog.object_type == "user",
                AuditLog.object_id == world["teacher"].id,
                AuditLog.action.in_([AuditAction.ARCHIVE, AuditAction.UNARCHIVE]),
            )
            .order_by(AuditLog.created_at)
        )
    ).scalars().all()

    amallar = [y.action for y in yozuvlar]
    assert AuditAction.ARCHIVE in amallar
    assert AuditAction.UNARCHIVE in amallar
    assert all(y.actor_id == world["superadmin"].id for y in yozuvlar)
