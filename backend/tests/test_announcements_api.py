"""Eʼlonlar (T-020, ADM-12).

Asosiy xavf — qamrov: begona sinfning ota-onasi eʼlonni koʻrmasin,
ustoz butun maktabga eʼlon bera olmasin. Shu ikkalasi salbiy testlar
bilan mixlangan.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    Guardian,
    Notification,
    Permission,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
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
    """Ikki sinf, bitta ustoz (5-A da matematika), ikki oila."""
    roles = await _roles(session)

    admin = await _user(session, roles, [RoleName.ADMIN.value], "an.admin", "Adminov")
    session.add(
        UserPermission(user_id=admin.id, permission=Permission.ANNOUNCEMENTS_PUBLISH.value)
    )

    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "an.ustoz", "Aliyev")
    begona = await _user(session, roles, [RoleName.TEACHER.value], "an.begona", "Begonayev")

    ota_a = await _user(session, roles, [RoleName.PARENT.value], "an.ota.a", "Otayev")
    ota_b = await _user(session, roles, [RoleName.PARENT.value], "an.ota.b", "Botayev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf_a = SchoolClass(academic_year_id=year.id, name="5-A")
    sinf_b = SchoolClass(academic_year_id=year.id, name="5-B")
    fan = Subject(name="Matematika")
    session.add_all([sinf_a, sinf_b, fan])
    await session.flush()

    ali = Student(class_id=sinf_a.id, last_name="Aliyev", first_name="Ali")
    vali = Student(class_id=sinf_b.id, last_name="Valiyev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=ota_a.id, relation="father"),
            Guardian(student_id=vali.id, user_id=ota_b.id, relation="father"),
            # Ustoz 5-A da matematika oʻqitadi — jadvaldan.
            ScheduleEntry(
                academic_year_id=year.id,
                class_id=sinf_a.id,
                subject_id=fan.id,
                teacher_id=ustoz.id,
                weekday=1,
                period=1,
            ),
        ]
    )
    await session.commit()
    return {
        "admin": admin,
        "ustoz": ustoz,
        "begona": begona,
        "ota_a": ota_a,
        "ota_b": ota_b,
        "sinf_a": sinf_a,
        "sinf_b": sinf_b,
        "fan": fan,
    }


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ─────────────────── Berish huquqi ───────────────────


async def test_ustoz_oz_sinfiga_elon_beradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "an.ustoz")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={
            "audience": "class",
            "class_id": str(world["sinf_a"].id),
            "title": "Ertaga nazorat ishi",
            "body": "Matematikadan 3-bob boʻyicha.",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["class_names"] == ["5-A"]
    assert r.json()["recipients_count"] == 1  # bitta vasiy


async def test_ustoz_begona_sinfga_elon_berolmaydi(client: AsyncClient, world: dict) -> None:
    """X-2: dars bermaydigan sinfiga — 403."""
    token = await _token(client, "an.ustoz")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={
            "audience": "class",
            "class_id": str(world["sinf_b"].id),
            "title": "Sinov",
            "body": "Sinov matni",
        },
    )
    assert r.status_code == 403, r.text


async def test_ustoz_butun_maktabga_berolmaydi(client: AsyncClient, world: dict) -> None:
    """Butun maktab — faqat `announcements.publish` huquqi bilan."""
    token = await _token(client, "an.ustoz")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={"audience": "school", "title": "Sinov", "body": "Sinov matni"},
    )
    assert r.status_code == 403, r.text


async def test_admin_butun_maktabga_beradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "an.admin")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={"audience": "school", "title": "Taʼtil boshlanishi", "body": "8-noyabrdan."},
    )
    assert r.status_code == 201, r.text
    # Butun maktab: ikkala vasiy ham qamrovda.
    assert r.json()["recipients_count"] == 2
    assert r.json()["class_names"] == []


async def test_fan_elon_faqat_oz_jadvalidagi_sinflarga(
    client: AsyncClient, world: dict
) -> None:
    """`subject` auditoriyasi ustozning jadvalidagi sinflargagina yoyiladi."""
    token = await _token(client, "an.ustoz")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={
            "audience": "subject",
            "subject_id": str(world["fan"].id),
            "title": "Olimpiada",
            "body": "Matematika olimpiadasiga taklif.",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["class_names"] == ["5-A"]  # 5-B ga dars bermaydi

    # Dars bermaydigan ustoz uchun oʻsha fan — 403.
    token = await _token(client, "an.begona")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={
            "audience": "subject",
            "subject_id": str(world["fan"].id),
            "title": "Sinov",
            "body": "Sinov matni",
        },
    )
    assert r.status_code == 403, r.text


# ─────────────────── Koʻrish qamrovi ───────────────────


async def test_ota_faqat_oz_sinf_elonini_koradi(client: AsyncClient, world: dict) -> None:
    """6-qoida ruhi: 5-A eʼloni 5-B otasiga koʻrinmaydi."""
    token = await _token(client, "an.ustoz")
    await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={
            "audience": "class",
            "class_id": str(world["sinf_a"].id),
            "title": "5-A uchun",
            "body": "Sinf yigʻilishi.",
        },
    )

    a = await _token(client, "an.ota.a")
    r = await client.get("/api/v1/announcements", headers=_auth(a))
    assert [x["title"] for x in r.json()] == ["5-A uchun"]

    b = await _token(client, "an.ota.b")
    r = await client.get("/api/v1/announcements", headers=_auth(b))
    assert r.json() == []


async def test_maktab_eloni_hammaga_korinadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "an.admin")
    await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={"audience": "school", "title": "Umumiy", "body": "Hammaga."},
    )
    for login in ("an.ota.a", "an.ota.b"):
        t = await _token(client, login)
        r = await client.get("/api/v1/announcements", headers=_auth(t))
        assert [x["title"] for x in r.json()] == ["Umumiy"], login


async def test_bildirishnoma_yaratiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Eʼlon qoʻngʻiroqqa ham tushadi — kabinetga kirmagan ota koʻradi."""
    token = await _token(client, "an.ustoz")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={
            "audience": "class",
            "class_id": str(world["sinf_a"].id),
            "title": "Yigʻilish",
            "body": "Juma kuni 18:00 da.",
        },
    )
    assert r.status_code == 201

    rows = (
        (
            await session.execute(
                select(Notification).where(Notification.kind == "announcement")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert rows[0].user_id == world["ota_a"].id
    assert rows[0].section == "/ota-ona/elonlar"


# ─────────────────── Oldindan koʻrish va arxiv ───────────────────


async def test_preview_yuborishdan_oldin(client: AsyncClient, world: dict) -> None:
    """ADM-12 mezoni: son yuborishdan OLDIN, hech narsa yozilmasdan."""
    token = await _token(client, "an.ustoz")
    r = await client.get(
        f"/api/v1/announcements/preview?audience=class&class_id={world['sinf_a'].id}",
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["recipients"] == 1

    r = await client.get("/api/v1/announcements", headers=_auth(token))
    assert r.json() == []  # preview hech narsa yaratmagan


async def test_targets_jadvaldan(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "an.ustoz")
    r = await client.get("/api/v1/announcements/targets", headers=_auth(token))
    assert [c["name"] for c in r.json()["classes"]] == ["5-A"]
    assert [s["name"] for s in r.json()["subjects"]] == ["Matematika"]


async def test_arxivlash_faqat_muallif_yoki_rahbariyat(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "an.ustoz")
    r = await client.post(
        "/api/v1/announcements",
        headers=_auth(token),
        json={
            "audience": "class",
            "class_id": str(world["sinf_a"].id),
            "title": "Olib tashlanadigan",
            "body": "Sinov.",
        },
    )
    ann_id = r.json()["id"]

    begona = await _token(client, "an.begona")
    r = await client.post(
        f"/api/v1/announcements/{ann_id}/archive", headers=_auth(begona)
    )
    assert r.status_code == 403, r.text

    r = await client.post(f"/api/v1/announcements/{ann_id}/archive", headers=_auth(token))
    assert r.status_code == 200, r.text

    # Arxivlangan eʼlon roʻyxatdan yoʻqoladi.
    a = await _token(client, "an.ota.a")
    r = await client.get("/api/v1/announcements", headers=_auth(a))
    assert r.json() == []
