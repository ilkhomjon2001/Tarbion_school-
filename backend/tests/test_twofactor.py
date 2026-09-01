"""Ikki bosqichli tasdiqlash (X-14).

Eng muhim testlar:
  · parolni bilgan, kodi yoʻq odam TOKEN OLMAYDI
  · bir kod ikki marta ishlatilmaydi
  · majburiy roldagi foydalanuvchi 2FA yoqmaguncha API yopiq
  · majburiy rolda 2FA ni oʻchirib boʻlmaydi
  · tiklash kodi bir martalik
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import totp
from app.core.security import hash_password
from app.models import Role, RoleName, TwoFactorRecoveryCode, User

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(
    session: AsyncSession, roles: list[str], login: str
) -> User:
    rols = await _roles(session)
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinovov",
        first_name="Sinov",
    )
    u.roles = [rols[r] for r in roles]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture(autouse=True)
def _majburiylik_yoqiq(monkeypatch: pytest.MonkeyPatch) -> None:
    """X-14 majburiyligi YOQIQ holatda sinaladi.

    `REQUIRE_TWO_FACTOR` sozlamasi ishlab chiquvchining `.env` iga
    bogʻliq: sinov serverida u `false`. Testlar undan mustaqil
    boʻlishi kerak — aks holda ular kimningdir mahalliy sozlamasiga
    qarab yiqilib turardi.

    Majburiylikni oʻchirish holatini alohida test tekshiradi.
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "require_two_factor", True)


@pytest.fixture
async def ustoz(session: AsyncSession) -> User:
    """Oddiy ustoz — 2FA MAJBURIY EMAS."""
    return await _user(session, [RoleName.TEACHER.value], "tf.ustoz")


@pytest.fixture
async def admin(session: AsyncSession) -> User:
    """Administrator — 2FA MAJBURIY (X-14)."""
    return await _user(session, [RoleName.ADMIN.value], "tf.admin")


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _login(client: AsyncClient, login: str) -> dict:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


async def _enable_2fa(client: AsyncClient, token: str) -> tuple[str, list[str]]:
    """Sozlash oqimini oxirigacha oʻtadi. (sekret, tiklash kodlari)."""
    r = await client.post("/api/v1/auth/2fa/setup", headers=_auth(token))
    assert r.status_code == 200, r.text
    sekret = r.json()["secret"]

    kod = totp._code_at(sekret, totp.current_step())
    r = await client.post(
        "/api/v1/auth/2fa/enable", headers=_auth(token), json={"code": kod}
    )
    assert r.status_code == 200, r.text
    return sekret, r.json()["codes"]


# ─────────────────────────── Sozlash ───────────────────────────


async def test_sozlash_oqimi(client: AsyncClient, ustoz: User) -> None:
    token = (await _login(client, "tf.ustoz"))["access_token"]

    r = await client.get("/api/v1/auth/2fa", headers=_auth(token))
    assert r.json() == {"enabled": False, "required": False, "unused_recovery_codes": 0}

    sekret, kodlar = await _enable_2fa(client, token)
    assert len(sekret) >= 16
    assert len(kodlar) == totp.RECOVERY_CODE_COUNT

    r = await client.get("/api/v1/auth/2fa", headers=_auth(token))
    assert r.json()["enabled"] is True
    assert r.json()["unused_recovery_codes"] == totp.RECOVERY_CODE_COUNT


async def test_notogri_kod_bilan_yoqilmaydi(client: AsyncClient, ustoz: User) -> None:
    token = (await _login(client, "tf.ustoz"))["access_token"]
    await client.post("/api/v1/auth/2fa/setup", headers=_auth(token))

    r = await client.post(
        "/api/v1/auth/2fa/enable", headers=_auth(token), json={"code": "000000"}
    )
    assert r.status_code == 401, r.text

    r = await client.get("/api/v1/auth/2fa", headers=_auth(token))
    assert r.json()["enabled"] is False


async def test_yarim_sozlangan_holatda_qulflanib_qolmaydi(
    client: AsyncClient, ustoz: User
) -> None:
    """Sekret yasaldi, lekin kod tasdiqlanmadi — eski yoʻl ishlashi kerak."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    await client.post("/api/v1/auth/2fa/setup", headers=_auth(token))

    # Kirish hali oddiy: 2FA yoqilmagan.
    r = await client.post(
        "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
    )
    assert r.status_code == 200
    assert "access_token" in r.json()


# ─────────────────────── Kirishning ikki bosqichi ───────────────────────


async def test_2fa_yoqilganda_token_berilmaydi(client: AsyncClient, ustoz: User) -> None:
    """ENG MUHIM: parolni bilgan, kodi yoʻq odam token olmasin."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    sekret, _ = await _enable_2fa(client, token)

    r = await client.post(
        "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["two_factor_required"] is True
    assert "access_token" not in body
    assert "challenge_token" in body


async def test_challenge_token_access_token_sifatida_ishlamaydi(
    client: AsyncClient, ustoz: User
) -> None:
    """Challenge boshqa hech narsaga yaramasin."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    await _enable_2fa(client, token)

    r = await client.post(
        "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
    )
    challenge = r.json()["challenge_token"]

    r = await client.get("/api/v1/auth/me", headers=_auth(challenge))
    assert r.status_code == 401, r.text


async def test_kod_bilan_token_olinadi(client: AsyncClient, ustoz: User) -> None:
    token = (await _login(client, "tf.ustoz"))["access_token"]
    sekret, _ = await _enable_2fa(client, token)

    r = await client.post(
        "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
    )
    challenge = r.json()["challenge_token"]

    # `enable` joriy qadamni ishlatib boʻlgan — keyingisini olamiz.
    kod = totp._code_at(sekret, totp.current_step() + 1)
    r = await client.post(
        "/api/v1/auth/2fa/verify",
        json={"challenge_token": challenge, "code": kod},
    )
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()

    yangi = r.json()["access_token"]
    assert (await client.get("/api/v1/auth/me", headers=_auth(yangi))).status_code == 200


async def test_bir_kod_ikki_marta_ishlatilmaydi(client: AsyncClient, ustoz: User) -> None:
    """Yelka ortidan koʻrgan odam oʻsha 30 soniyada kira olmasin."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    sekret, _ = await _enable_2fa(client, token)

    kod = totp._code_at(sekret, totp.current_step() + 1)

    challenge = (
        await client.post(
            "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
        )
    ).json()["challenge_token"]
    r = await client.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": kod}
    )
    assert r.status_code == 200, r.text

    challenge = (
        await client.post(
            "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
        )
    ).json()["challenge_token"]
    r = await client.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": kod}
    )
    assert r.status_code == 401, "takroriy kod qabul qilindi"


async def test_notogri_parol_challenge_bermaydi(client: AsyncClient, ustoz: User) -> None:
    token = (await _login(client, "tf.ustoz"))["access_token"]
    await _enable_2fa(client, token)

    r = await client.post(
        "/api/v1/auth/login", json={"login": "tf.ustoz", "password": "xato"}
    )
    assert r.status_code == 401
    assert "challenge_token" not in r.text


# ─────────────────────── Tiklash kodlari ───────────────────────


async def test_tiklash_kodi_bilan_kiriladi(client: AsyncClient, ustoz: User) -> None:
    """Telefon yoʻqolgan holat."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    _, kodlar = await _enable_2fa(client, token)

    challenge = (
        await client.post(
            "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
        )
    ).json()["challenge_token"]

    r = await client.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": kodlar[0]}
    )
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()


async def test_tiklash_kodi_bir_martalik(
    client: AsyncClient, ustoz: User, session: AsyncSession
) -> None:
    token = (await _login(client, "tf.ustoz"))["access_token"]
    _, kodlar = await _enable_2fa(client, token)

    for _ in range(2):
        challenge = (
            await client.post(
                "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
            )
        ).json()["challenge_token"]
        javob = await client.post(
            "/api/v1/auth/2fa/verify",
            json={"challenge_token": challenge, "code": kodlar[0]},
        )
        kodlar_holati = javob.status_code

    assert kodlar_holati == 401, "tiklash kodi ikkinchi marta ishladi"

    # Ishlatilgan kod OʻCHIRILMAYDI — «qachon ishlatildi» savoli
    # javobsiz qolmasin (1-qoida).
    rows = (
        (
            await session.execute(
                select(TwoFactorRecoveryCode).where(
                    TwoFactorRecoveryCode.used_at.is_not(None)
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1


async def test_kodlarni_qayta_yasash_eskilarini_bekor_qiladi(
    client: AsyncClient, ustoz: User
) -> None:
    token = (await _login(client, "tf.ustoz"))["access_token"]
    _, eski = await _enable_2fa(client, token)

    r = await client.post(
        "/api/v1/auth/2fa/recovery-codes",
        headers=_auth(token),
        json={"password": PASSWORD},
    )
    assert r.status_code == 200, r.text
    yangi = r.json()["codes"]
    assert set(yangi) & set(eski) == set()

    challenge = (
        await client.post(
            "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
        )
    ).json()["challenge_token"]
    r = await client.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": eski[0]}
    )
    assert r.status_code == 401, "bekor qilingan kod ishladi"


async def test_kodlarni_qayta_yasashda_parol_soraladi(
    client: AsyncClient, ustoz: User
) -> None:
    """Ochiq qolgan sessiyani topgan odam yangi kod yasab olmasin."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    await _enable_2fa(client, token)

    r = await client.post(
        "/api/v1/auth/2fa/recovery-codes",
        headers=_auth(token),
        json={"password": "xato"},
    )
    assert r.status_code == 401, r.text


# ─────────────────── Majburiy rollar (X-14) ───────────────────


async def test_administrator_uchun_2fa_majburiy(client: AsyncClient, admin: User) -> None:
    token = (await _login(client, "tf.admin"))["access_token"]

    r = await client.get("/api/v1/school/students", headers=_auth(token))
    assert r.status_code == 403, r.text
    assert r.json()["code"] == "ikki_bosqich_kerak"

    # Sozlash oqimi ochiq qoladi — aks holda qulflanib qolardi.
    assert (await client.get("/api/v1/auth/2fa", headers=_auth(token))).status_code == 200
    await _enable_2fa(client, token)

    # Yoqilgach API ochiladi.
    r = await client.get("/api/v1/school/students", headers=_auth(token))
    assert r.status_code == 200, r.text


async def test_ustoz_uchun_majburiy_emas(client: AsyncClient, ustoz: User) -> None:
    """Ustozda butun baza yoʻq — unga majburlash ortiqcha toʻsiq."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    r = await client.get("/api/v1/attendance/my-lessons", headers=_auth(token))
    assert r.status_code == 200, r.text


async def test_majburiy_rolda_ochirib_bolmaydi(client: AsyncClient, admin: User) -> None:
    """Aks holda X-14 talabini bir bosishda aylanib oʻtish mumkin edi."""
    token = (await _login(client, "tf.admin"))["access_token"]
    sekret, _ = await _enable_2fa(client, token)

    kod = totp._code_at(sekret, totp.current_step() + 1)
    r = await client.post(
        "/api/v1/auth/2fa/disable",
        headers=_auth(token),
        json={"password": PASSWORD, "code": kod},
    )
    assert r.status_code == 422, r.text
    assert "majburiy" in r.json()["message"]


async def test_ustoz_ochira_oladi(client: AsyncClient, ustoz: User) -> None:
    token = (await _login(client, "tf.ustoz"))["access_token"]
    sekret, _ = await _enable_2fa(client, token)

    kod = totp._code_at(sekret, totp.current_step() + 1)
    r = await client.post(
        "/api/v1/auth/2fa/disable",
        headers=_auth(token),
        json={"password": PASSWORD, "code": kod},
    )
    assert r.status_code == 204, r.text

    r = await client.post(
        "/api/v1/auth/login", json={"login": "tf.ustoz", "password": PASSWORD}
    )
    assert "access_token" in r.json()


async def test_ochirishda_parol_ham_soraladi(client: AsyncClient, ustoz: User) -> None:
    """Kodni koʻrgan odam 2FA ni oʻchirib tashlay olmasin."""
    token = (await _login(client, "tf.ustoz"))["access_token"]
    sekret, _ = await _enable_2fa(client, token)

    kod = totp._code_at(sekret, totp.current_step() + 1)
    r = await client.post(
        "/api/v1/auth/2fa/disable",
        headers=_auth(token),
        json={"password": "xato", "code": kod},
    )
    assert r.status_code == 401, r.text


# ─────────────────────── Algoritm (RFC 6238) ───────────────────────


def test_rfc6238_sinov_vektorlari() -> None:
    """Standart sinov vektorlari — algoritm toʻgʻri yozilganini isbotlaydi.

    Ular RFC 6238 Appendix B dan. Agar bu test yiqilsa, Google
    Authenticator ham kod qabul qilmaydi.
    """
    import base64

    sekret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")

    assert totp._code_at(sekret, 59 // 30) == "287082"
    assert totp._code_at(sekret, 1111111109 // 30) == "081804"
    assert totp._code_at(sekret, 1234567890 // 30) == "005924"


def test_kod_shakli_tekshiriladi() -> None:
    sekret = totp.generate_secret()
    assert totp.verify(sekret, "abc") is None
    assert totp.verify(sekret, "12345") is None
    assert totp.verify(sekret, "") is None
    assert totp.verify(sekret, "1234567") is None


def test_soat_chetlashishiga_yol_qoyiladi() -> None:
    """Telefon soati bir necha soniyaga chetlashishi oddiy hol."""
    sekret = totp.generate_secret()
    hozir = totp.current_step()

    assert totp.verify(sekret, totp._code_at(sekret, hozir - 1)) == hozir - 1
    assert totp.verify(sekret, totp._code_at(sekret, hozir + 1)) == hozir + 1
    # Undan uzoqrogʻi qabul qilinmaydi.
    assert totp.verify(sekret, totp._code_at(sekret, hozir + 5)) is None


async def test_superadmin_uchun_majburiy_emas(client: AsyncClient, session: AsyncSession) -> None:
    """X-14 aynan administrator va direktorni nomlaydi.

    Super administrator — loyiha egasining texnik hisobi: kamdan-kam
    ishlatiladi va uni majburlash ish jarayonini toʻsadi. Funksiya
    unga ham ochiq, lekin majburiy emas.
    """
    sa = await _user(session, [RoleName.SUPERADMIN.value], "tf.sa")
    assert sa is not None

    token = (await _login(client, "tf.sa"))["access_token"]

    # 2FA yoqilmagan holda ham API ochiq.
    r = await client.get("/api/v1/school/students", headers=_auth(token))
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/auth/2fa", headers=_auth(token))
    assert r.json()["required"] is False

    # Istasa yoqa oladi — va keyin oʻchira ham oladi.
    sekret, _ = await _enable_2fa(client, token)
    kod = totp._code_at(sekret, totp.current_step() + 1)
    r = await client.post(
        "/api/v1/auth/2fa/disable",
        headers=_auth(token),
        json={"password": PASSWORD, "code": kod},
    )
    assert r.status_code == 204, r.text


async def test_majburiylikni_ochirib_qoyish_mumkin(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Sinov muhitida majburiylik oʻchiriladi (`REQUIRE_TWO_FACTOR=false`).

    Muhim: oʻchirilganda 2FA FUNKSIYASI qoladi — foydalanuvchi uni
    istasa yoqadi va kirishda kod soʻraladi. Faqat MAJBURLASH yoʻqoladi.
    """
    from app.core.config import settings
    from app.services import twofactor_service

    admin = await _user(session, [RoleName.ADMIN.value], "tf.admin2")

    # Bu faylda autouse fixture ishlamaydi — asl `is_required` ni
    # tiklaymiz va sozlamani oʻzgartiramiz.
    monkeypatch.setattr(settings, "require_two_factor", False)
    assert twofactor_service.is_required(admin) is False

    token = (await _login(client, "tf.admin2"))["access_token"]
    r = await client.get("/api/v1/school/students", headers=_auth(token))
    assert r.status_code == 200, "majburiylik oʻchiq boʻlsa ham toʻsildi"

    # Funksiyaning oʻzi ishlayapti: yoqib koʻramiz.
    sekret, _ = await _enable_2fa(client, token)
    r = await client.post(
        "/api/v1/auth/login", json={"login": "tf.admin2", "password": PASSWORD}
    )
    assert r.json()["two_factor_required"] is True, "yoqilgan 2FA ishlamadi"
    assert sekret

    # Yoqilgan boʻlsa — majburiylik oʻchiq boʻlgani uchun oʻchira ham oladi.
    kod = totp._code_at(sekret, totp.current_step() + 1)
    r = await client.post(
        "/api/v1/auth/2fa/disable",
        headers=_auth(token),
        json={"password": PASSWORD, "code": kod},
    )
    assert r.status_code == 204, r.text
