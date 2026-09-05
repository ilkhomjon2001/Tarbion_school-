"""Vasiylarni bogʻlash va uzish (T-009, AUT-03).

Bu fayl X-1 ning yozish tomonini tekshiradi. Oʻqish tomoni
(«ota-ona begona bolani koʻrmaydi») boshqa fayllarda; bu yerda
undan oldingi savol: kim kimga vasiy boʻlib QOʻSHILADI.

Eng muhim tekshiruvlar:
  · vasiy qoʻshilganda `parent` roli va hisob yaratiladi (T-009 mezoni)
  · bir xil telefonli ikkinchi hisob jimgina ochilmaydi — `409`
  · uzilgan vasiy shu zahoti farzandini koʻra olmaydi
  · uzish oʻchirish emas — yozuv qoladi va `audit_log` ga tushadi
  · ustoz vasiy biriktira olmaydi
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
    Guardian,
    Role,
    RoleName,
    SchoolClass,
    Student,
    User,
)

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(
    session: AsyncSession,
    roles: dict[str, Role],
    names: list[str],
    login: str,
    last: str,
    phone: str | None = None,
) -> User:
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name=last,
        first_name="Sinov",
        phone=phone,
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)

    admin = await _user(session, roles, [RoleName.SUPERADMIN.value], "gd.sa", "Boshqaruv")
    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "gd.ustoz", "Aliyev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(academic_year_id=year.id, name="5-A")
    session.add(sinf)
    await session.flush()

    ali = Student(class_id=sinf.id, last_name="Aliyev", first_name="Ali")
    vali = Student(class_id=sinf.id, last_name="Aliyev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    await session.commit()
    return {"admin": admin, "ustoz": ustoz, "ali": ali, "vali": vali, "sinf": sinf}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ─────────────────── Yangi vasiy: hisob va rol ───────────────────


async def test_vasiy_qoshilganda_hisob_va_rol_yaratiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """T-009 qabul mezoni.

    Rolsiz hisob ota-ona kabinetiga kira olmasdi va bogʻlanish
    maʼnosiz qolardi.
    """
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Otabek",
            "phone": "+998 90 123-45-67",
            "relation": "father",
            "is_primary": True,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()

    # Boshlangʻich parol BIR MARTA qaytadi. U qasddan qisqa — loyihada
    # birinchi kirishda majburan almashtiriladi, shu sababdan uzunligi
    # emas, «almashtirilsin» bayrogʻi muhim.
    assert body["initial_password"]
    assert body["guardian"]["is_primary"] is True
    assert body["guardian"]["relation"] == "father"
    assert body["guardian"]["children_count"] == 1

    vasiy = await session.get(User, body["guardian"]["user_id"])
    assert vasiy is not None
    await session.refresh(vasiy, attribute_names=["roles"])
    assert RoleName.PARENT.value in vasiy.role_names

    # Parol bazada ochiq saqlanmaydi.
    assert body["initial_password"] not in (vasiy.password_hash or "")
    # Va u shu holicha qolib ketmaydi.
    assert vasiy.must_change_password is True


async def _yangi_vasiy(
    client: AsyncClient, admin_token: str, student_id, **kwargs
) -> tuple[str, str]:
    """Vasiy yaratadi va uning ISHLAYDIGAN tokenini qaytaradi.

    Boshlangʻich parol almashtirilmaguncha API yopiq (`parol_almashtirilsin`),
    shu sabab bu yerda darhol almashtiriladi. Aks holda testlar
    «ota koʻrmayapti» degan xulosani noto'g'ri sababdan chiqarardi.
    """
    payload = {"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"}
    payload.update(kwargs)
    r = await client.post(
        f"/api/v1/school/students/{student_id}/guardians",
        headers=_auth(admin_token),
        json=payload,
    )
    assert r.status_code == 201, r.text
    guardian = r.json()["guardian"]
    login = guardian["login"]
    boshlangich = r.json()["initial_password"]

    r = await client.post(
        "/api/v1/auth/login", json={"login": login, "password": boshlangich}
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]

    r = await client.post(
        "/api/v1/auth/change-password",
        headers=_auth(token),
        json={"current_password": boshlangich, "new_password": "OtaParol2026"},
    )
    assert r.status_code == 204, r.text

    r = await client.post(
        "/api/v1/auth/login", json={"login": login, "password": "OtaParol2026"}
    )
    assert r.status_code == 200, r.text
    return guardian["id"], r.json()["access_token"]


async def test_yangi_vasiy_kirib_farzandini_koradi(client: AsyncClient, world: dict) -> None:
    """Bogʻlanishning butun maqsadi shu — kabinet tomonidan tekshiriladi.

    Login muvaffaqiyatli boʻlishi yetarli emas: hisob bor, lekin
    `guardians` yozuvi ishlamasa ota baribir hech nima koʻrmasdi.
    """
    admin = await _token(client, "gd.sa")
    _, ota = await _yangi_vasiy(client, admin, world["ali"].id)

    r = await client.get(f"/api/v1/school/students/{world['ali'].id}", headers=_auth(ota))
    assert r.status_code == 200, r.text
    assert r.json()["full_name"] == "Aliyev Ali"

    # Va faqat oʻz farzandini — 6-qoida, X-1.
    r = await client.get(f"/api/v1/school/students/{world['vali'].id}", headers=_auth(ota))
    assert r.status_code == 403, r.text


# ─────────────────── Ikkinchi farzand va telefon ───────────────────


async def test_bir_xil_telefon_bilan_ikkinchi_hisob_ochilmaydi(
    client: AsyncClient, world: dict
) -> None:
    """Jimgina ikkinchi hisob ochilsa, ota ikkita login bilan yurardi
    va har birida bittadan farzand koʻrinardi."""
    token = await _token(client, "gd.sa")
    tel = "+998901234567"

    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "phone": tel, "relation": "father"},
    )
    assert r.status_code == 201, r.text

    # Boshqa yozilishi — probel va chiziqcha bilan. Baribir oʻsha raqam.
    r = await client.post(
        f"/api/v1/school/students/{world['vali'].id}/guardians",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Otabek",
            "phone": "+998 90 123 45 67",
            "relation": "father",
        },
    )
    assert r.status_code == 409, r.text
    # Xabar kimligini aytadi — administrator ongli tanlov qiladi.
    assert "Aliyev Otabek" in r.json()["message"]


async def test_ikkinchi_farzand_mavjud_hisobga_boglanadi(
    client: AsyncClient, world: dict
) -> None:
    """Bitta hisob — ikkita farzand (AUT-03)."""
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    user_id = r.json()["guardian"]["user_id"]

    r = await client.put(
        f"/api/v1/school/students/{world['vali'].id}/guardians",
        headers=_auth(token),
        json={"user_id": user_id, "relation": "father"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["children_count"] == 2

    # Ikkala farzand ham oʻsha hisobda koʻrinadi.
    for student in (world["ali"], world["vali"]):
        r = await client.get(
            f"/api/v1/school/students/{student.id}/guardians", headers=_auth(token)
        )
        assert user_id in {g["user_id"] for g in r.json()}


async def test_bir_vasiy_ikki_marta_boglanmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    user_id = r.json()["guardian"]["user_id"]

    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"user_id": user_id, "relation": "father"},
    )
    assert r.status_code == 409, r.text


# ─────────────────── Asosiy vasiy ───────────────────


async def test_bitta_asosiy_vasiy(client: AsyncClient, world: dict) -> None:
    """Xabarnoma birinchi navbatda asosiy vasiyga ketadi — ikkitasi
    boʻlsa qaysi biri ekani noaniq qolardi."""
    token = await _token(client, "gd.sa")

    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Otabek",
            "relation": "father",
            "is_primary": True,
        },
    )
    ota = r.json()["guardian"]["id"]

    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={
            "last_name": "Aliyeva",
            "first_name": "Nodira",
            "relation": "mother",
            "is_primary": True,
        },
    )
    assert r.status_code == 201, r.text
    ona = r.json()["guardian"]["id"]
    assert ona != ota

    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians", headers=_auth(token)
    )
    asosiylar = [g["id"] for g in r.json() if g["is_primary"]]
    assert asosiylar == [ona]


# ─────────────────── Uzish ───────────────────


async def test_uzilgan_vasiy_farzandini_kormaydi(client: AsyncClient, world: dict) -> None:
    """Uzishning butun maqsadi shu: kirish huquqi shu zahoti yopiladi.

    Uzishdan OLDIN ham tekshiriladi. Aks holda test soxta yashil
    boʻlardi: ota umuman hech qachon koʻra olmagan boʻlsa ham
    «uzildi» degan xulosa chiqarardi.
    """
    token = await _token(client, "gd.sa")
    guardian_id, ota_token = await _yangi_vasiy(client, token, world["ali"].id)

    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}", headers=_auth(ota_token)
    )
    assert r.status_code == 200, "ota uzishdan oldin farzandini koʻra olishi kerak"

    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{guardian_id}/unlink",
        headers=_auth(token),
        json={"reason": "Ota-ona ajrashdi, vasiylik onada"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_archived"] is True
    assert r.json()["is_primary"] is False

    # Endi u farzandi maʼlumotini soʻrasa — 403, 404 emas (X-3).
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}", headers=_auth(ota_token)
    )
    assert r.status_code == 403, r.text


async def test_uzish_ochirish_emas(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """1-qoida: «kim qachon kimga bogʻlangan edi» tarixi qoladi."""
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    guardian_id = r.json()["guardian"]["id"]

    await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{guardian_id}/unlink",
        headers=_auth(token),
        json={"reason": "Vasiylik oʻzgardi"},
    )

    yozuv = await session.get(Guardian, guardian_id)
    assert yozuv is not None
    assert yozuv.is_archived is True

    # Oddiy roʻyxatda yoʻq, arxiv roʻyxatida bor.
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians", headers=_auth(token)
    )
    assert r.json() == []

    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians?archived=true",
        headers=_auth(token),
    )
    assert len(r.json()) == 1


async def test_uzish_sababsiz_bolmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    guardian_id = r.json()["guardian"]["id"]

    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{guardian_id}/unlink",
        headers=_auth(token),
        json={"reason": ""},
    )
    assert r.status_code == 422, r.text


async def test_uzish_auditga_sabab_bilan_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Bu amal kimning nimani koʻrishini oʻzgartiradi — izsiz qolmaydi."""
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    guardian_id = r.json()["guardian"]["id"]

    await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{guardian_id}/unlink",
        headers=_auth(token),
        json={"reason": "Sud qarori bilan"},
    )

    rows = (
        (
            await session.execute(
                select(AuditLog).where(AuditLog.object_type == "guardian")
            )
        )
        .scalars()
        .all()
    )
    arxiv = [a for a in rows if a.action == "archive"]
    assert len(arxiv) == 1
    assert arxiv[0].new_value["reason"] == "Sud qarori bilan"
    assert arxiv[0].actor_id == world["admin"].id


async def test_boshqa_oquvchining_boglanishini_ozgartirib_bolmaydi(
    client: AsyncClient, world: dict
) -> None:
    """`guardian_id` toʻgʻri, lekin `student_id` boshqa — yoʻl ochilmaydi."""
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    guardian_id = r.json()["guardian"]["id"]

    r = await client.post(
        f"/api/v1/school/students/{world['vali'].id}/guardians/{guardian_id}/unlink",
        headers=_auth(token),
        json={"reason": "Sinov"},
    )
    assert r.status_code == 404, r.text


# ─────────────────── Huquq ───────────────────


async def test_ustoz_vasiy_biriktira_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-2: har endpoint uchun salbiy test."""
    token = await _token(client, "gd.ustoz")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    assert r.status_code == 403, r.text


async def test_notogri_qarindoshlik_turi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "amaki"},
    )
    assert r.status_code == 422, r.text


async def test_arxivlangan_oquvchiga_vasiy_qoshilmaydi(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "gd.sa")
    await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": "Boshqa maktabga koʻchdi"},
    )

    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "father"},
    )
    assert r.status_code == 404, r.text


async def test_ikkinchi_farzand_ikkalasini_ham_koradi(
    client: AsyncClient, world: dict
) -> None:
    """Bitta hisob — ikkita farzand, ikkalasi ham koʻrinadi (AUT-03).

    `test_ikkinchi_farzand_mavjud_hisobga_boglanadi` bogʻlanish
    yozuvini tekshiradi; bu esa uning natijasini — otaning oʻzi nima
    koʻrishini.
    """
    admin = await _token(client, "gd.sa")
    _, ota = await _yangi_vasiy(client, admin, world["ali"].id)

    r = await client.get(f"/api/v1/school/students/{world['vali'].id}", headers=_auth(ota))
    assert r.status_code == 403, "hali bogʻlanmagan farzand koʻrinmasligi kerak"

    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians", headers=_auth(admin)
    )
    user_id = r.json()[0]["user_id"]

    r = await client.put(
        f"/api/v1/school/students/{world['vali'].id}/guardians",
        headers=_auth(admin),
        json={"user_id": user_id, "relation": "father"},
    )
    assert r.status_code == 200, r.text

    for student in (world["ali"], world["vali"]):
        r = await client.get(f"/api/v1/school/students/{student.id}", headers=_auth(ota))
        assert r.status_code == 200, f"{student.first_name} koʻrinmadi: {r.text}"


async def test_ota_ona_turi_qabul_qilinadi(client: AsyncClient, world: dict) -> None:
    """«parent» — ota yoki ona, qaysi biri koʻrsatilmagan.

    Bu tur ATAYLAB bor: maktab koʻpincha kim ota kim ona ekanini
    alohida yozib oʻtirmaydi va bunday holatda `guardian` deb
    belgilash yolgʻon boʻlardi — u aynan «ota-ona EMAS» degani.
    """
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Otabek",
            "relation": "parent",
            "is_primary": True,
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["guardian"]["relation"] == "parent"


async def test_nomalum_qarindoshlik_turi_rad_etiladi(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "gd.sa")
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/guardians",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Otabek", "relation": "qoʻshni"},
    )
    assert r.status_code == 422
