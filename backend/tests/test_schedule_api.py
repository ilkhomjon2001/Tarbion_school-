"""Dars jadvali va xodim yaratish (T-011, T-008 xodim qismi).

Eng muhim testlar:
  · band ustozni qoʻshishga urinish → 409 va qaysi sinf bilan toʻqnashgani
  · bir sinfda bir vaqtda ikkita dars boʻlmaydi
  · jadvaldan chiqarilgan yozuv OʻCHMAYDI, arxivlanadi (1-qoida)
  · huquqsiz administrator jadval tuza olmaydi (T-005)
  · yangi xodim paroli javobda BIR MARTA qaytadi
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    Permission,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
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

    superadmin = await _user(session, roles, [RoleName.SUPERADMIN.value], "sd.sa", "Boshqaruv")
    admin = await _user(session, roles, [RoleName.ADMIN.value], "sd.admin", "Adminov")
    plain = await _user(session, roles, [RoleName.ADMIN.value], "sd.admin2", "Nosirov")
    ustoz_a = await _user(session, roles, [RoleName.TEACHER.value], "sd.ustoz_a", "Aliyev")
    ustoz_b = await _user(session, roles, [RoleName.TEACHER.value], "sd.ustoz_b", "Valiyev")

    aktor = CurrentUser.from_model(superadmin)
    for huquq in (
        Permission.SCHEDULE_MANAGE,
        Permission.USERS_CREATE,
        Permission.USERS_MANAGE,
        Permission.USERS_RESET_PASSWORD,
    ):
        await permissions.grant(
            session, target_user_id=admin.id, permission=huquq, granted_by=aktor
        )
    await session.flush()

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    fizika = Subject(name="Fizika", short_name="Fiz")
    session.add_all([math, fizika])
    await session.flush()

    class_a = SchoolClass(academic_year_id=year.id, name="8-A")
    class_b = SchoolClass(academic_year_id=year.id, name="8-B")
    session.add_all([class_a, class_b])
    await session.flush()

    return {
        "superadmin": superadmin,
        "admin": admin,
        "plain": plain,
        "ustoz_a": ustoz_a,
        "ustoz_b": ustoz_b,
        "year": year,
        "math": math,
        "fizika": fizika,
        "class_a": class_a,
        "class_b": class_b,
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _dars(world: dict, **farq: object) -> dict[str, object]:
    body = {
        "class_id": str(world["class_a"].id),
        "subject_id": str(world["math"].id),
        "teacher_id": str(world["ustoz_a"].id),
        "weekday": 1,
        "period": 1,
        "room": "204",
    }
    body.update({k: str(v) if hasattr(v, "hex") else v for k, v in farq.items()})
    return body


# ─────────────────────────── Jadval ───────────────────────────


async def test_jadvalga_dars_qoshiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    resp = await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    assert resp.status_code == 201, resp.text

    body = resp.json()
    assert body["class_name"] == "8-A"
    assert body["subject_name"] == "Matematika"
    assert body["teacher_name"] == "Aliyev Sinov"
    assert body["room"] == "204"


async def test_band_ustoz_409(client: AsyncClient, world: dict) -> None:
    """T-011 qabul mezoni: qaysi sinf bilan toʻqnashgani xabarda boʻlsin."""
    token = await _token(client, "sd.admin")
    assert (
        await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    ).status_code == 201

    # Ayni ustoz, ayni vaqt — lekin boshqa sinf va boshqa xona.
    resp = await client.post(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        json=_dars(world, class_id=world["class_b"].id, subject_id=world["fizika"].id, room="301"),
    )
    assert resp.status_code == 409, resp.text
    xabar = resp.json()["message"]
    assert "Aliyev" in xabar
    assert "8-A" in xabar, "toʻqnashgan sinf xabarda koʻrsatilmagan"


async def test_band_sinf_409(client: AsyncClient, world: dict) -> None:
    """Bir sinfda bir vaqtda ikkita dars boʻlmaydi."""
    token = await _token(client, "sd.admin")
    await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))

    resp = await client.post(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        json=_dars(
            world,
            subject_id=world["fizika"].id,
            teacher_id=world["ustoz_b"].id,
            room="301",
        ),
    )
    assert resp.status_code == 409, resp.text
    assert "8-A" in resp.json()["message"]


async def test_band_xona_409(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))

    resp = await client.post(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        json=_dars(
            world,
            class_id=world["class_b"].id,
            subject_id=world["fizika"].id,
            teacher_id=world["ustoz_b"].id,
            room="204",
        ),
    )
    assert resp.status_code == 409, resp.text
    assert "204" in resp.json()["message"]


async def test_boshqa_parada_toqnashuv_yoq(client: AsyncClient, world: dict) -> None:
    """Toʻqnashuv faqat AYNI para uchun — 2-parada oʻsha ustoz boʻsh."""
    token = await _token(client, "sd.admin")
    await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))

    resp = await client.post(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        json=_dars(world, class_id=world["class_b"].id, period=2, room="301"),
    )
    assert resp.status_code == 201, resp.text


async def test_jadval_sinf_va_ustoz_kesimida(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    await client.post(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        json=_dars(
            world,
            class_id=world["class_b"].id,
            subject_id=world["fizika"].id,
            teacher_id=world["ustoz_b"].id,
            period=2,
            room="301",
        ),
    )

    resp = await client.get(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        params={"class_id": str(world["class_a"].id)},
    )
    assert [r["class_name"] for r in resp.json()] == ["8-A"]

    resp = await client.get(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        params={"teacher_id": str(world["ustoz_b"].id)},
    )
    assert [r["teacher_name"] for r in resp.json()] == ["Valiyev Sinov"]


async def test_ustozni_almashtirish(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    yaratildi = await client.post(
        "/api/v1/schedule/entries", headers=_auth(token), json=_dars(world)
    )
    entry_id = yaratildi.json()["id"]

    resp = await client.patch(
        f"/api/v1/schedule/entries/{entry_id}",
        headers=_auth(token),
        json={"teacher_id": str(world["ustoz_b"].id)},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["teacher_name"] == "Valiyev Sinov"


async def test_almashtirishda_ham_toqnashuv_tekshiriladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    ikkinchi = await client.post(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        json=_dars(
            world,
            class_id=world["class_b"].id,
            subject_id=world["fizika"].id,
            teacher_id=world["ustoz_b"].id,
            room="301",
        ),
    )
    assert ikkinchi.status_code == 201, ikkinchi.text

    # Ikkinchi darsga birinchi darsning ustozini qoʻyish — u band.
    resp = await client.patch(
        f"/api/v1/schedule/entries/{ikkinchi.json()['id']}",
        headers=_auth(token),
        json={"teacher_id": str(world["ustoz_a"].id)},
    )
    assert resp.status_code == 409, resp.text


async def test_jadvaldan_chiqarilgan_yozuv_arxivlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 1-qoida: oʻchirilmaydi."""
    token = await _token(client, "sd.admin")
    entry_id = (
        await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    ).json()["id"]

    resp = await client.post(f"/api/v1/schedule/entries/{entry_id}/archive", headers=_auth(token))
    assert resp.status_code == 204

    barchasi = (await session.execute(select(ScheduleEntry))).scalars().all()
    assert len(barchasi) == 1, "yozuv oʻchirilgan — 1-qoida buzildi"
    assert barchasi[0].is_archived is True

    resp = await client.get("/api/v1/schedule/entries", headers=_auth(token))
    assert resp.json() == []


async def test_chiqarilgandan_keyin_joy_bosh(client: AsyncClient, world: dict) -> None:
    """Arxivlangan yozuv toʻqnashuv hisoblanmaydi."""
    token = await _token(client, "sd.admin")
    entry_id = (
        await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    ).json()["id"]
    await client.post(f"/api/v1/schedule/entries/{entry_id}/archive", headers=_auth(token))

    resp = await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    assert resp.status_code == 201, resp.text


async def test_yuklama_jadvaldan_hisoblanadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    await client.post(
        "/api/v1/schedule/entries",
        headers=_auth(token),
        json=_dars(world, class_id=world["class_b"].id, period=2, room="301"),
    )

    resp = await client.get("/api/v1/schedule/load", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    aliyev = next(r for r in resp.json() if r["full_name"] == "Aliyev Sinov")
    assert aliyev["weekly_hours"] == 2
    assert sorted(aliyev["classes"]) == ["8-A", "8-B"]


async def test_notogri_para_422(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    resp = await client.post(
        "/api/v1/schedule/entries", headers=_auth(token), json=_dars(world, period=99)
    )
    assert resp.status_code == 422


async def test_huquqsiz_admin_jadval_tuza_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin2")
    resp = await client.post("/api/v1/schedule/entries", headers=_auth(token), json=_dars(world))
    assert resp.status_code == 403, resp.text


async def test_huquqsiz_admin_jadvalni_koradi(client: AsyncClient, world: dict) -> None:
    """Jadval maktabda devorga osiladi — oʻqish ochiq."""
    token = await _token(client, "sd.admin2")
    resp = await client.get("/api/v1/schedule/entries", headers=_auth(token))
    assert resp.status_code == 200


# ─────────────────────────── Xodim yaratish ───────────────────────────


async def test_yangi_xodim_login_va_parol_oladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    resp = await client.post(
        "/api/v1/school/staff",
        headers=_auth(token),
        json={
            "last_name": "Karimov",
            "first_name": "Bobur",
            "roles": ["teacher"],
            "subject_ids": [str(world["math"].id)],
        },
    )
    assert resp.status_code == 201, resp.text

    body = resp.json()
    assert body["login"] == "karimov.bobur"
    assert len(body["initial_password"]) == 5
    assert body["initial_password"].isdigit()


async def test_yangi_xodim_darhol_kira_oladi(client: AsyncClient, world: dict) -> None:
    """Yaratilgan parol haqiqatan ishlaydi — aks holda hisob foydasiz."""
    token = await _token(client, "sd.admin")
    yaratildi = (
        await client.post(
            "/api/v1/school/staff",
            headers=_auth(token),
            json={"last_name": "Karimov", "first_name": "Bobur", "roles": ["teacher"]},
        )
    ).json()

    resp = await client.post(
        "/api/v1/auth/login",
        json={"login": yaratildi["login"], "password": yaratildi["initial_password"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["user"]["must_change_password"] is True


async def test_xodim_royxatida_fani_bilan_chiqadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    await client.post(
        "/api/v1/school/staff",
        headers=_auth(token),
        json={
            "last_name": "Karimov",
            "first_name": "Bobur",
            "roles": ["teacher"],
            "subject_ids": [str(world["math"].id)],
        },
    )

    resp = await client.get("/api/v1/school/staff", headers=_auth(token))
    yangi = next(s for s in resp.json() if s["login"] == "karimov.bobur")
    assert yangi["subjects"] == ["Matematika"]
    assert yangi["roles"] == ["teacher"]


async def test_ustozga_fan_biriktiriladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    resp = await client.put(
        f"/api/v1/school/staff/{world['ustoz_a'].id}/subjects",
        headers=_auth(token),
        json={"subject_ids": [str(world["math"].id), str(world["fizika"].id)]},
    )
    assert resp.status_code == 204, resp.text

    resp = await client.get("/api/v1/school/staff", headers=_auth(token))
    aliyev = next(s for s in resp.json() if s["login"] == "sd.ustoz_a")
    assert aliyev["subjects"] == ["Fizika", "Matematika"]


async def test_olib_tashlangan_fan_arxivlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """1-qoida: biriktirish oʻchmaydi — oʻtgan baho unga bogʻlangan."""
    token = await _token(client, "sd.admin")
    url = f"/api/v1/school/staff/{world['ustoz_a'].id}/subjects"

    await client.put(
        url,
        headers=_auth(token),
        json={"subject_ids": [str(world["math"].id), str(world["fizika"].id)]},
    )
    await client.put(url, headers=_auth(token), json={"subject_ids": [str(world["math"].id)]})

    rows = (
        (
            await session.execute(
                select(TeacherSubject).where(TeacherSubject.teacher_id == world["ustoz_a"].id)
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2, "biriktirish oʻchirilgan — 1-qoida buzildi"
    assert sum(1 for r in rows if r.is_archived) == 1


async def test_parol_tiklanadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin")
    resp = await client.post(
        f"/api/v1/school/staff/{world['ustoz_a'].id}/reset-password", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text
    yangi = resp.json()["new_password"]

    resp = await client.post("/api/v1/auth/login", json={"login": "sd.ustoz_a", "password": yangi})
    assert resp.status_code == 200, resp.text


async def test_huquqsiz_admin_xodim_yarata_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sd.admin2")
    resp = await client.post(
        "/api/v1/school/staff",
        headers=_auth(token),
        json={"last_name": "Karimov", "first_name": "Bobur", "roles": ["teacher"]},
    )
    assert resp.status_code == 403, resp.text


async def test_admin_superadmin_yarata_olmaydi(client: AsyncClient, world: dict) -> None:
    """Aks holda `users.create` huquqi butun cheklovni aylanib oʻtardi."""
    token = await _token(client, "sd.admin")
    resp = await client.post(
        "/api/v1/school/staff",
        headers=_auth(token),
        json={"last_name": "Karimov", "first_name": "Bobur", "roles": ["superadmin"]},
    )
    assert resp.status_code == 422, resp.text


async def test_otaona_roli_xodim_royxatiga_tushmaydi(client: AsyncClient, world: dict) -> None:
    """Bu XODIMLAR endpointi — ota-ona hisobi bu yerdan ochilmaydi."""
    token = await _token(client, "sd.admin")
    resp = await client.post(
        "/api/v1/school/staff",
        headers=_auth(token),
        json={"last_name": "Karimov", "first_name": "Bobur", "roles": ["parent"]},
    )
    assert resp.status_code == 422, resp.text


async def test_xodim_arxivlanadi(client: AsyncClient, world: dict, session: AsyncSession) -> None:
    token = await _token(client, "sd.admin")
    resp = await client.post(
        f"/api/v1/school/staff/{world['ustoz_b'].id}/archive", headers=_auth(token)
    )
    assert resp.status_code == 204, resp.text

    xodim = await session.get(User, world["ustoz_b"].id)
    assert xodim is not None, "hisob oʻchirilgan — 1-qoida buzildi"
    assert xodim.is_archived is True
    assert xodim.is_active is False
