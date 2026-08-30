"""Huquqlar markazi (T-005).

Super administrator RAHBAR EMAS — u tizimni sozlaydi: kim nimani
koʻradi va kim nima qila oladi.

Bu fayldagi eng muhim testlar — huquq oshirishga urinishlar:
  · huquqsiz admin boshqaning huquqini oʻzgartira olmaydi
  · `permissions.grant` bori ham boshqaga `permissions.grant` BERA olmaydi
  · superadminni cheklab boʻlmaydi
  · rahbariyat huquq markaziga umuman kira olmaydi
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sections import SECTIONS, effective_sections, role_default_sections
from app.core.security import hash_password
from app.models import AuditLog, Permission, Role, RoleName, User
from app.services import permissions
from app.services.access import CurrentUser

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(
    session: AsyncSession, roles: dict[str, Role], role_names: list[str], login: str
) -> User:
    user = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinov",
        first_name=login.split(".")[-1].capitalize(),
    )
    user.roles = [roles[r] for r in role_names]
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, object]:
    roles = await _roles(session)
    return {
        "superadmin": await _user(session, roles, [RoleName.SUPERADMIN.value], "acc.superadmin"),
        "admin": await _user(session, roles, [RoleName.ADMIN.value], "acc.admin"),
        "admin2": await _user(session, roles, [RoleName.ADMIN.value], "acc.admin2"),
        "director": await _user(session, roles, [RoleName.DIRECTOR.value], "acc.direktor"),
        "teacher": await _user(session, roles, [RoleName.TEACHER.value], "acc.ustoz"),
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────── Boʻlim hisobi (sof mantiq) ───────────────────────


def test_rol_standarti_oz_kabineti_bilan_cheklangan() -> None:
    ustoz = role_default_sections({RoleName.TEACHER.value})
    assert all(s.startswith("/teacher") for s in ustoz)
    assert "/admin/sozlamalar" not in ustoz


def test_superadmin_barcha_bolimlarni_koradi() -> None:
    sa = role_default_sections({RoleName.SUPERADMIN.value})
    assert len(sa) == len(SECTIONS)
    assert "/admin/sozlamalar" in sa


def test_kabinet_boshi_ochirib_bolmaydi() -> None:
    """Boʻsh roʻyxat berilsa ham odam oʻz kabinetiga kira olishi kerak."""
    natija = effective_sections({RoleName.TEACHER.value}, [])
    assert natija == ["/teacher"]


def test_superadmin_bolimi_boshqa_rolga_otmaydi() -> None:
    """Qoʻlda yoqib qoʻyilsa ham `/admin/sozlamalar` adminga oʻtmaydi."""
    natija = effective_sections({RoleName.ADMIN.value}, ["/admin", "/admin/sozlamalar"])
    assert "/admin/sozlamalar" not in natija


def test_nomalum_bolim_tashlab_yuboriladi() -> None:
    """Eski istisnoda oʻchirilgan boʻlim qolsa, u jimgina tushiriladi."""
    natija = effective_sections({RoleName.TEACHER.value}, ["/teacher", "/eski/bolim"])
    assert natija == ["/teacher"]


def test_sinf_rahbari_ustoz_kabinetida() -> None:
    natija = role_default_sections({RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value})
    assert "/teacher/jurnal" in natija


# ─────────────────────── Kim boshqara oladi ───────────────────────


async def test_rahbariyat_huquq_markaziga_kira_olmaydi(client: AsyncClient, world: dict) -> None:
    """Rahbar hisobotlarni oʻqiydi, tizimni sozlamaydi."""
    token = await _token(client, "acc.direktor")
    resp = await client.get("/api/v1/access/users", headers=_auth(token))
    assert resp.status_code == 403


async def test_huquqsiz_admin_kira_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.admin")
    resp = await client.get("/api/v1/access/users", headers=_auth(token))
    assert resp.status_code == 403


async def test_superadmin_royxatni_koradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    resp = await client.get("/api/v1/access/users", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    loginlar = {u["login"] for u in resp.json()}
    assert "acc.ustoz" in loginlar


async def test_huquq_berilgan_admin_ham_kira_oladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=Permission.PERMISSIONS_GRANT,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    token = await _token(client, "acc.admin")
    resp = await client.get("/api/v1/access/users", headers=_auth(token))
    assert resp.status_code == 200


async def test_har_kim_oz_holatini_koradi(client: AsyncClient, world: dict) -> None:
    """Kabinet menyusi shundan chiziladi — huquq talab qilinmaydi."""
    token = await _token(client, "acc.ustoz")
    resp = await client.get(f"/api/v1/access/users/{world['teacher'].id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["cabinet"] == "teacher"


async def test_boshqaning_holatini_korish_uchun_huquq_kerak(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "acc.ustoz")
    resp = await client.get(f"/api/v1/access/users/{world['admin'].id}", headers=_auth(token))
    assert resp.status_code == 403


# ─────────────────────── Boʻlimlarni belgilash ───────────────────────


async def test_superadmin_bolimni_ochiradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    resp = await client.put(
        f"/api/v1/access/users/{world['teacher'].id}/sections",
        headers=_auth(token),
        json={"sections": ["/teacher", "/teacher/jurnal"]},
    )
    assert resp.status_code == 200, resp.text

    body = resp.json()
    assert body["sections"] == ["/teacher", "/teacher/jurnal"]
    assert body["customized"] is True
    assert "/teacher/vazifa" not in body["sections"]


async def test_null_yuborilsa_rol_standartiga_qaytadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    yol = f"/api/v1/access/users/{world['teacher'].id}/sections"

    await client.put(yol, headers=_auth(token), json={"sections": ["/teacher"]})
    resp = await client.put(yol, headers=_auth(token), json={"sections": None})

    assert resp.status_code == 200
    body = resp.json()
    assert body["customized"] is False
    assert body["sections"] == body["default_sections"]


async def test_nomalum_bolim_rad_etiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    resp = await client.put(
        f"/api/v1/access/users/{world['teacher'].id}/sections",
        headers=_auth(token),
        json={"sections": ["/yoq/bolim"]},
    )
    assert resp.status_code == 422


async def test_superadminni_cheklab_bolmaydi(client: AsyncClient, world: dict) -> None:
    """U tizimni sozlaydi — oʻzini qulflab qoʻya olmasligi kerak."""
    token = await _token(client, "acc.superadmin")
    resp = await client.put(
        f"/api/v1/access/users/{world['superadmin'].id}/sections",
        headers=_auth(token),
        json={"sections": ["/admin"]},
    )
    assert resp.status_code == 422


# ─────────────────────── Huquq berish ───────────────────────


async def test_superadmin_huquq_beradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    resp = await client.put(
        f"/api/v1/access/users/{world['admin'].id}/permissions",
        headers=_auth(token),
        json={"permissions": ["users.create", "reports.export"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["permissions"] == ["reports.export", "users.create"]


async def test_huquq_royxati_toliq_almashadi(client: AsyncClient, world: dict) -> None:
    """Ikkinchi soʻrov birinchisini almashtiradi, qoʻshmaydi."""
    token = await _token(client, "acc.superadmin")
    yol = f"/api/v1/access/users/{world['admin'].id}/permissions"

    await client.put(yol, headers=_auth(token), json={"permissions": ["users.create"]})
    resp = await client.put(yol, headers=_auth(token), json={"permissions": ["reports.export"]})

    assert resp.json()["permissions"] == ["reports.export"]


async def test_huquqi_bor_admin_grant_ni_bera_olmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Eng muhim chegara: huquq oshirish yoʻli yopiq.

    Aks holda `permissions.grant` bori oʻziga teng odam yaratib,
    superadmin cheklovini butunlay aylanib oʻtardi.
    """
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=Permission.PERMISSIONS_GRANT,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    token = await _token(client, "acc.admin")
    resp = await client.put(
        f"/api/v1/access/users/{world['admin2'].id}/permissions",
        headers=_auth(token),
        json={"permissions": ["permissions.grant"]},
    )
    assert resp.status_code == 403

    # Oddiy huquqni esa bera oladi
    ok = await client.put(
        f"/api/v1/access/users/{world['admin2'].id}/permissions",
        headers=_auth(token),
        json={"permissions": ["users.create"]},
    )
    assert ok.status_code == 200


async def test_superadminga_huquq_berilmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    resp = await client.put(
        f"/api/v1/access/users/{world['superadmin'].id}/permissions",
        headers=_auth(token),
        json={"permissions": ["users.create"]},
    )
    assert resp.status_code == 422


async def test_nomalum_huquq_rad_etiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    resp = await client.put(
        f"/api/v1/access/users/{world['admin'].id}/permissions",
        headers=_auth(token),
        json={"permissions": ["yoq.huquq"]},
    )
    assert resp.status_code == 422


# ─────────────────────── Audit va /me ───────────────────────


async def test_ozgarish_auditga_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 4-qoida: kim kimga qachon huquq berdi."""
    token = await _token(client, "acc.superadmin")
    await client.put(
        f"/api/v1/access/users/{world['admin'].id}/permissions",
        headers=_auth(token),
        json={"permissions": ["users.create"]},
    )

    yozuv = await session.scalar(select(AuditLog).where(AuditLog.object_type == "user_access"))
    assert yozuv is not None
    assert yozuv.new_value["permissions"] == ["users.create"]
    assert yozuv.actor_id == world["superadmin"].id


async def test_me_bolim_va_huquqlarni_qaytaradi(client: AsyncClient, world: dict) -> None:
    """Frontend menyuni shu javobdan chizadi, oʻzi hisoblamaydi."""
    token = await _token(client, "acc.ustoz")
    resp = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    body = resp.json()
    assert body["cabinet"] == "teacher"
    assert "/teacher" in body["sections"]
    assert "/admin" not in body["sections"]
    assert body["permissions"] == []


async def test_me_ozgargan_bolimni_darhol_koradi(client: AsyncClient, world: dict) -> None:
    """Super admin boʻlimni oʻchirsa, keyingi `/me` da yoʻqoladi.

    Roʻyxat TOKENDAN emas, bazadan oʻqiladi.
    """
    sa = await _token(client, "acc.superadmin")
    ustoz = await _token(client, "acc.ustoz")

    oldin = await client.get("/api/v1/auth/me", headers=_auth(ustoz))
    assert "/teacher/vazifa" in oldin.json()["sections"]

    await client.put(
        f"/api/v1/access/users/{world['teacher'].id}/sections",
        headers=_auth(sa),
        json={"sections": ["/teacher", "/teacher/jurnal"]},
    )

    keyin = await client.get("/api/v1/auth/me", headers=_auth(ustoz))
    assert "/teacher/vazifa" not in keyin.json()["sections"]


async def test_superadmin_me_barcha_huquqlarni_koradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "acc.superadmin")
    resp = await client.get("/api/v1/auth/me", headers=_auth(token))
    body = resp.json()
    assert len(body["permissions"]) == len(list(Permission))
    assert body["cabinet"] == "admin"
