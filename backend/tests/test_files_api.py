"""Fayl saqlash va imzolangan havola (MET-03, NFR-11, X-7).

Eng muhim tekshiruv — havolani QALBAKILASHTIRIB boʻlmasligi. Yuklab
olish endpointi tokensiz ishlaydi (brauzer `<a href>` ga sarlavha
qoʻsha olmaydi), shuning uchun butun himoya HMAC imzoda.
"""

import uuid
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import AuditLog, Role, RoleName, User
from app.services import storage

PASSWORD = "Sinov12345!"  # noqa: S106

#: Eng kichik yaroqli PNG — haqiqiy bayt, soxta emas.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
    "de0000000c4944415408d763f8ffff3f0005fe02fea735c2570000000049454e44ae426082"
)


@pytest.fixture(autouse=True)
def _vaqtinchalik_katalog(tmp_path: Path) -> None:
    """Test fayllari repoga tushib qolmasin."""
    settings.file_storage_dir = str(tmp_path / "files")


@pytest.fixture
async def foydalanuvchi(session: AsyncSession) -> User:
    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    u = User(
        login="fl.ustoz",
        password_hash=hash_password(PASSWORD),
        last_name="Aliyev",
        first_name="Sinov",
    )
    u.roles = [roles[RoleName.TEACHER.value]]
    session.add(u)
    await session.commit()
    return u


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _yukla(
    client: AsyncClient, token: str, *, name: str = "reja.png", data: bytes = PNG
):
    return await client.post(
        "/api/v1/files",
        headers=_auth(token),
        files={"file": (name, data, "image/png")},
    )


async def test_fayl_yuklanadi_va_havola_ishlaydi(
    client: AsyncClient, foydalanuvchi: User
) -> None:
    token = await _token(client, "fl.ustoz")
    r = await _yukla(client, token)
    assert r.status_code == 201, r.text

    data = r.json()
    assert data["name"] == "reja.png"
    assert data["size_bytes"] == len(PNG)
    assert "sig=" in data["url"]

    # Havola TOKENSIZ ochiladi — imzoning oʻzi kalit (X-7).
    yuklab = await client.get(data["url"])
    assert yuklab.status_code == 200
    assert yuklab.content == PNG
    assert yuklab.headers["cache-control"] == "private, no-store"


async def test_imzosiz_yuklab_olib_bolmaydi(
    client: AsyncClient, foydalanuvchi: User
) -> None:
    token = await _token(client, "fl.ustoz")
    r = await _yukla(client, token)
    fayl_id = r.json()["id"]

    yuklab = await client.get(f"/api/v1/files/{fayl_id}/download")
    assert yuklab.status_code == 422  # `exp` va `sig` majburiy


async def test_qalbaki_imzo_404(client: AsyncClient, foydalanuvchi: User) -> None:
    """«Imzo notoʻgʻri» deyilmaydi — havolani tanlab koʻrishga yordam berardi."""
    token = await _token(client, "fl.ustoz")
    r = await _yukla(client, token)
    fayl_id = r.json()["id"]

    muddat = int(utcnow().timestamp()) + 900
    yuklab = await client.get(
        f"/api/v1/files/{fayl_id}/download",
        params={"exp": muddat, "sig": "a" * 64},
    )
    assert yuklab.status_code == 404


async def test_muddati_otgan_havola_ishlamaydi(
    client: AsyncClient, foydalanuvchi: User
) -> None:
    token = await _token(client, "fl.ustoz")
    r = await _yukla(client, token)
    fayl_id = uuid.UUID(r.json()["id"])

    otgan = int(utcnow().timestamp()) - 1
    imzo = storage._signature(fayl_id, otgan)  # noqa: SLF001 — imzo mantigʻi sinovda
    yuklab = await client.get(
        f"/api/v1/files/{fayl_id}/download", params={"exp": otgan, "sig": imzo}
    )
    assert yuklab.status_code == 404


async def test_boshqa_faylning_imzosi_ishlamaydi(
    client: AsyncClient, foydalanuvchi: User
) -> None:
    """Imzo `file_id` ni ham qamraydi — bittasini olib boshqasiga qoʻyib boʻlmaydi."""
    token = await _token(client, "fl.ustoz")
    birinchi = (await _yukla(client, token, name="bir.png")).json()
    ikkinchi = (await _yukla(client, token, name="ikki.png")).json()

    imzo = birinchi["url"].split("sig=")[1]
    muddat = birinchi["url"].split("exp=")[1].split("&")[0]
    yuklab = await client.get(
        f"/api/v1/files/{ikkinchi['id']}/download",
        params={"exp": muddat, "sig": imzo},
    )
    assert yuklab.status_code == 404


async def test_ruxsatsiz_tur_qabul_qilinmaydi(
    client: AsyncClient, foydalanuvchi: User
) -> None:
    """`.svg` va `.html` ataylab yoʻq — ular brauzerda skript bajaradi."""
    token = await _token(client, "fl.ustoz")
    r = await _yukla(client, token, name="hujum.svg", data=b"<svg onload=alert(1)>")
    assert r.status_code == 422


async def test_tokensiz_yuklab_bolmaydi(client: AsyncClient) -> None:
    r = await client.post(
        "/api/v1/files", files={"file": ("reja.png", PNG, "image/png")}
    )
    assert r.status_code == 401


async def test_yollarni_kesib_otuvchi_nom_zararsizlantiriladi(
    client: AsyncClient, foydalanuvchi: User
) -> None:
    token = await _token(client, "fl.ustoz")
    r = await _yukla(client, token, name="../../etc/passwd.png")
    assert r.status_code == 201
    assert "/" not in r.json()["name"]
    assert ".." not in r.json()["name"]


async def test_fayl_yuklash_auditga_tushadi(
    client: AsyncClient, foydalanuvchi: User, session: AsyncSession
) -> None:
    token = await _token(client, "fl.ustoz")
    await _yukla(client, token)

    rows = (
        (await session.execute(select(AuditLog).where(AuditLog.object_type == "file")))
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert rows[0].new_value["name"] == "reja.png"


async def test_bosh_fayl_qabul_qilinmaydi(
    client: AsyncClient, foydalanuvchi: User
) -> None:
    token = await _token(client, "fl.ustoz")
    r = await _yukla(client, token, data=b"")
    assert r.status_code == 422
