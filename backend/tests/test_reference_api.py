"""Maʼlumotnomani boshqarish va audit oʻqish (ADM-02, ADM-03, T-021).

Eng muhim testlar:
  · oʻquvchisi bor sinf arxivlanmaydi
  · jadvalda ishlatilayotgan fan arxivlanmaydi
  · sinf rahbari biriktirilganda unga ROL ham beriladi
  · arxivdagi fan qayta yaratilmaydi — qaytariladi (baholar unga bogʻlangan)
  · audit jurnalini faqat butun maktabni koʻradigan oʻqiydi
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    ClassSubject,
    Permission,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    User,
)
from app.services import permissions
from app.services.access import CurrentUser

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(
    session: AsyncSession, roles: dict[str, Role], names: list[str], login: str, last: str
) -> User:
    u = User(
        login=login, password_hash=hash_password(PASSWORD), last_name=last, first_name="Sinov"
    )
    u.roles = [roles[r] for r in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, object]:
    roles = await _roles(session)

    superadmin = await _user(session, roles, [RoleName.SUPERADMIN.value], "rf.sa", "Boshqaruv")
    admin = await _user(session, roles, [RoleName.ADMIN.value], "rf.admin", "Adminov")
    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "rf.ustoz", "Aliyev")

    await permissions.grant(
        session,
        target_user_id=admin.id,
        permission=Permission.STUDENTS_MANAGE,
        granted_by=CurrentUser.from_model(superadmin),
    )
    await session.flush()

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 1), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    session.add(math)
    await session.flush()

    bosh = SchoolClass(academic_year_id=year.id, name="8-A")
    toliq = SchoolClass(academic_year_id=year.id, name="8-B")
    session.add_all([bosh, toliq])
    await session.flush()

    session.add(Student(class_id=toliq.id, last_name="Aliyev", first_name="Ali"))
    await session.flush()

    return {
        "superadmin": superadmin,
        "admin": admin,
        "ustoz": ustoz,
        "year": year,
        "math": math,
        "bosh_sinf": bosh,
        "toliq_sinf": toliq,
    }


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


# ─────────────────────────── Fanlar ───────────────────────────


async def test_fan_qoshiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    r = await client.post(
        "/api/v1/school/subjects",
        headers=_auth(token),
        json={"name": "Kimyo", "short_name": "Kim"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "Kimyo"

    r = await client.get("/api/v1/school/subjects", headers=_auth(token))
    assert "Kimyo" in [s["name"] for s in r.json()]


async def test_takroriy_fan_409(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    r = await client.post(
        "/api/v1/school/subjects", headers=_auth(token), json={"name": "Matematika"}
    )
    assert r.status_code == 409, r.text


async def test_arxivdagi_fan_qaytariladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Yangi yozuv YARATILMAYDI: oʻtgan baholar aynan shu fanga bogʻlangan."""
    token = await _token(client, "rf.admin")
    eski_id = str(world["math"].id)

    r = await client.post(
        f"/api/v1/school/subjects/{eski_id}/archive", headers=_auth(token)
    )
    assert r.status_code == 200, r.text

    r = await client.post(
        "/api/v1/school/subjects", headers=_auth(token), json={"name": "Matematika"}
    )
    assert r.status_code == 201, r.text
    assert r.json()["id"] == eski_id, "yangi fan yaratildi — baholar uzilib qolardi"

    barchasi = (
        (await session.execute(select(Subject).where(Subject.name == "Matematika")))
        .scalars()
        .all()
    )
    assert len(barchasi) == 1


async def test_jadvaldagi_fan_arxivlanmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Aks holda dars qolardi-yu, fani arxivda turardi."""
    session.add(
        ScheduleEntry(
            academic_year_id=world["year"].id,
            class_id=world["bosh_sinf"].id,
            subject_id=world["math"].id,
            teacher_id=world["ustoz"].id,
            weekday=1,
            period=1,
        )
    )
    await session.flush()

    token = await _token(client, "rf.admin")
    r = await client.post(
        f"/api/v1/school/subjects/{world['math'].id}/archive", headers=_auth(token)
    )
    assert r.status_code == 409, r.text
    assert "jadvalda" in r.json()["message"]


# ─────────────────────────── Sinflar ───────────────────────────


async def test_sinf_ochiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    r = await client.post(
        "/api/v1/school/classes", headers=_auth(token), json={"name": "9-v"}
    )
    assert r.status_code == 201, r.text
    # Server katta harfga keltiradi — «9-v» va «9-V» ikki xil sinf boʻlmasin.
    assert r.json()["name"] == "9-V"
    assert r.json()["student_count"] == 0


async def test_sinf_rahbariga_rol_beriladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """T-008 qabul mezoni. Rolsiz u sinf rahbari ekranlarini koʻrmasdi."""
    ustoz = world["ustoz"]
    assert RoleName.HOMEROOM_TEACHER.value not in ustoz.role_names

    token = await _token(client, "rf.admin")
    r = await client.post(
        "/api/v1/school/classes",
        headers=_auth(token),
        json={"name": "9-G", "homeroom_teacher_id": str(ustoz.id)},
    )
    assert r.status_code == 201, r.text
    assert r.json()["homeroom_teacher"] == "Aliyev Sinov"

    await session.refresh(ustoz, attribute_names=["roles"])
    assert RoleName.HOMEROOM_TEACHER.value in ustoz.role_names


async def test_rahbarni_almashtirish(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    r = await client.put(
        f"/api/v1/school/classes/{world['bosh_sinf'].id}/homeroom",
        headers=_auth(token),
        json={"teacher_id": str(world["ustoz"].id)},
    )
    assert r.status_code == 200, r.text
    assert r.json()["homeroom_teacher"] == "Aliyev Sinov"

    r = await client.put(
        f"/api/v1/school/classes/{world['bosh_sinf'].id}/homeroom",
        headers=_auth(token),
        json={"teacher_id": None},
    )
    assert r.status_code == 200
    assert r.json()["homeroom_teacher"] is None


async def test_bosh_sinf_arxivlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "rf.admin")
    r = await client.post(
        f"/api/v1/school/classes/{world['bosh_sinf'].id}/archive", headers=_auth(token)
    )
    assert r.status_code == 204, r.text

    cls = await session.get(SchoolClass, world["bosh_sinf"].id)
    assert cls is not None, "sinf oʻchirilgan — 1-qoida buzildi"
    assert cls.is_archived is True


async def test_oquvchisi_bor_sinf_arxivlanmaydi(client: AsyncClient, world: dict) -> None:
    """T-008 qabul mezoni."""
    token = await _token(client, "rf.admin")
    r = await client.post(
        f"/api/v1/school/classes/{world['toliq_sinf'].id}/archive", headers=_auth(token)
    )
    assert r.status_code == 409, r.text
    assert "oʻquvchi" in r.json()["message"]


# ─────────────────── Sinfning oʻquv rejasi ───────────────────


async def test_sinfga_fan_biriktiriladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    r = await client.put(
        f"/api/v1/school/classes/{world['bosh_sinf'].id}/subjects",
        headers=_auth(token),
        json={"subject_id": str(world["math"].id), "weekly_hours": 5},
    )
    assert r.status_code == 204, r.text

    r = await client.get(
        f"/api/v1/school/classes/{world['bosh_sinf'].id}/subjects", headers=_auth(token)
    )
    assert r.json() == [
        {
            "subject_id": str(world["math"].id),
            "subject_name": "Matematika",
            "weekly_hours": 5,
        }
    ]


async def test_nol_soat_rejadan_chiqaradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Yozuv arxivlanadi, oʻchirilmaydi (1-qoida)."""
    token = await _token(client, "rf.admin")
    url = f"/api/v1/school/classes/{world['bosh_sinf'].id}/subjects"

    await client.put(
        url, headers=_auth(token), json={"subject_id": str(world["math"].id), "weekly_hours": 4}
    )
    await client.put(
        url, headers=_auth(token), json={"subject_id": str(world["math"].id), "weekly_hours": 0}
    )

    r = await client.get(url, headers=_auth(token))
    assert r.json() == []

    rows = (await session.execute(select(ClassSubject))).scalars().all()
    assert len(rows) == 1, "bogʻlanish oʻchirilgan — 1-qoida buzildi"
    assert rows[0].is_archived is True


# ─────────────────────────── Huquq ───────────────────────────


async def test_huquqsiz_ustoz_fan_qosha_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.ustoz")
    r = await client.post(
        "/api/v1/school/subjects", headers=_auth(token), json={"name": "Fizika"}
    )
    assert r.status_code == 403, r.text


async def test_huquqsiz_ustoz_sinf_ocha_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.ustoz")
    r = await client.post(
        "/api/v1/school/classes", headers=_auth(token), json={"name": "10-A"}
    )
    assert r.status_code == 403, r.text


# ─────────────────────── Audit jurnali (T-021) ───────────────────────


async def test_audit_amallarni_korsatadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    await client.post(
        "/api/v1/school/subjects", headers=_auth(token), json={"name": "Biologiya"}
    )

    r = await client.get("/api/v1/audit", headers=_auth(token))
    assert r.status_code == 200, r.text

    body = r.json()
    assert body["total"] >= 1
    yozuv = next(x for x in body["rows"] if x["object_type"] == "subject")
    assert yozuv["action"] == "create"
    assert yozuv["new_value"]["name"] == "Biologiya"
    assert yozuv["actor_name"] == "Adminov Sinov"


async def test_audit_filtrlanadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    await client.post("/api/v1/school/subjects", headers=_auth(token), json={"name": "Geografiya"})
    await client.post("/api/v1/school/classes", headers=_auth(token), json={"name": "11-D"})

    r = await client.get(
        "/api/v1/audit", headers=_auth(token), params={"object_type": "class"}
    )
    assert r.status_code == 200
    assert all(x["object_type"] == "class" for x in r.json()["rows"])

    r = await client.get("/api/v1/audit", headers=_auth(token), params={"q": "Geografiya"})
    assert r.json()["total"] >= 1


async def test_audit_sahifalanadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "rf.admin")
    for i in range(4):
        await client.post(
            "/api/v1/school/subjects", headers=_auth(token), json={"name": f"Fan{i}"}
        )

    r = await client.get("/api/v1/audit", headers=_auth(token), params={"limit": 2})
    assert len(r.json()["rows"]) == 2
    assert r.json()["has_more"] is True


async def test_audit_filtr_royxati(client: AsyncClient, world: dict) -> None:
    """Roʻyxat jurnaldan chiqadi — qatʼiy yozib qoʻyilmagan."""
    token = await _token(client, "rf.admin")
    await client.post("/api/v1/school/subjects", headers=_auth(token), json={"name": "Astronomiya"})

    r = await client.get("/api/v1/audit/filters", headers=_auth(token))
    assert r.status_code == 200
    assert "subject" in r.json()["object_types"]
    assert "create" in r.json()["actions"]


async def test_ustoz_audit_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    """Jurnalda oʻquvchi ismi, bahosi va toʻlovi bor — ochiq roʻyxat emas."""
    token = await _token(client, "rf.ustoz")
    r = await client.get("/api/v1/audit", headers=_auth(token))
    assert r.status_code == 403, r.text

    r = await client.get("/api/v1/audit/filters", headers=_auth(token))
    assert r.status_code == 403


async def test_audit_yozish_endpointi_yoq(client: AsyncClient, world: dict) -> None:
    """Jurnal faqat servislardan toʻladi. Tashqaridan yozib boʻlmaydi."""
    token = await _token(client, "rf.admin")

    for method in ("post", "put", "patch", "delete"):
        r = await getattr(client, method)("/api/v1/audit", headers=_auth(token))
        assert r.status_code == 405, f"{method.upper()} ochiq qolgan"
