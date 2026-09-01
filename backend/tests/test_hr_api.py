"""Kadrlar — profil, oylik auditi, taʼtillar.

Muhim: modul faqat `users.manage` bilan; oylik oʻzgarishi auditda;
ota-onaga kadr profili ochilmaydi.
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import local_today
from app.models import (
    AuditLog,
    Permission,
    Role,
    RoleName,
    User,
    UserPermission,
)

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(session, roles, names, login, last):  # noqa: ANN001, ANN202
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name=last,
        first_name="Sinov",
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)
    admin = await _user(session, roles, [RoleName.ADMIN.value], "hr.admin", "Adminov")
    session.add(UserPermission(user_id=admin.id, permission=Permission.USERS_MANAGE.value))
    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "hr.ustoz", "Aliyev")
    ota = await _user(session, roles, [RoleName.PARENT.value], "hr.ota", "Otayev")
    await session.commit()
    return {"ustoz": ustoz, "ota": ota}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def test_profil_va_oylik_auditi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "hr.admin")

    r = await client.put(
        f"/api/v1/hr/employees/{world['ustoz'].id}/profile",
        headers=_auth(token),
        json={
            "position": "Matematika oʻqituvchisi",
            "contract_type": "toliq",
            "qualification": "birinchi",
            "hired_on": "2024-08-15",
            "base_salary": 6000000,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["base_salary"] == 6000000
    assert r.json()["position"] == "Matematika oʻqituvchisi"

    # Oylik oʻzgaradi — auditda eski va yangi qiymat.
    r = await client.put(
        f"/api/v1/hr/employees/{world['ustoz'].id}/profile",
        headers=_auth(token),
        json={
            "position": "Matematika oʻqituvchisi",
            "contract_type": "toliq",
            "qualification": "birinchi",
            "hired_on": "2024-08-15",
            "base_salary": 6500000,
        },
    )
    assert r.status_code == 200

    rows = (
        (
            await session.execute(
                select(AuditLog).where(AuditLog.object_type == "staff_profile")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2  # birinchi kiritish + oʻzgarish
    # Ikkala yozuv bir soniyada tushishi mumkin — vaqt boʻyicha emas,
    # mazmun boʻyicha topamiz.
    ozgarish = next(a for a in rows if a.new_value["base_salary"] == 6500000)
    assert ozgarish.old_value["base_salary"] == 6000000


async def test_royxatda_profilsiz_xodim_ham_bor(client: AsyncClient, world: dict) -> None:
    """Profil hali kiritilmagan boʻlsa ham xodim roʻyxatda koʻrinadi."""
    token = await _token(client, "hr.admin")
    r = await client.get("/api/v1/hr/employees", headers=_auth(token))
    assert r.status_code == 200
    nomlar = {e["full_name"] for e in r.json()}
    assert "Aliyev Sinov" in nomlar
    # Ota-ona xodim emas — roʻyxatda yoʻq.
    assert "Otayev Sinov" not in nomlar


async def test_ota_onaga_profil_ochilmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "hr.admin")
    r = await client.put(
        f"/api/v1/hr/employees/{world['ota'].id}/profile",
        headers=_auth(token),
        json={"position": "X"},
    )
    assert r.status_code == 422, r.text


async def test_tatil_oqimi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "hr.admin")
    bugun = local_today()

    r = await client.post(
        "/api/v1/hr/leaves",
        headers=_auth(token),
        json={
            "user_id": str(world["ustoz"].id),
            "leave_type": "tatil",
            "starts_on": str(bugun),
            "ends_on": str(bugun + timedelta(days=10)),
        },
    )
    assert r.status_code == 201, r.text
    leave_id = r.json()["id"]

    # Xodim roʻyxatida «taʼtilda» belgisi.
    r = await client.get("/api/v1/hr/employees", headers=_auth(token))
    ustoz = next(e for e in r.json() if e["login"] == "hr.ustoz")
    assert ustoz["on_leave"] == "tatil"

    # Xato sana — 422.
    r = await client.post(
        "/api/v1/hr/leaves",
        headers=_auth(token),
        json={
            "user_id": str(world["ustoz"].id),
            "leave_type": "kasallik",
            "starts_on": str(bugun),
            "ends_on": str(bugun - timedelta(days=1)),
        },
    )
    assert r.status_code == 422, r.text

    # Arxivlagach belgi yoʻqoladi.
    r = await client.post(f"/api/v1/hr/leaves/{leave_id}/archive", headers=_auth(token))
    assert r.status_code == 204
    r = await client.get("/api/v1/hr/employees", headers=_auth(token))
    ustoz = next(e for e in r.json() if e["login"] == "hr.ustoz")
    assert ustoz["on_leave"] is None


async def test_ustoz_kadrlarga_kira_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-2: oylik bor javob — faqat `users.manage` bilan."""
    token = await _token(client, "hr.ustoz")
    r = await client.get("/api/v1/hr/employees", headers=_auth(token))
    assert r.status_code == 403, r.text
    r = await client.get("/api/v1/hr/leaves", headers=_auth(token))
    assert r.status_code == 403, r.text
