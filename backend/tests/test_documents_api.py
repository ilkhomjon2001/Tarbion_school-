"""Maʼlumotnomalar — navbat, berish, reyestr.

Muhim tekshiruvlar:
  · berilgan hujjat OʻZGARMAYDI (holati ham);
  · raqam yil ichida ketma-ket va takrorlanmas;
  · berish audit_log ga raqam va oluvchi bilan tushadi (X-13);
  · ustoz va ota-ona bu modulga umuman kira olmaydi.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    AuditLog,
    Permission,
    Role,
    RoleName,
    SchoolClass,
    Student,
    User,
    UserPermission,
)

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)

    admin = User(
        login="doc.admin",
        password_hash=hash_password(PASSWORD),
        last_name="Adminov",
        first_name="Sinov",
    )
    admin.roles = [roles[RoleName.ADMIN.value]]
    ustoz = User(
        login="doc.ustoz",
        password_hash=hash_password(PASSWORD),
        last_name="Aliyev",
        first_name="Sinov",
    )
    ustoz.roles = [roles[RoleName.TEACHER.value]]
    session.add_all([admin, ustoz])
    await session.flush()
    session.add(
        UserPermission(user_id=admin.id, permission=Permission.STUDENTS_MANAGE.value)
    )

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(academic_year_id=year.id, name="7-A")
    session.add(sinf)
    await session.flush()

    ali = Student(
        class_id=sinf.id,
        last_name="Aliyev",
        first_name="Ali",
        birth_date=date(2013, 4, 12),
    )
    session.add(ali)
    await session.commit()
    return {"ali": ali}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def test_toliq_oqim(client: AsyncClient, world: dict, session: AsyncSession) -> None:
    """Soʻrov → kutishda → berildi → reyestrda."""
    token = await _token(client, "doc.admin")

    r = await client.post(
        "/api/v1/documents",
        headers=_auth(token),
        json={
            "student_id": str(world["ali"].id),
            "doc_type": "oquv_joyi",
            "requested_by": "Otasi (tel. orqali)",
        },
    )
    assert r.status_code == 201, r.text
    doc_id = r.json()["id"]
    assert r.json()["status"] == "new"
    assert r.json()["birth_year"] == 2013

    r = await client.post(f"/api/v1/documents/{doc_id}/waiting", headers=_auth(token))
    assert r.json()["status"] == "waiting"

    r = await client.post(
        f"/api/v1/documents/{doc_id}/issue",
        headers=_auth(token),
        json={"recipient": "Ish joyiga", "copies": 2},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "issued"
    assert body["number"].startswith("MK-")
    assert body["copies"] == 2

    # Navbat boʻsh, reyestrda bitta.
    r = await client.get("/api/v1/documents/queue", headers=_auth(token))
    assert r.json() == []
    r = await client.get("/api/v1/documents/registry", headers=_auth(token))
    assert len(r.json()) == 1

    # X-13: berish auditda raqam va oluvchi bilan.
    rows = (
        (
            await session.execute(
                select(AuditLog).where(AuditLog.object_type == "document")
            )
        )
        .scalars()
        .all()
    )
    berish = [a for a in rows if a.new_value.get("status") == "issued"]
    assert len(berish) == 1
    assert berish[0].new_value["number"] == body["number"]
    assert berish[0].new_value["recipient"] == "Ish joyiga"


async def test_berilgan_hujjat_ozgarmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "doc.admin")
    r = await client.post(
        "/api/v1/documents",
        headers=_auth(token),
        json={"student_id": str(world["ali"].id), "doc_type": "daromad"},
    )
    doc_id = r.json()["id"]
    await client.post(
        f"/api/v1/documents/{doc_id}/issue", headers=_auth(token), json={"recipient": "Bankka"}
    )

    # Qayta berish ham, holatini qaytarish ham mumkin emas.
    r = await client.post(
        f"/api/v1/documents/{doc_id}/issue", headers=_auth(token), json={"recipient": "X"}
    )
    assert r.status_code == 409, r.text
    r = await client.post(f"/api/v1/documents/{doc_id}/waiting", headers=_auth(token))
    assert r.status_code == 409, r.text


async def test_raqam_ketma_ket(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "doc.admin")
    raqamlar = []
    for turi in ("oquv_joyi", "daromad"):
        r = await client.post(
            "/api/v1/documents",
            headers=_auth(token),
            json={"student_id": str(world["ali"].id), "doc_type": turi},
        )
        r = await client.post(
            f"/api/v1/documents/{r.json()['id']}/issue",
            headers=_auth(token),
            json={"recipient": ""},
        )
        raqamlar.append(r.json()["number"])

    a, b = raqamlar
    assert a != b
    assert int(b.rsplit("-", 1)[1]) == int(a.rsplit("-", 1)[1]) + 1


async def test_ustoz_kira_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-2: modul faqat `students.manage` bilan."""
    token = await _token(client, "doc.ustoz")
    r = await client.get("/api/v1/documents/queue", headers=_auth(token))
    assert r.status_code == 403, r.text
    r = await client.post(
        "/api/v1/documents",
        headers=_auth(token),
        json={"student_id": str(world["ali"].id), "doc_type": "oquv_joyi"},
    )
    assert r.status_code == 403, r.text


async def test_notogri_tur(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "doc.admin")
    r = await client.post(
        "/api/v1/documents",
        headers=_auth(token),
        json={"student_id": str(world["ali"].id), "doc_type": "pasport"},
    )
    assert r.status_code == 422, r.text
