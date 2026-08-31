"""Oʻquv yili, chorak, taʼtil, qoʻngʻiroq (T-007).

Eng muhim testlar:
  · faqat bitta oʻquv yili "joriy" boʻla oladi
  · choraklar sanasi qoplansa → 409
  · huquqsiz administrator yoza olmaydi (T-005)
  · roʻyxatdan chiqarilgan chorak OʻCHMAYDI, arxivlanadi (1-qoida)
"""

from datetime import date, time

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import AcademicYear, BellSchedule, Permission, Role, RoleName, Term, User
from app.services import permissions
from app.services.access import CurrentUser

PASSWORD = "Sinov12345!"  # noqa: S106

YEAR_START = date(2026, 9, 1)
YEAR_END = date(2027, 5, 25)


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

    superadmin = await _user(session, roles, [RoleName.SUPERADMIN.value], "ac.sa", "Boshqaruv")
    admin = await _user(session, roles, [RoleName.ADMIN.value], "ac.admin", "Adminov")
    plain = await _user(session, roles, [RoleName.ADMIN.value], "ac.admin2", "Nosirov")

    # Faqat BIRINCHI administratorga huquq beriladi — ikkinchisi nazorat guruhi.
    await permissions.grant(
        session,
        target_user_id=admin.id,
        permission=Permission.SCHEDULE_MANAGE,
        granted_by=CurrentUser.from_model(superadmin),
    )
    await session.flush()

    year = AcademicYear(name="2026-2027", starts_on=YEAR_START, ends_on=YEAR_END, is_current=True)
    session.add(year)
    await session.flush()

    return {"superadmin": superadmin, "admin": admin, "plain": plain, "year": year}


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────── Oʻquv yili ───────────────────────────


async def test_joriy_yil_qaytadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.get("/api/v1/academic/years/current", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "2026-2027"
    assert resp.json()["is_current"] is True


async def test_faqat_bitta_yil_joriy(client: AsyncClient, world: dict) -> None:
    """T-007 qabul mezoni: yangisi joriy boʻlsa, eskisi tushadi."""
    token = await _token(client, "ac.admin")
    resp = await client.post(
        "/api/v1/academic/years",
        headers=_auth(token),
        json={
            "name": "2027-2028",
            "starts_on": "2027-09-01",
            "ends_on": "2028-05-25",
            "make_current": True,
        },
    )
    assert resp.status_code == 201, resp.text

    resp = await client.get("/api/v1/academic/years", headers=_auth(token))
    joriy = [y for y in resp.json() if y["is_current"]]
    assert len(joriy) == 1
    assert joriy[0]["name"] == "2027-2028"


async def test_yil_sanasi_teskari_bolsa_xato(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.post(
        "/api/v1/academic/years",
        headers=_auth(token),
        json={"name": "2028-2029", "starts_on": "2029-05-25", "ends_on": "2028-09-01"},
    )
    assert resp.status_code == 422


async def test_takroriy_yil_nomi_409(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.post(
        "/api/v1/academic/years",
        headers=_auth(token),
        json={"name": "2026-2027", "starts_on": "2026-09-01", "ends_on": "2027-05-25"},
    )
    assert resp.status_code == 409


# ─────────────────────────── Choraklar ───────────────────────────


def _chorak(index: int, start: str, end: str) -> dict[str, object]:
    return {"index": index, "name": f"{index}-chorak", "starts_on": start, "ends_on": end}


async def test_choraklar_yoziladi_va_oqiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    year_id = world["year"].id

    resp = await client.put(
        f"/api/v1/academic/years/{year_id}/terms",
        headers=_auth(token),
        json={
            "terms": [
                _chorak(1, "2026-09-01", "2026-10-30"),
                _chorak(2, "2026-11-09", "2026-12-28"),
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    assert [t["index"] for t in resp.json()] == [1, 2]

    resp = await client.get(f"/api/v1/academic/years/{year_id}/terms", headers=_auth(token))
    assert len(resp.json()) == 2


async def test_choraklar_qoplansa_409(client: AsyncClient, world: dict) -> None:
    """Bir-birini qoplagan sanalar bazaga tushmasin."""
    token = await _token(client, "ac.admin")
    resp = await client.put(
        f"/api/v1/academic/years/{world['year'].id}/terms",
        headers=_auth(token),
        json={
            "terms": [
                _chorak(1, "2026-09-01", "2026-11-15"),
                _chorak(2, "2026-11-09", "2026-12-28"),
            ]
        },
    )
    assert resp.status_code == 409, resp.text
    assert "qoplan" in resp.json()["message"]


async def test_chorak_yil_chegarasidan_chiqmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.put(
        f"/api/v1/academic/years/{world['year'].id}/terms",
        headers=_auth(token),
        json={"terms": [_chorak(1, "2026-08-01", "2026-10-30")]},
    )
    assert resp.status_code == 422, resp.text


async def test_royxatdan_chiqqan_chorak_arxivlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 1-qoida: oʻchirilmaydi."""
    token = await _token(client, "ac.admin")
    year_id = world["year"].id

    await client.put(
        f"/api/v1/academic/years/{year_id}/terms",
        headers=_auth(token),
        json={
            "terms": [
                _chorak(1, "2026-09-01", "2026-10-30"),
                _chorak(2, "2026-11-09", "2026-12-28"),
            ]
        },
    )
    resp = await client.put(
        f"/api/v1/academic/years/{year_id}/terms",
        headers=_auth(token),
        json={"terms": [_chorak(1, "2026-09-01", "2026-10-30")]},
    )
    assert resp.status_code == 200
    assert [t["index"] for t in resp.json()] == [1]

    barchasi = (
        (await session.execute(select(Term).where(Term.academic_year_id == year_id)))
        .scalars()
        .all()
    )
    assert len(barchasi) == 2, "yozuv oʻchirilgan — 1-qoida buzildi"
    assert {t.index: t.is_archived for t in barchasi} == {1: False, 2: True}


# ─────────────────────────── Taʼtillar ───────────────────────────


async def test_tatil_qoshiladi_va_arxivlanadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    year_id = world["year"].id

    resp = await client.post(
        f"/api/v1/academic/years/{year_id}/holidays",
        headers=_auth(token),
        json={"day": "2026-12-31", "title": "Yangi yil"},
    )
    assert resp.status_code == 201, resp.text
    holiday_id = resp.json()["id"]

    resp = await client.post(
        f"/api/v1/academic/holidays/{holiday_id}/archive", headers=_auth(token)
    )
    assert resp.status_code == 200

    resp = await client.get(f"/api/v1/academic/years/{year_id}/holidays", headers=_auth(token))
    assert resp.json() == []


async def test_takroriy_tatil_409(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    year_id = world["year"].id
    body = {"day": "2026-12-31", "title": "Yangi yil"}

    assert (
        await client.post(
            f"/api/v1/academic/years/{year_id}/holidays", headers=_auth(token), json=body
        )
    ).status_code == 201
    resp = await client.post(
        f"/api/v1/academic/years/{year_id}/holidays", headers=_auth(token), json=body
    )
    assert resp.status_code == 409


async def test_tatil_yil_chegarasida_boladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.post(
        f"/api/v1/academic/years/{world['year'].id}/holidays",
        headers=_auth(token),
        json={"day": "2027-08-15", "title": "Yozgi taʼtil"},
    )
    assert resp.status_code == 422


# ─────────────────────── Qoʻngʻiroqlar jadvali ───────────────────────


def _para(period: int, start: str, end: str) -> dict[str, object]:
    return {"period": period, "starts_at": start, "ends_at": end}


async def test_qongiroq_jadvali_yoziladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.put(
        f"/api/v1/academic/years/{world['year'].id}/bells",
        headers=_auth(token),
        json={"bells": [_para(1, "08:30", "09:15"), _para(2, "09:25", "10:10")]},
    )
    assert resp.status_code == 200, resp.text
    assert [b["period"] for b in resp.json()] == [1, 2]
    assert resp.json()[0]["starts_at"] == "08:30:00"


async def test_para_vaqti_qoplansa_409(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.put(
        f"/api/v1/academic/years/{world['year'].id}/bells",
        headers=_auth(token),
        json={"bells": [_para(1, "08:30", "09:30"), _para(2, "09:25", "10:10")]},
    )
    assert resp.status_code == 409, resp.text


async def test_para_vaqti_teskari_bolsa_422(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ac.admin")
    resp = await client.put(
        f"/api/v1/academic/years/{world['year'].id}/bells",
        headers=_auth(token),
        json={"bells": [_para(1, "09:15", "08:30")]},
    )
    assert resp.status_code == 422


async def test_chiqarilgan_para_arxivlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "ac.admin")
    year_id = world["year"].id

    await client.put(
        f"/api/v1/academic/years/{year_id}/bells",
        headers=_auth(token),
        json={"bells": [_para(1, "08:30", "09:15"), _para(2, "09:25", "10:10")]},
    )
    await client.put(
        f"/api/v1/academic/years/{year_id}/bells",
        headers=_auth(token),
        json={"bells": [_para(1, "08:30", "09:15")]},
    )

    barchasi = (
        (
            await session.execute(
                select(BellSchedule).where(BellSchedule.academic_year_id == year_id)
            )
        )
        .scalars()
        .all()
    )
    assert len(barchasi) == 2
    assert {b.period: b.is_archived for b in barchasi} == {1: False, 2: True}


async def test_para_vaqti_mahalliy_saqlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 3-qoida: bu kun ichidagi jadval, UTC ga surilmaydi."""
    token = await _token(client, "ac.admin")
    await client.put(
        f"/api/v1/academic/years/{world['year'].id}/bells",
        headers=_auth(token),
        json={"bells": [_para(1, "08:30", "09:15")]},
    )
    row = await session.scalar(select(BellSchedule).where(BellSchedule.period == 1))
    assert row is not None
    assert row.starts_at == time(8, 30)


# ─────────────────────── Huquq nazorati (T-005) ───────────────────────


async def test_huquqsiz_admin_yoza_olmaydi(client: AsyncClient, world: dict) -> None:
    """Administrator ROLI yolgʻiz yetarli emas — `schedule.manage` kerak."""
    token = await _token(client, "ac.admin2")
    resp = await client.post(
        "/api/v1/academic/years",
        headers=_auth(token),
        json={"name": "2028-2029", "starts_on": "2028-09-01", "ends_on": "2029-05-25"},
    )
    assert resp.status_code == 403, resp.text


async def test_huquqsiz_admin_oqiy_oladi(client: AsyncClient, world: dict) -> None:
    """Chorak sanasi maxfiy emas — oʻqish ochiq."""
    token = await _token(client, "ac.admin2")
    resp = await client.get("/api/v1/academic/years", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_superadmin_huquqsiz_ham_yozadi(client: AsyncClient, world: dict) -> None:
    """Superadministratorga huquq alohida berilmaydi — u hammasiga ega."""
    token = await _token(client, "ac.sa")
    resp = await client.put(
        f"/api/v1/academic/years/{world['year'].id}/bells",
        headers=_auth(token),
        json={"bells": [_para(1, "08:30", "09:15")]},
    )
    assert resp.status_code == 200, resp.text


async def test_kirmagan_foydalanuvchi_401(client: AsyncClient, world: dict) -> None:
    resp = await client.get("/api/v1/academic/years")
    assert resp.status_code == 401
