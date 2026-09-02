"""Oʻquv rejalari (metodik baza) — import/joriy/eksport oqimi."""

import io

import pytest
from httpx import AsyncClient
from openpyxl import Workbook, load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Role, RoleName, User

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(session, roles, names, login, last):  # noqa: ANN001, ANN202
    u = User(
        login=login, password_hash=hash_password(PASSWORD), last_name=last, first_name="Sinov"
    )
    u.roles = [roles[r] for r in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)
    oquv = await _user(session, roles, [RoleName.ACADEMIC.value], "cu.oquv", "Oquvboshi")
    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "cu.ustoz", "Aliyev")
    ota = await _user(session, roles, [RoleName.PARENT.value], "cu.ota", "Karimov")
    return {"oquv": oquv, "ustoz": ustoz, "ota": ota}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


def _xlsx(rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Reja"
    ws.append([
        "Chorak", "Mavzu", "Tur", "Model", "Maqsad", "Lugʻat",
        "Nazariya", "Amaliy", "Uyga vazifa", "Resurslar",
    ])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


async def _import(client, token, fan="Matematika", yil="1-yil", sinf="1-A", rows=None):  # noqa: ANN001, ANN202
    data = _xlsx(
        rows
        if rows is not None
        else [
            [
                1, "Sonlar bilan tanishuv", "qurish", "",
                "Maqsad 1\nMaqsad 2", "Son (Number) — miqdor",
                "Kirish", "Mashq", "5 ta misol", "Doska",
            ],
            [2, "Qo'shish amali", "dasturlash", "", "Maqsad", "", "", "", "", ""],
        ]
    )
    return await client.post(
        "/api/v1/curriculum/import",
        headers=_auth(token),
        data={"fan": fan, "yil": yil, "sinf": sinf},
        files={
            "file": (
                "reja.xlsx",
                data,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )


async def test_shablon_yuklanadi(client: AsyncClient, world: dict) -> None:
    t = await _token(client, "cu.oquv")
    r = await client.get("/api/v1/curriculum/template", headers=_auth(t))
    assert r.status_code == 200, r.text
    wb = load_workbook(io.BytesIO(r.content))
    assert "Reja" in wb.sheetnames and "Yoʻriqnoma" in wb.sheetnames


async def test_import_va_joriy_oqimi(client: AsyncClient, world: dict) -> None:
    t = await _token(client, "cu.oquv")
    r = await _import(client, t)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["plan"]["status"] == "qoralama"
    assert body["plan"]["darslar_soni"] == 2
    plan_id = body["plan"]["id"]

    # Apostrof normalizatsiyasi: Qo'shish -> Qoʻshish
    r = await client.get(f"/api/v1/curriculum/plans/{plan_id}", headers=_auth(t))
    darslar = r.json()["lessons"]
    assert any("Qoʻshish" in d["title"] for d in darslar)

    # Joriy qilinmaguncha ustozga ko'rinmaydi
    ustoz = await _token(client, "cu.ustoz")
    r = await client.get("/api/v1/curriculum/published", headers=_auth(ustoz))
    assert r.json()["fanlar"] == {}

    # Joriy qilish
    r = await client.post(f"/api/v1/curriculum/plans/{plan_id}/publish", headers=_auth(t))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "joriy"

    # Endi ustoz katalog va rejani oladi
    r = await client.get("/api/v1/curriculum/published", headers=_auth(ustoz))
    assert r.json()["fanlar"]["Matematika"]["1-yil"]["1-A"] == 2
    r = await client.get(
        "/api/v1/curriculum/published/plan",
        headers=_auth(ustoz),
        params={"fan": "Matematika", "yil": "1-yil", "sinf": "1-A"},
    )
    assert r.status_code == 200
    assert len(r.json()["lessons"]) == 2


async def test_yangi_joriy_eskisini_arxivlaydi(client: AsyncClient, world: dict) -> None:
    t = await _token(client, "cu.oquv")
    r1 = (await _import(client, t)).json()["plan"]["id"]
    await client.post(f"/api/v1/curriculum/plans/{r1}/publish", headers=_auth(t))
    r2 = (await _import(client, t)).json()["plan"]["id"]
    await client.post(f"/api/v1/curriculum/plans/{r2}/publish", headers=_auth(t))

    r = await client.get("/api/v1/curriculum/plans", headers=_auth(t))
    holatlar = {p["id"]: p["status"] for p in r.json()}
    assert holatlar[r1] == "arxiv"
    assert holatlar[r2] == "joriy"


async def test_import_ogohlantirishlari(client: AsyncClient, world: dict) -> None:
    t = await _token(client, "cu.oquv")
    r = await _import(
        client,
        t,
        rows=[
            [9, "Chorak xato", "yoq-tur", "", "", "", "", "", "", ""],
            [None, "", "", "", "", "", "", "", "", ""],
            [2, "To'g'ri dars", "qurish", "", "", "", "", "", "", ""],
        ],
    )
    assert r.status_code == 201, r.text
    warnings = r.json()["warnings"]
    assert any("chorak" in w for w in warnings)
    assert any("tur" in w for w in warnings)


async def test_eksport_ishlaydi(client: AsyncClient, world: dict) -> None:
    t = await _token(client, "cu.oquv")
    plan_id = (await _import(client, t)).json()["plan"]["id"]
    r = await client.get(f"/api/v1/curriculum/plans/{plan_id}/export", headers=_auth(t))
    assert r.status_code == 200
    wb = load_workbook(io.BytesIO(r.content))
    assert wb["Reja"].max_row == 3  # sarlavha + 2 dars


async def test_ustoz_va_otaona_boshqara_olmaydi(client: AsyncClient, world: dict) -> None:
    """Rol darvozasi: import/joriy faqat o'quv bo'limi/admin."""
    ustoz = await _token(client, "cu.ustoz")
    r = await _import(client, ustoz)
    assert r.status_code == 403, r.text
    assert (
        await client.get("/api/v1/curriculum/plans", headers=_auth(ustoz))
    ).status_code == 403

    # Ota-ona joriy katalogni ham ko'rmasin degan talab yo'q — lekin
    # boshqaruvga kira olmasligi shart.
    ota = await _token(client, "cu.ota")
    assert (
        await client.get("/api/v1/curriculum/template", headers=_auth(ota))
    ).status_code == 403
