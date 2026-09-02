"""Parolni tiklash (T-006, AUT-02).

Bu oqim autentifikatsiyasiz ochiq — ya'ni butun internetga ochiq.
Shuning uchun testlarning koʻpi hujum yoʻllarini yopadi:

  · begona odam raqamlarni sinab, qaysi oila maktabda ekanini bilib
    ololmasin (enumeration);
  · 6 raqamli kodni brut kuch bilan topib boʻlmasin;
  · bir kod ikki marta ishlamasin;
  · birovning raqamiga tinmay soʻrov yuborib, telefonini xabarga
    koʻmib boʻlmasin.
"""

from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    NotificationOutbox,
    PasswordResetRequest,
    Permission,
    ResetChannel,
    Role,
    RoleName,
    User,
    UserPermission,
)
from app.services import password_reset_service as prs

PASSWORD = "Sinov12345!"  # noqa: S106
YANGI = "YangiParol2026"  # noqa: S105
TELEFON = "+998901112233"


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(session, roles, names, login, **kw):  # noqa: ANN001, ANN202
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinovov",
        first_name="Sinov",
        **kw,
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)
    ota = await _user(session, roles, [RoleName.PARENT.value], "pr.ota", phone=TELEFON)
    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "pr.ustoz")
    admin = await _user(session, roles, [RoleName.ADMIN.value], "pr.admin")
    session.add(
        UserPermission(user_id=admin.id, permission=Permission.USERS_RESET_PASSWORD.value)
    )
    await session.commit()
    return {"ota": ota, "ustoz": ustoz, "admin": admin}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _sorash(client: AsyncClient, **payload) -> object:  # noqa: ANN003
    return await client.post("/api/v1/auth/password-reset/request", json=payload)


async def _sorovlar(session: AsyncSession, user_id) -> int:  # noqa: ANN001
    return await session.scalar(
        select(func.count())
        .select_from(PasswordResetRequest)
        .where(PasswordResetRequest.user_id == user_id)
    )


# ─────────────────────── Oshkor qilmaslik ───────────────────────


async def test_notanish_raqam_ham_bir_xil_javob(client: AsyncClient, world: dict) -> None:
    """Raqam bazada yoʻqligi javobdan BILINMASIN.

    Aks holda begona odam raqamlarni ketma-ket sinab, qaysi oila
    maktabda oʻqishini aniqlab olardi — bu voyaga yetmaganlar roʻyxati.
    """
    bor = await _sorash(client, phone=TELEFON)
    yoq = await _sorash(client, phone="+998900000000")
    assert bor.status_code == 200
    assert yoq.status_code == 200
    assert bor.json() == yoq.json()


async def test_notogri_formatdagi_raqam_ham_xato_bermaydi(client: AsyncClient) -> None:
    r = await _sorash(client, phone="salom")
    assert r.status_code == 200


async def test_notanish_raqamga_sorov_yozilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _sorash(client, phone="+998900000000")
    jami = await session.scalar(select(func.count()).select_from(PasswordResetRequest))
    assert jami == 0


# ─────────────────────── Kanal tanlash ───────────────────────


async def test_telegramsiz_hisob_administrator_navbatiga_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """TZ talabi: bot ulanmagan boʻlsa administrator qoʻlda tiklaydi."""
    r = await _sorash(client, phone=TELEFON)
    assert r.status_code == 200

    sorov = await session.scalar(select(PasswordResetRequest))
    assert sorov is not None
    assert sorov.channel == ResetChannel.MANUAL.value
    assert sorov.code_hash is None


async def test_telegram_ulangan_hisobga_kod_navbatga_qoyiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    world["ota"].telegram_id = 555001
    await session.commit()

    r = await _sorash(client, phone=TELEFON)
    assert r.status_code == 200

    sorov = await session.scalar(select(PasswordResetRequest))
    assert sorov is not None
    assert sorov.channel == ResetChannel.TELEGRAM.value
    # Kod XOM saqlanmaydi — baza sizib chiqsa u bilan kirib boʻlmasin.
    assert sorov.code_hash is not None
    assert sorov.expires_at is not None

    xabar = await session.scalar(select(NotificationOutbox))
    assert xabar is not None
    assert xabar.kind == prs.KIND


async def test_kod_xabari_ochirib_bolmaydigan_turda(session: AsyncSession) -> None:
    """Foydalanuvchi tiklash kodini «kerak emas» deb oʻchira olmasin —
    aks holda oʻzini tizimdan butunlay chiqarib yuborardi."""
    from app.services import outbox_service

    assert prs.KIND in outbox_service.MAJBURIY_TURLAR


async def test_xodim_login_bilan_soraydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Ustozda telefon yoʻq — login boʻyicha soʻraydi, navbatga tushadi."""
    r = await _sorash(client, login="pr.ustoz")
    assert r.status_code == 200

    sorov = await session.scalar(
        select(PasswordResetRequest).where(PasswordResetRequest.user_id == world["ustoz"].id)
    )
    assert sorov is not None
    assert sorov.channel == ResetChannel.MANUAL.value


# ─────────────────────── Cheklov ───────────────────────


async def test_uch_daqiqada_bir_marta(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Birovning raqamini bilgan odam uni xabarga koʻmib tashlamasin."""
    await _sorash(client, phone=TELEFON)
    await _sorash(client, phone=TELEFON)
    assert await _sorovlar(session, world["ota"].id) == 1


async def test_cheklov_otgach_yangi_sorov_ochiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _sorash(client, phone=TELEFON)
    eski = await session.scalar(select(PasswordResetRequest))
    eski.created_at = utcnow() - prs.COOLDOWN - timedelta(seconds=1)
    await session.commit()

    await _sorash(client, phone=TELEFON)
    assert await _sorovlar(session, world["ota"].id) == 2


# ─────────────────────── Kodni tasdiqlash ───────────────────────


async def _kod_bilan_sorov(session: AsyncSession, user: User, kod: str = "123456") -> None:
    session.add(
        PasswordResetRequest(
            user_id=user.id,
            channel=ResetChannel.TELEGRAM.value,
            code_hash=hash_password(kod),
            expires_at=utcnow() + prs.CODE_TTL,
            attempts=0,
        )
    )
    await session.commit()


async def _tasdiq(client: AsyncClient, kod: str, parol: str = YANGI) -> object:
    return await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"phone": TELEFON, "code": kod, "new_password": parol},
    )


async def test_togri_kod_parolni_almashtiradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _kod_bilan_sorov(session, world["ota"])
    r = await _tasdiq(client, "123456")
    assert r.status_code == 204, r.text

    kirish = await client.post(
        "/api/v1/auth/login", json={"login": "pr.ota", "password": YANGI}
    )
    assert kirish.status_code == 200, kirish.text


async def test_kod_ikki_marta_ishlamaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """AUT-02: kod bir marta ishlaydi."""
    await _kod_bilan_sorov(session, world["ota"])
    assert (await _tasdiq(client, "123456")).status_code == 204
    ikkinchi = await _tasdiq(client, "123456", "BoshqaParol2026")
    assert ikkinchi.status_code == 400


async def test_muddati_otgan_kod_ishlamaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _kod_bilan_sorov(session, world["ota"])
    sorov = await session.scalar(select(PasswordResetRequest))
    sorov.expires_at = utcnow() - timedelta(seconds=1)
    await session.commit()

    r = await _tasdiq(client, "123456")
    assert r.status_code == 400


async def test_notogri_kod_rad_etiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _kod_bilan_sorov(session, world["ota"])
    r = await _tasdiq(client, "999999")
    assert r.status_code == 400


async def test_kop_urinishdan_keyin_sorov_yopiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """6 raqam — million variant. Cheklovsiz uni topib boʻlardi."""
    await _kod_bilan_sorov(session, world["ota"])
    for _ in range(prs.MAX_ATTEMPTS):
        assert (await _tasdiq(client, "999999")).status_code == 400

    # Endi TOʻGʻRI kod ham ishlamaydi.
    r = await _tasdiq(client, "123456")
    assert r.status_code == 400


async def test_qisqa_parol_qabul_qilinmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _kod_bilan_sorov(session, world["ota"])
    r = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"phone": TELEFON, "code": "123456", "new_password": "qisqa"},
    )
    assert r.status_code == 422


# ─────────────────────── Administrator navbati ───────────────────────


async def test_navbat_huquqsiz_korinmaydi(client: AsyncClient, world: dict) -> None:
    """X-2: `users.reset_password` huquqi yoʻq — 403."""
    token = await _token(client, "pr.ustoz")
    r = await client.get(
        "/api/v1/auth/password-reset/queue", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 403, r.text


async def test_administrator_navbatni_koradi_va_hal_qiladi(
    client: AsyncClient, world: dict
) -> None:
    await _sorash(client, phone=TELEFON)
    token = await _token(client, "pr.admin")
    auth = {"Authorization": f"Bearer {token}"}

    navbat = await client.get("/api/v1/auth/password-reset/queue", headers=auth)
    assert navbat.status_code == 200, navbat.text
    rows = navbat.json()
    assert len(rows) == 1
    # X-6: toʻliq raqam navbatda koʻrsatilmaydi.
    assert TELEFON not in rows[0]["phone_masked"]

    hal = await client.post(
        f"/api/v1/auth/password-reset/queue/{rows[0]['id']}/resolve", headers=auth
    )
    assert hal.status_code == 200, hal.text
    yangi_parol = hal.json()["password"]

    kirish = await client.post(
        "/api/v1/auth/login", json={"login": "pr.ota", "password": yangi_parol}
    )
    assert kirish.status_code == 200, kirish.text

    # Hal qilingan soʻrov navbatdan chiqadi.
    qayta = await client.get("/api/v1/auth/password-reset/queue", headers=auth)
    assert qayta.json() == []


async def test_bir_sorov_ikki_marta_hal_qilinmaydi(
    client: AsyncClient, world: dict
) -> None:
    await _sorash(client, phone=TELEFON)
    token = await _token(client, "pr.admin")
    auth = {"Authorization": f"Bearer {token}"}
    rows = (await client.get("/api/v1/auth/password-reset/queue", headers=auth)).json()

    birinchi = await client.post(
        f"/api/v1/auth/password-reset/queue/{rows[0]['id']}/resolve", headers=auth
    )
    ikkinchi = await client.post(
        f"/api/v1/auth/password-reset/queue/{rows[0]['id']}/resolve", headers=auth
    )
    assert birinchi.status_code == 200
    assert ikkinchi.status_code == 404
