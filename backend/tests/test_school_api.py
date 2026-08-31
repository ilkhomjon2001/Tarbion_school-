"""Maʼlumotnoma: sinf, fan, oʻquvchi, xodim (T-008, T-009).

Eng muhim testlar:
  · ota-ona oʻquvchilar roʻyxatidan faqat oʻz farzandini oladi
  · roʻyxatda tugʻilgan sana va telefon YOʻQ (X-6)
  · huquqsiz administrator oʻquvchi qabul qila olmaydi (T-005)
  · arxivlangan oʻquvchi OʻCHMAYDI, roʻyxatdan chiqadi (1-qoida)
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
    ClassSubject,
    Guardian,
    Permission,
    Role,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    User,
)
from app.services import permissions
from app.services.access import CurrentUser

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(
    session: AsyncSession, roles: dict[str, Role], role_names: list[str], login: str, last: str
) -> User:
    user = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name=last,
        first_name="Sinov",
        phone="998901112233",
    )
    user.roles = [roles[r] for r in role_names]
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, object]:
    roles = await _roles(session)

    superadmin = await _user(session, roles, [RoleName.SUPERADMIN.value], "sch.sa", "Boshqaruv")
    admin = await _user(session, roles, [RoleName.ADMIN.value], "sch.admin", "Adminov")
    teacher = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "sch.ustoz",
        "Ustozov",
    )
    parent_a = await _user(session, roles, [RoleName.PARENT.value], "sch.otaona_a", "Aliyev")
    parent_b = await _user(session, roles, [RoleName.PARENT.value], "sch.otaona_b", "Valiyev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 24), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    session.add(math)
    await session.flush()
    session.add(TeacherSubject(teacher_id=teacher.id, subject_id=math.id))

    class_a = SchoolClass(academic_year_id=year.id, name="8-A", homeroom_teacher_id=teacher.id)
    class_b = SchoolClass(academic_year_id=year.id, name="8-B")
    session.add_all([class_a, class_b])
    await session.flush()
    session.add(ClassSubject(class_id=class_a.id, subject_id=math.id, weekly_hours=5))

    ali = Student(
        class_id=class_a.id, last_name="Aliyev", first_name="Ali", birth_date=date(2012, 3, 4)
    )
    vali = Student(class_id=class_b.id, last_name="Valiyev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=parent_a.id, relation="father"),
            Guardian(student_id=vali.id, user_id=parent_b.id, relation="mother"),
        ]
    )
    await session.flush()

    return {
        "superadmin": superadmin,
        "admin": admin,
        "teacher": teacher,
        "parent_a": parent_a,
        "parent_b": parent_b,
        "class_a": class_a,
        "class_b": class_b,
        "ali": ali,
        "vali": vali,
        "math": math,
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────── Maʼlumotnomalar ───────────────────────────


async def test_sinflar_oquvchi_soni_bilan(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/classes", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    sinflar = {c["name"]: c for c in resp.json()}
    assert sinflar["8-A"]["student_count"] == 1
    assert sinflar["8-A"]["homeroom_teacher"] == "Ustozov Sinov"
    # Sinf rahbari yoʻq boʻlsa `null`, xato emas
    assert sinflar["8-B"]["homeroom_teacher"] is None


async def test_fanlar_royxati(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/subjects", headers=_auth(token))
    assert resp.status_code == 200
    assert [s["name"] for s in resp.json()] == ["Matematika"]


async def test_sinf_fanlari_haftalik_soat_bilan(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get(
        f"/api/v1/school/classes/{world['class_a'].id}/subjects", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json() == [
        {
            "subject_id": str(world["math"].id),
            "subject_name": "Matematika",
            "weekly_hours": 5,
        }
    ]


async def test_xodimlar_royxatida_otaona_yoq(client: AsyncClient, world: dict) -> None:
    """Bu XODIMLAR roʻyxati — ota-ona va oʻquvchi rollari chiqmaydi."""
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/staff", headers=_auth(token))
    assert resp.status_code == 200

    loginlar = {s["login"] for s in resp.json()}
    assert "sch.ustoz" in loginlar
    assert "sch.otaona_a" not in loginlar

    ustoz = next(s for s in resp.json() if s["login"] == "sch.ustoz")
    assert ustoz["subjects"] == ["Matematika"]


# ─────────────────────── Kirish nazorati (X-1, X-6) ───────────────────────


async def test_otaona_faqat_oz_farzandini_koradi(client: AsyncClient, world: dict) -> None:
    """Roʻyxat endpointida ham kesim soʻrov darajasida."""
    token = await _token(client, "sch.otaona_a")
    resp = await client.get("/api/v1/school/students", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    ismlar = {s["full_name"] for s in resp.json()}
    assert ismlar == {"Aliyev Ali"}


async def test_royxatda_shaxsiy_malumot_yoq(client: AsyncClient, world: dict) -> None:
    """X-6: tugʻilgan sana, telefon, vasiy — faqat kartochkada."""
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/students", headers=_auth(token))

    maydonlar = set(resp.json()[0])
    assert maydonlar == {"id", "full_name", "class_name", "is_archived"}


async def test_kartochkada_shaxsiy_malumot_bor(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get(f"/api/v1/school/students/{world['ali'].id}", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    body = resp.json()
    assert body["birth_date"] == "2012-03-04"
    assert body["class_name"] == "8-A"
    assert len(body["guardians"]) == 1
    assert body["guardians"][0]["relation"] == "father"


async def test_begona_otaona_kartochkani_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-1: URL dagi id ni oʻzgartirish."""
    token = await _token(client, "sch.otaona_b")
    resp = await client.get(f"/api/v1/school/students/{world['ali'].id}", headers=_auth(token))
    assert resp.status_code == 403


async def test_ustoz_oz_sinfini_koradi(client: AsyncClient, world: dict) -> None:
    """Sinf rahbari oʻz sinfining oʻquvchilarini koʻradi."""
    token = await _token(client, "sch.ustoz")
    resp = await client.get("/api/v1/school/students", headers=_auth(token))
    assert resp.status_code == 200

    ismlar = {s["full_name"] for s in resp.json()}
    assert "Aliyev Ali" in ismlar
    assert "Valiyev Vali" not in ismlar


async def test_tokensiz_royxat_yopiq(client: AsyncClient, world: dict) -> None:
    resp = await client.get("/api/v1/school/students")
    assert resp.status_code == 401


# ─────────────────────── Yozish huquqi (T-005) ───────────────────────


async def test_huquqsiz_admin_oquvchi_qosha_olmaydi(client: AsyncClient, world: dict) -> None:
    """Administrator ROLI yolgʻiz yetarli emas."""
    token = await _token(client, "sch.admin")
    resp = await client.post(
        "/api/v1/school/students",
        headers=_auth(token),
        json={"last_name": "Yangi", "first_name": "Oʻquvchi"},
    )
    assert resp.status_code == 403


async def test_huquqli_admin_oquvchi_qoshadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=Permission.STUDENTS_MANAGE,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    token = await _token(client, "sch.admin")
    resp = await client.post(
        "/api/v1/school/students",
        headers=_auth(token),
        json={
            "last_name": "Yangiyev",
            "first_name": "Bekzod",
            "birth_date": "2013-05-06",
            "class_id": str(world["class_a"].id),
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["class_name"] == "8-A"


async def test_takroriy_oquvchi_rad_etiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Bir xil ism, familiya va tugʻilgan sana — ehtimol takroriy qabul."""
    await permissions.grant(
        session,
        target_user_id=world["superadmin"].id,
        permission=Permission.STUDENTS_MANAGE,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    token = await _token(client, "sch.sa")
    resp = await client.post(
        "/api/v1/school/students",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Ali", "birth_date": "2012-03-04"},
    )
    assert resp.status_code == 409


async def test_sinfga_kochirish(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.sa")
    resp = await client.put(
        f"/api/v1/school/students/{world['ali'].id}/class",
        headers=_auth(token),
        json={"class_id": str(world["class_b"].id)},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["class_name"] == "8-B"


# ─────────────────────── Arxivlash (1-qoida) ───────────────────────


async def test_arxivlangan_oquvchi_ochmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "sch.sa")
    resp = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": "Boshqa maktabga koʻchdi"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_archived"] is True

    # Yozuv bazada QOLADI — oʻtgan davomat va toʻlov hisobotda kerak
    hali_bor = await session.get(Student, world["ali"].id)
    assert hali_bor is not None

    # Oddiy roʻyxatda koʻrinmaydi
    royxat = await client.get("/api/v1/school/students", headers=_auth(token))
    assert "Aliyev Ali" not in {s["full_name"] for s in royxat.json()}

    # Arxiv roʻyxatida koʻrinadi
    arxiv = await client.get("/api/v1/school/students?archived=true", headers=_auth(token))
    assert "Aliyev Ali" in {s["full_name"] for s in arxiv.json()}


async def test_arxivlash_sababsiz_bolmaydi(client: AsyncClient, world: dict) -> None:
    """ "Nega ketdi" hisoboti shundan chiqadi."""
    token = await _token(client, "sch.sa")
    resp = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": ""},
    )
    assert resp.status_code == 422


async def test_arxivdan_qaytarish(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.sa")
    yol = f"/api/v1/school/students/{world['ali'].id}"

    await client.post(f"{yol}/archive", headers=_auth(token), json={"reason": "Xato"})
    resp = await client.post(f"{yol}/restore", headers=_auth(token))

    assert resp.status_code == 200
    assert resp.json()["is_archived"] is False


async def test_arxivlash_auditga_sabab_bilan_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 4-qoida."""
    token = await _token(client, "sch.sa")
    await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": "Oilaviy sabab"},
    )

    yozuv = await session.scalar(
        select(AuditLog).where(AuditLog.object_type == "student", AuditLog.action == "archive")
    )
    assert yozuv is not None
    assert yozuv.new_value["reason"] == "Oilaviy sabab"
    assert yozuv.actor_id == world["superadmin"].id
