"""Tarbiyaviy va psixologik qaydlar — kirish jadvali testda mixlanadi.

Eng muhim salbiy holatlar:
  · fan ustozi psixologik yozuvni KOʻRMAYDI;
  · begona ota-ona hech narsani koʻrmaydi (403, roʻyxat ham emas);
  · oʻquvchining oʻzi koʻrmaydi;
  · oddiy ustoz psixologik yozuv kirita olmaydi.
"""

from datetime import UTC, date, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    AuditLog,
    Guardian,
    Lesson,
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

    await _user(session, roles, [RoleName.ADMIN.value], "wb.admin", "Adminov")
    rahbar = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "wb.rahbar",
        "Rahbarov",
    )
    fan_ustoz = await _user(session, roles, [RoleName.TEACHER.value], "wb.fan", "Fanov")
    await _user(session, roles, [RoleName.TEACHER.value], "wb.begona", "Begona")
    ota = await _user(session, roles, [RoleName.PARENT.value], "wb.ota", "Otayev")
    await _user(session, roles, [RoleName.PARENT.value], "wb.bota", "Botayev")
    oquvchi_hisob = await _user(session, roles, [RoleName.STUDENT.value], "wb.stu", "Aliyev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(
        academic_year_id=year.id, name="6-A", homeroom_teacher_id=rahbar.id
    )
    fan = Subject(name="Fizika")
    session.add_all([sinf, fan])
    await session.flush()

    ali = Student(
        class_id=sinf.id, user_id=oquvchi_hisob.id, last_name="Aliyev", first_name="Ali"
    )
    session.add(ali)
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=ota.id, relation="father"),
            # «Dars beradi» manbai — lessons (`taught_class_ids`),
            # jadval yozuvi emas: ADM-10 almashtirishlarni hisobga oladi.
            Lesson(
                class_id=sinf.id,
                subject_id=fan.id,
                teacher_id=fan_ustoz.id,
                lesson_date=date(2026, 9, 7),
                period=1,
                starts_at=datetime(2026, 9, 7, 3, 30, tzinfo=UTC),
                ends_at=datetime(2026, 9, 7, 4, 15, tzinfo=UTC),
            ),
        ]
    )
    await session.commit()
    return {"ali": ali, "fan": fan}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _yoz(client, token, student_id, kind="behavior", text="Darslarda faol qatnashdi."):  # noqa: ANN001, ANN202
    return await client.post(
        "/api/v1/wellbeing",
        headers=_auth(token),
        json={
            "student_id": str(student_id),
            "kind": kind,
            "tone": "positive",
            "text": text,
        },
    )


# ─────────────────── Yozish huquqi ───────────────────


async def test_fan_ustozi_tarbiyaviy_yozadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "wb.fan")
    r = await _yoz(client, token, world["ali"].id)
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "behavior"


async def test_begona_ustoz_yozolmaydi(client: AsyncClient, world: dict) -> None:
    """X-2: dars bermaydigan ustoz — 403."""
    token = await _token(client, "wb.begona")
    r = await _yoz(client, token, world["ali"].id)
    assert r.status_code == 403, r.text


async def test_oddiy_ustoz_psixologik_yozolmaydi(client: AsyncClient, world: dict) -> None:
    """Psixologik yozuv — faqat rahbariyat (psixolog roli kelguncha)."""
    token = await _token(client, "wb.fan")
    r = await _yoz(client, token, world["ali"].id, kind="psychology")
    assert r.status_code == 403, r.text

    admin = await _token(client, "wb.admin")
    r = await _yoz(client, admin, world["ali"].id, kind="psychology")
    assert r.status_code == 201, r.text


# ─────────────────── Koʻrish jadvali ───────────────────


@pytest.fixture
async def yozuvlar(client: AsyncClient, world: dict) -> dict:
    """Bitta tarbiyaviy + bitta psixologik yozuv."""
    admin = await _token(client, "wb.admin")
    fan = await _token(client, "wb.fan")
    r1 = await _yoz(client, fan, world["ali"].id, text="Fizikadan faol qatnashdi.")
    r2 = await _yoz(client, admin, world["ali"].id, kind="psychology", text="Suhbat oʻtkazildi, holati barqaror.")
    assert r1.status_code == 201 and r2.status_code == 201
    return {"behavior": r1.json()["id"], "psychology": r2.json()["id"]}


async def test_vasiy_ikkalasini_koradi(
    client: AsyncClient, world: dict, yozuvlar: dict
) -> None:
    token = await _token(client, "wb.ota")
    r = await client.get(
        f"/api/v1/wellbeing/students/{world['ali'].id}", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert {x["kind"] for x in r.json()} == {"behavior", "psychology"}


async def test_sinf_rahbari_ikkalasini_koradi(
    client: AsyncClient, world: dict, yozuvlar: dict
) -> None:
    token = await _token(client, "wb.rahbar")
    r = await client.get(
        f"/api/v1/wellbeing/students/{world['ali'].id}", headers=_auth(token)
    )
    assert {x["kind"] for x in r.json()} == {"behavior", "psychology"}


async def test_fan_ustozi_psixologikni_kormaydi(
    client: AsyncClient, world: dict, yozuvlar: dict
) -> None:
    """Jadvaldagi eng muhim qator: fan ustoziga psixologik yozuv KELMAYDI."""
    token = await _token(client, "wb.fan")
    r = await client.get(
        f"/api/v1/wellbeing/students/{world['ali'].id}", headers=_auth(token)
    )
    assert r.status_code == 200
    assert {x["kind"] for x in r.json()} == {"behavior"}


async def test_begona_ota_kormaydi(
    client: AsyncClient, world: dict, yozuvlar: dict
) -> None:
    """6-qoida: begona oilaga 403 — boʻsh roʻyxat ham emas."""
    token = await _token(client, "wb.bota")
    r = await client.get(
        f"/api/v1/wellbeing/students/{world['ali'].id}", headers=_auth(token)
    )
    assert r.status_code == 403, r.text


async def test_oquvchining_ozi_kormaydi(
    client: AsyncClient, world: dict, yozuvlar: dict
) -> None:
    """Bu yozuvlar kattalar orasidagi muloqot."""
    token = await _token(client, "wb.stu")
    r = await client.get(
        f"/api/v1/wellbeing/students/{world['ali'].id}", headers=_auth(token)
    )
    assert r.status_code == 403, r.text


# ─────────────────── Arxiv va audit ───────────────────


async def test_arxivlash_va_audit(
    client: AsyncClient, world: dict, yozuvlar: dict, session: AsyncSession
) -> None:
    fan = await _token(client, "wb.fan")
    begona = await _token(client, "wb.begona")

    r = await client.post(
        f"/api/v1/wellbeing/{yozuvlar['behavior']}/archive", headers=_auth(begona)
    )
    assert r.status_code == 403

    r = await client.post(
        f"/api/v1/wellbeing/{yozuvlar['behavior']}/archive", headers=_auth(fan)
    )
    assert r.status_code == 204, r.text

    rows = (
        (
            await session.execute(
                select(AuditLog).where(AuditLog.object_type == "wellbeing_note")
            )
        )
        .scalars()
        .all()
    )
    # 2 ta create + 1 ta archive
    assert {a.action for a in rows} == {"create", "archive"}
    assert len(rows) == 3
