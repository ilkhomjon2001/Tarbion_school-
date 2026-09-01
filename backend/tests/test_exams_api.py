"""Imtihonlar va dars rejalari.

Muhim tekshiruvlar:
  · ustoz va ota-ona modulga kira olmaydi (router darajasida yopiq);
  · ball faqat imtihon sinfining oʻquvchisiga;
  · oʻtkazilgan imtihon rejaga qaytmaydi;
  · reja qaytarilganda sabab majburiy.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    Role,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    User,
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
    await _user(session, roles, [RoleName.ACADEMIC.value], "ex.oquv", "Oquvboyev")
    await _user(session, roles, [RoleName.TEACHER.value], "ex.ustoz", "Aliyev")
    ustoz2 = await _user(session, roles, [RoleName.TEACHER.value], "ex.ustoz2", "Karimov")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf_a = SchoolClass(academic_year_id=year.id, name="8-A")
    sinf_b = SchoolClass(academic_year_id=year.id, name="8-B")
    fan = Subject(name="Biologiya")
    session.add_all([sinf_a, sinf_b, fan])
    await session.flush()

    ali = Student(class_id=sinf_a.id, last_name="Aliyev", first_name="Ali")
    vali = Student(class_id=sinf_a.id, last_name="Valiyev", first_name="Vali")
    begona = Student(class_id=sinf_b.id, last_name="Begona", first_name="Bola")
    session.add_all([ali, vali, begona])
    await session.commit()
    return {
        "sinf_a": sinf_a,
        "fan": fan,
        "ali": ali,
        "vali": vali,
        "begona": begona,
        "ustoz2": ustoz2,
    }


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _imtihon(client: AsyncClient, token: str, world: dict) -> dict:
    r = await client.post(
        "/api/v1/exams",
        headers=_auth(token),
        json={
            "title": "1-oylik nazorat",
            "kind": "oylik",
            "subject_id": str(world["fan"].id),
            "class_id": str(world["sinf_a"].id),
            "exam_date": "2026-10-05",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_imtihon_oqimi(client: AsyncClient, world: dict) -> None:
    """Yaratish → ball kiritish → statistika."""
    token = await _token(client, "ex.oquv")
    exam = await _imtihon(client, token, world)
    assert exam["status"] == "rejada"

    # Roʻyxatda sinfning hamma oʻquvchisi, natijasi hali yoʻq.
    r = await client.get(f"/api/v1/exams/{exam['id']}/results", headers=_auth(token))
    assert len(r.json()) == 2
    assert all(not x["recorded"] for x in r.json())

    r = await client.put(
        f"/api/v1/exams/{exam['id']}/results",
        headers=_auth(token),
        json={
            "scores": [
                {"student_id": str(world["ali"].id), "score": 85},
                {"student_id": str(world["vali"].id), "absent": True},
            ]
        },
    )
    assert r.status_code == 204, r.text

    r = await client.get("/api/v1/exams", headers=_auth(token))
    row = next(x for x in r.json() if x["id"] == exam["id"])
    assert row["status"] == "otkazildi"  # ball kiritilgach avtomatik
    assert row["stats"]["entered"] == 1
    assert row["stats"]["absent"] == 1
    assert row["stats"]["average"] == 85.0
    assert row["stats"]["pass_rate"] == 100


async def test_begona_sinf_oquvchisiga_ball_yozilmaydi(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "ex.oquv")
    exam = await _imtihon(client, token, world)
    r = await client.put(
        f"/api/v1/exams/{exam['id']}/results",
        headers=_auth(token),
        json={"scores": [{"student_id": str(world["begona"].id), "score": 90}]},
    )
    assert r.status_code == 422, r.text


async def test_otkazilgan_imtihon_qaytmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ex.oquv")
    exam = await _imtihon(client, token, world)
    await client.put(
        f"/api/v1/exams/{exam['id']}/results",
        headers=_auth(token),
        json={"scores": [{"student_id": str(world["ali"].id), "score": 70}]},
    )
    r = await client.post(
        f"/api/v1/exams/{exam['id']}/status?status=rejada", headers=_auth(token)
    )
    assert r.status_code == 409, r.text


async def test_ustoz_va_bekor_ball(client: AsyncClient, world: dict) -> None:
    """X-2: ustoz modulga kira olmaydi; bekor imtihonga ball yoʻq."""
    ustoz = await _token(client, "ex.ustoz")
    r = await client.get("/api/v1/exams", headers=_auth(ustoz))
    assert r.status_code == 403, r.text

    token = await _token(client, "ex.oquv")
    exam = await _imtihon(client, token, world)
    await client.post(f"/api/v1/exams/{exam['id']}/status?status=bekor", headers=_auth(token))
    r = await client.put(
        f"/api/v1/exams/{exam['id']}/results",
        headers=_auth(token),
        json={"scores": [{"student_id": str(world["ali"].id), "score": 50}]},
    )
    assert r.status_code == 409, r.text


async def test_reja_oqimi(client: AsyncClient, world: dict) -> None:
    """Reja: roʻyxatga olish → qaytarish (sabab bilan) → takror 409."""
    token = await _token(client, "ex.oquv")
    r = await client.post(
        "/api/v1/exams/plans",
        headers=_auth(token),
        json={
            "teacher_id": str(world["ustoz2"].id),
            "subject_id": str(world["fan"].id),
            "class_id": str(world["sinf_a"].id),
            "period": "1-chorak",
        },
    )
    assert r.status_code == 201, r.text
    plan = r.json()
    assert plan["status"] == "topshirildi"

    # Sababsiz qaytarish — 422.
    r = await client.post(
        f"/api/v1/exams/plans/{plan['id']}/status",
        headers=_auth(token),
        json={"status": "qaytarildi"},
    )
    assert r.status_code == 422, r.text

    r = await client.post(
        f"/api/v1/exams/plans/{plan['id']}/status",
        headers=_auth(token),
        json={"status": "qaytarildi", "comment": "Mavzular soatlarga mos emas"},
    )
    assert r.status_code == 200
    assert r.json()["comment"] == "Mavzular soatlarga mos emas"

    # Bir davr uchun ikkinchi yozuv — 409.
    r = await client.post(
        "/api/v1/exams/plans",
        headers=_auth(token),
        json={
            "teacher_id": str(world["ustoz2"].id),
            "subject_id": str(world["fan"].id),
            "class_id": str(world["sinf_a"].id),
            "period": "1-chorak",
        },
    )
    assert r.status_code == 409, r.text
