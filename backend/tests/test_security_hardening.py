"""Xavfsizlik qatlamlari.

Bu testlar funksiyani emas, HIMOYANI tekshiradi. Ular yiqilsa —
kimdir himoyani bilmasdan olib tashlagan.

  · boshlangʻich parol bilan API yopiq
  · mavjud boʻlmagan login uchun javob vaqti bir xil (enumeration)
  · bitta IP dan parol purkash bloklanadi
  · xavfsizlik sarlavhalari qoʻyiladi
  · juda katta soʻrov tanasi rad etiladi
  · `X-Forwarded-For` ishonchsiz manbadan oʻqilmaydi
  · ishlab chiqarish sozlamasi tekshiriladi
"""

import time

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.middleware import MAX_BODY_BYTES, _first_forwarded, _in_networks, _parse_networks
from app.core.security import hash_password, verify_password_constant_time
from app.models import LoginAttempt, Role, RoleName, User

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


@pytest.fixture
async def user(session: AsyncSession) -> User:
    roles = await _roles(session)
    u = User(
        login="sec.ustoz",
        password_hash=hash_password(PASSWORD),
        last_name="Aliyev",
        first_name="Sinov",
    )
    u.roles = [roles[RoleName.TEACHER.value]]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def yangi_hisob(session: AsyncSession) -> User:
    """Boshlangʻich parolli hisob — hali almashtirilmagan."""
    roles = await _roles(session)
    u = User(
        login="sec.yangi",
        password_hash=hash_password("54321"),
        last_name="Yangiyev",
        first_name="Sinov",
        must_change_password=True,
    )
    u.roles = [roles[RoleName.TEACHER.value]]
    session.add(u)
    await session.flush()
    return u


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str, parol: str = PASSWORD) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": parol})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ─────────── Boshlangʻich parol majburan almashtiriladi ───────────


async def test_boshlangich_parol_bilan_api_yopiq(client: AsyncClient, yangi_hisob: User) -> None:
    """5 xonali parol — atigi 100 000 variant.

    U almashtirilmaguncha API ochiq qolsa, ustoz butun yil oʻsha zaif
    parol bilan ishlab yurardi va bitta topilgan parol butun sinf
    maʼlumotini ochib berardi.
    """
    token = await _token(client, "sec.yangi", "54321")

    r = await client.get("/api/v1/school/students", headers=_auth(token))
    assert r.status_code == 403, r.text
    assert r.json()["code"] == "parol_almashtirilsin"

    r = await client.get("/api/v1/attendance/my-lessons", headers=_auth(token))
    assert r.status_code == 403


async def test_parol_almashtirish_yoli_ochiq_qoladi(client: AsyncClient, yangi_hisob: User) -> None:
    """Aks holda foydalanuvchi qulflanib qolardi."""
    token = await _token(client, "sec.yangi", "54321")

    assert (await client.get("/api/v1/auth/me", headers=_auth(token))).status_code == 200

    r = await client.post(
        "/api/v1/auth/change-password",
        headers=_auth(token),
        json={"current_password": "54321", "new_password": "YangiParol2026"},
    )
    assert r.status_code == 204, r.text

    # Almashtirilgach API ochiladi.
    token = await _token(client, "sec.yangi", "YangiParol2026")
    assert (await client.get("/api/v1/school/students", headers=_auth(token))).status_code == 200


# ─────────────────── Foydalanuvchi enumeration ───────────────────


def test_mavjud_bolmagan_login_uchun_ham_argon2_ishlaydi() -> None:
    """Vaqt farqi login mavjudligini oshkor qilmasin.

    Bu testda aniq millisekund oʻlchanmaydi (CI da shovqin koʻp) —
    faqat argon2 HAQIQATAN ishlagani tekshiriladi: agar u tashlab
    ketilsa, chaqiruv bir necha mikrosekundda qaytardi.
    """
    xesh = hash_password("haqiqiy-parol")

    boshlanish = time.perf_counter()
    assert verify_password_constant_time("xato", xesh) is False
    mavjud_uchun = time.perf_counter() - boshlanish

    boshlanish = time.perf_counter()
    assert verify_password_constant_time("xato", None) is False
    yoq_uchun = time.perf_counter() - boshlanish

    # argon2 (64 MiB, t=3) hech boʻlmasa 5 ms ishlaydi. Agar `None`
    # holatida hisoblash tashlab ketilgan boʻlsa, bu shart yiqiladi.
    assert yoq_uchun > 0.005, "mavjud boʻlmagan login uchun argon2 ishlamadi"
    # Ikkalasi bir tartibda: biri ikkinchisidan 10 barobar tez emas.
    assert yoq_uchun > mavjud_uchun / 10


async def test_login_xatosi_umumiy(client: AsyncClient, user: User) -> None:
    """Xabar «bunday login yoʻq» demasin (X-3 ruhida)."""
    r1 = await client.post("/api/v1/auth/login", json={"login": "sec.ustoz", "password": "notogri"})
    r2 = await client.post(
        "/api/v1/auth/login", json={"login": "umuman.yoq", "password": "notogri"}
    )
    assert r1.status_code == r2.status_code == 401
    assert r1.json()["message"] == r2.json()["message"]
    assert r1.json()["code"] == r2.json()["code"]


# ─────────────────── Parol purkash (IP boʻyicha) ───────────────────


async def test_ip_boyicha_bloklash(client: AsyncClient, session: AsyncSession, user: User) -> None:
    """Login boʻyicha bloklash yolgʻiz yetarli emas.

    Hujumchi bitta ommabop parolni koʻp login boʻyicha sinasa, hech bir
    hisob 5 ta chegaraga yetmaydi. TURLI loginlar soni shuni ushlaydi.
    """
    for i in range(settings.login_max_logins_per_ip):
        await client.post("/api/v1/auth/login", json={"login": f"yoq{i}", "password": "12345"})

    urinishlar = (
        (await session.execute(select(LoginAttempt).where(LoginAttempt.successful.is_(False))))
        .scalars()
        .all()
    )
    assert len({u.login for u in urinishlar}) >= settings.login_max_logins_per_ip

    # Endi TOʻGʻRI parol bilan ham kirib boʻlmaydi: IP bloklangan.
    r = await client.post("/api/v1/auth/login", json={"login": "sec.ustoz", "password": PASSWORD})
    assert r.status_code == 423, r.text


async def test_bitta_login_boyicha_kop_xato_ipni_bloklamaydi(
    client: AsyncClient, user: User
) -> None:
    """Oddiy foydalanuvchi oʻz parolini bir necha marta xato tersa,
    butun maktab (bitta NAT) bloklanib qolmasligi kerak."""
    for _ in range(settings.login_max_logins_per_ip + 5):
        await client.post("/api/v1/auth/login", json={"login": "boshqa.odam", "password": "xato"})

    # Bitta login boʻyicha xato — IP bloklanmaydi. `sec.ustoz` oʻzining
    # chegarasiga yetmagani uchun kira oladi.
    r = await client.post("/api/v1/auth/login", json={"login": "sec.ustoz", "password": PASSWORD})
    assert r.status_code == 200, r.text


# ─────────────────── Xavfsizlik sarlavhalari ───────────────────


async def test_xavfsizlik_sarlavhalari(client: AsyncClient) -> None:
    r = await client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "content-security-policy" in r.headers
    assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "uvicorn" not in r.headers.get("server", "").lower()


async def test_csp_hech_narsani_yuklashga_ruxsat_bermaydi(client: AsyncClient) -> None:
    """API JSON qaytaradi — unda skript ham, rasm ham boʻlmasligi kerak."""
    r = await client.get("/health")
    csp = r.headers["content-security-policy"]
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


# ─────────────────── Soʻrov hajmi ───────────────────


async def test_juda_katta_tana_rad_etiladi(client: AsyncClient, user: User) -> None:
    """Bitta soʻrov bilan xotirani toʻldirish — eng arzon DoS."""
    token = await _token(client, "sec.ustoz")
    katta = "a" * (MAX_BODY_BYTES + 1024)

    r = await client.post(
        "/api/v1/auth/change-password",
        headers=_auth(token),
        json={"current_password": PASSWORD, "new_password": katta},
    )
    assert r.status_code == 413, r.text
    assert r.json()["code"] == "juda_katta"


# ─────────────────── X-Forwarded-For ───────────────────


def test_forwarded_faqat_ishonchli_proksidan() -> None:
    """Sarlavhaga koʻr-koʻrona ishonish bloklashni aylanib oʻtish yoʻli.

    Hujumchi har soʻrovda yangi IP yozib, IP boʻyicha bloklashni
    butunlay foydasiz qilardi.
    """
    tarmoqlar = _parse_networks(["127.0.0.1/32", "10.0.0.0/8"])

    assert _in_networks("127.0.0.1", tarmoqlar) is True
    assert _in_networks("10.5.5.5", tarmoqlar) is True
    assert _in_networks("203.0.113.7", tarmoqlar) is False
    assert _in_networks("axlat", tarmoqlar) is False


def test_forwarded_birinchi_manzilni_oladi() -> None:
    """Zanjir `mijoz, proksi1` — bizga asl mijoz kerak."""
    assert _first_forwarded({b"x-forwarded-for": b"203.0.113.7, 10.0.0.1"}) == "203.0.113.7"
    assert _first_forwarded({b"x-forwarded-for": b"  198.51.100.2  "}) == "198.51.100.2"
    # Buzuq qiymat qabul qilinmaydi — aks holda `ip_address` maydoniga
    # ixtiyoriy matn tushib qolardi.
    assert _first_forwarded({b"x-forwarded-for": b"<script>"}) is None
    assert _first_forwarded({}) is None


def test_ishonchli_proksi_royxati_bosh_bolsa_hech_narsa_oqilmaydi() -> None:
    """Sukut boʻyicha `trusted_proxies` boʻsh — sarlavha eʼtiborsiz."""
    assert _parse_networks([]) == []
    assert _in_networks("203.0.113.7", []) is False


# ─────────────────── Ishlab chiqarish sozlamasi ───────────────────


def test_ishlab_chiqarishda_xavfli_sozlama_rad_etiladi() -> None:
    """Sozlama xatosi eng koʻp uchraydigan zaiflik manbai."""
    from pydantic import ValidationError

    from app.core.config import Settings

    # `_env_file=None` — test .env dagi ishlab chiqish qiymatlarini
    # oʻqib olmasin, aks holda tekshiruv nimani sinayotgani noaniq
    # boʻlardi.
    asos = {
        "_env_file": None,
        "app_env": "production",
        "database_url": "postgresql+asyncpg://u:p@localhost/db",
        "jwt_secret": "x7Kp2mQ9vB4nR8sT1wY6zA3cE5gH0jL4dF",
        "cookie_secure": True,
        "debug": False,
        "cors_origins": ["https://tarbion.uz"],
    }

    with pytest.raises(ValidationError, match="COOKIE_SECURE"):
        Settings(**{**asos, "cookie_secure": False})  # type: ignore[arg-type]

    with pytest.raises(ValidationError, match="http://"):
        Settings(**{**asos, "cors_origins": ["http://tarbion.uz"]})  # type: ignore[arg-type]

    with pytest.raises(ValidationError, match="DEBUG"):
        Settings(**{**asos, "debug": True})  # type: ignore[arg-type]

    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(**{**asos, "jwt_secret": "a" * 36})  # type: ignore[arg-type]

    # Toʻgʻri sozlama bilan muammosiz yigʻiladi.
    ok = Settings(**asos)  # type: ignore[arg-type]
    assert ok.is_production is True

    # Ishlab chiqish muhitida bu tekshiruvlar ishlamaydi — lokal
    # ishlash HTTP orqali boʻladi va bu normal.
    lokal = Settings(**{**asos, "app_env": "development", "cookie_secure": False})  # type: ignore[arg-type]
    assert lokal.is_production is False
