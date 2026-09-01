"""CRM — lidlar, qoʻngʻiroqlar, shartnomalar roʻyxati.

Muhim tekshiruvlar:
  · yozish faqat `students.manage` bilan — ustoz va ota-onaga 403;
  · yopiq holatdan (`qabul_qilindi`/`yo_qoldi`) qaytish — 409;
  · qoʻngʻiroq yozilganda `yangi` lid avtomatik `aloqada` boʻladi;
  · shartnomalar roʻyxati moliya koʻrinishi — oʻquv boʻlimiga 403;
  · har yozuv amali auditga tushadi.
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
    TuitionContract,
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

    admin = await _user(session, roles, [RoleName.ADMIN.value], "crm.admin", "Adminov")
    session.add(UserPermission(user_id=admin.id, permission=Permission.STUDENTS_MANAGE.value))
    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "crm.ustoz", "Aliyev")
    await _user(session, roles, [RoleName.ACADEMIC.value], "crm.oquv", "Oquvboyev")
    await _user(session, roles, [RoleName.PARENT.value], "crm.ota", "Otayev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(academic_year_id=year.id, name="5-B")
    session.add(sinf)
    await session.flush()

    student = Student(class_id=sinf.id, last_name="Karimov", first_name="Bekzod")
    session.add(student)
    await session.flush()

    session.add(
        TuitionContract(
            student_id=student.id, monthly_fee=3_500_000, starts_on=date(2026, 9, 1)
        )
    )
    await session.commit()
    return {"admin": admin, "ustoz": ustoz, "student": student}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _create_lead(client: AsyncClient, token: str, **extra) -> dict:  # noqa: ANN003
    body = {
        "parent_name": "Rustamova Nilufar",
        "phone": "+998901234567",
        "child_name": "Rustamov Sardor",
        "child_birth_year": 2018,
        "source": "instagram",
        "note": "5-sinfga qiziqdi",
    }
    body.update(extra)
    r = await client.post("/api/v1/crm/leads", headers=_auth(token), json=body)
    assert r.status_code == 201, r.text
    return r.json()


async def test_lid_yaratish_royxat_va_qidiruv(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "crm.admin")

    lead = await _create_lead(client, token)
    assert lead["status"] == "yangi"
    assert lead["phone"] == "+998901234567"

    # Telefon unique EMAS — bir oila ikkinchi bola uchun yana yoziladi.
    await _create_lead(client, token, child_name="Rustamova Sevinch")

    r = await client.get("/api/v1/crm/leads", headers=_auth(token))
    assert r.status_code == 200
    assert len(r.json()) == 2

    # Telefon boʻyicha qidiruv.
    r = await client.get(
        "/api/v1/crm/leads", headers=_auth(token), params={"q": "90123"}
    )
    assert len(r.json()) == 2

    # Status filtri.
    r = await client.get(
        "/api/v1/crm/leads", headers=_auth(token), params={"status": "tashrif"}
    )
    assert r.json() == []

    # Yaratish auditga tushdi.
    rows = (
        (await session.execute(select(AuditLog).where(AuditLog.object_type == "lead")))
        .scalars()
        .all()
    )
    assert len(rows) == 2


async def test_status_otish_va_yopiqdan_qaytish_409(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "crm.admin")
    lead = await _create_lead(client, token)

    # Erkin oʻtish: yangi → tashrif.
    r = await client.patch(
        f"/api/v1/crm/leads/{lead['id']}",
        headers=_auth(token),
        json={"status": "tashrif"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "tashrif"

    # Yopish: qabul qilindi, oʻquvchiga bogʻlanadi.
    r = await client.patch(
        f"/api/v1/crm/leads/{lead['id']}",
        headers=_auth(token),
        json={"status": "qabul_qilindi", "student_id": str(world["student"].id)},
    )
    assert r.status_code == 200, r.text
    assert r.json()["student_id"] == str(world["student"].id)

    # Yopiq holatdan qaytish yoʻq — 409.
    r = await client.patch(
        f"/api/v1/crm/leads/{lead['id']}",
        headers=_auth(token),
        json={"status": "aloqada"},
    )
    assert r.status_code == 409, r.text

    # Yopiq lidning izohini tahrirlash mumkin — bu holatni oʻzgartirmaydi.
    r = await client.patch(
        f"/api/v1/crm/leads/{lead['id']}",
        headers=_auth(token),
        json={"note": "Sentyabrdan boshlaydi"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "qabul_qilindi"


async def test_qongiroq_yozilganda_status_aloqada(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "crm.admin")
    lead = await _create_lead(client, token)

    r = await client.post(
        f"/api/v1/crm/leads/{lead['id']}/calls",
        headers=_auth(token),
        json={"result": "javob_berdi", "note": "Ertaga tashrifga keladi"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["result"] == "javob_berdi"

    # Lid avtomatik `aloqada` ga oʻtdi.
    r = await client.get("/api/v1/crm/leads", headers=_auth(token))
    assert r.json()[0]["status"] == "aloqada"

    # Lidning qoʻngʻiroqlar tarixi.
    r = await client.get(f"/api/v1/crm/leads/{lead['id']}/calls", headers=_auth(token))
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Umumiy jurnal ham koʻradi.
    r = await client.get("/api/v1/crm/calls", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()[0]["lead_parent_name"] == "Rustamova Nilufar"

    # Audit: qoʻngʻiroq CREATE + lid status UPDATE.
    calls_audit = (
        (
            await session.execute(
                select(AuditLog).where(AuditLog.object_type == "lead_call")
            )
        )
        .scalars()
        .all()
    )
    assert len(calls_audit) == 1
    status_audit = (
        (
            await session.execute(
                select(AuditLog).where(
                    AuditLog.object_type == "lead", AuditLog.action == "update"
                )
            )
        )
        .scalars()
        .all()
    )
    assert any(a.new_value.get("status") == "aloqada" for a in status_audit)


async def test_huquqsizga_403(client: AsyncClient, world: dict) -> None:
    """`students.manage` yoʻq — ustozga ham, ota-onaga ham 403 (X-3)."""
    for login in ("crm.ustoz", "crm.ota"):
        token = await _token(client, login)
        r = await client.get("/api/v1/crm/leads", headers=_auth(token))
        assert r.status_code == 403, f"{login}: {r.text}"
        r = await client.post(
            "/api/v1/crm/leads",
            headers=_auth(token),
            json={"parent_name": "Test", "phone": "+998900000000"},
        )
        assert r.status_code == 403
        r = await client.get("/api/v1/crm/calls", headers=_auth(token))
        assert r.status_code == 403


async def test_arxivlash_va_royxatdan_chiqishi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "crm.admin")
    lead = await _create_lead(client, token)

    r = await client.post(
        f"/api/v1/crm/leads/{lead['id']}/archive", headers=_auth(token)
    )
    assert r.status_code == 204

    r = await client.get("/api/v1/crm/leads", headers=_auth(token))
    assert r.json() == []


async def test_shartnomalar_royxati_va_academic_403(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "crm.admin")
    r = await client.get("/api/v1/crm/contracts", headers=_auth(token))
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["student_name"].startswith("Karimov")
    assert rows[0]["class_name"] == "5-B"
    assert rows[0]["monthly_fee"] == 3_500_000
    assert rows[0]["is_archived"] is False

    # Oʻquv boʻlimi moliyani KOʻRMAYDI (assert_finance_admin).
    token = await _token(client, "crm.oquv")
    r = await client.get("/api/v1/crm/contracts", headers=_auth(token))
    assert r.status_code == 403


async def test_summary_togri_sanaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "crm.admin")
    a = await _create_lead(client, token)
    await _create_lead(client, token, parent_name="Sobirova Dilnoza")
    b = await _create_lead(client, token, parent_name="Yusupov Jasur")

    await client.patch(
        f"/api/v1/crm/leads/{a['id']}", headers=_auth(token), json={"status": "tashrif"}
    )
    await client.patch(
        f"/api/v1/crm/leads/{b['id']}",
        headers=_auth(token),
        json={"status": "yo_qoldi"},
    )

    r = await client.get("/api/v1/crm/leads/summary", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 3
    assert data["counts"]["yangi"] == 1
    assert data["counts"]["tashrif"] == 1
    assert data["counts"]["yo_qoldi"] == 1
    assert data["counts"]["aloqada"] == 0
