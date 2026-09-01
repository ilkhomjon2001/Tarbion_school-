"""Ota-ona kabineti (T-016). TZ: OTA-01, OTA-02, OTA-03.

Bu fayldagi eng muhim test — `test_begona_bolaning_davomatini_kora_olmaydi`.
U CLAUDE.md 6-qoidasining va X-1 ning amaliy tekshiruvi: ota-ona URL dagi
`student_id` ni oʻzgartirib boshqa oilaning bolasiga yeta olmasligi kerak.

Bu OWASP API Top 10 dagi 1-raqamli zaiflik (BOLA). Tizimdagi maʼlumot
voyaga yetmaganlarga tegishli — bu yerdagi xato oddiy bug emas.
"""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import local_today, utcnow
from app.models import (
    AcademicYear,
    AttendanceRecord,
    Guardian,
    Lesson,
    Role,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    User,
)

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
    )
    user.roles = [roles[r] for r in role_names]
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, object]:
    """Ikki oila, ikki sinf.

    Ota-ona A ning ikkita farzandi bor (farzand almashtirgichni sinash
    uchun), ota-ona B ning bittasi — u «begona» rolini oʻynaydi.
    """
    roles = await _roles(session)

    teacher = await _user(session, roles, [RoleName.TEACHER.value], "ota.ustoz", "Ustozov")
    parent_a = await _user(session, roles, [RoleName.PARENT.value], "ota.aliyev", "Aliyev")
    parent_b = await _user(session, roles, [RoleName.PARENT.value], "ota.valiyev", "Valiyev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 24), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    session.add(math)
    class_a = SchoolClass(academic_year_id=year.id, name="8-A", homeroom_teacher_id=teacher.id)
    class_b = SchoolClass(academic_year_id=year.id, name="6-B", homeroom_teacher_id=teacher.id)
    session.add_all([class_a, class_b])
    await session.flush()

    ali = Student(class_id=class_a.id, last_name="Aliyev", first_name="Ali")
    zarina = Student(class_id=class_b.id, last_name="Aliyeva", first_name="Zarina")
    vali = Student(class_id=class_b.id, last_name="Valiyev", first_name="Vali")
    session.add_all([ali, zarina, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=parent_a.id, relation="father"),
            Guardian(student_id=zarina.id, user_id=parent_a.id, relation="father"),
            Guardian(student_id=vali.id, user_id=parent_b.id, relation="mother"),
        ]
    )

    bugun = local_today()
    now = utcnow()
    dars = Lesson(
        class_id=class_a.id,
        subject_id=math.id,
        teacher_id=teacher.id,
        lesson_date=bugun,
        period=1,
        room="8-A",
        starts_at=now - timedelta(hours=2),
        ends_at=now - timedelta(hours=1),
    )
    # Oʻtgan oydagi dars — sana filtrini sinash uchun.
    otgan_oy = bugun.replace(day=1) - timedelta(days=5)
    eski_dars = Lesson(
        class_id=class_a.id,
        subject_id=math.id,
        teacher_id=teacher.id,
        lesson_date=otgan_oy,
        period=1,
        room="8-A",
        starts_at=now - timedelta(days=40),
        ends_at=now - timedelta(days=40) + timedelta(minutes=45),
    )
    session.add_all([dars, eski_dars])
    await session.flush()

    session.add_all(
        [
            AttendanceRecord(
                lesson_id=dars.id,
                student_id=ali.id,
                status="absent",
                note="Kasal",
                marked_by_id=teacher.id,
                marked_at=now,
            ),
            AttendanceRecord(
                lesson_id=eski_dars.id,
                student_id=ali.id,
                status="present",
                marked_by_id=teacher.id,
                marked_at=now,
            ),
        ]
    )
    await session.flush()

    return {
        "parent_a": parent_a,
        "parent_b": parent_b,
        "ali": ali,
        "zarina": zarina,
        "vali": vali,
        "bugun": bugun,
        "otgan_oy": otgan_oy,
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────── OTA-02: farzandlar ───────────────────────


async def test_otaona_faqat_oz_farzandlarini_koradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ota.aliyev")
    resp = await client.get("/api/v1/parent/children", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    bolalar = resp.json()
    assert len(bolalar) == 2
    ismlar = {b["full_name"] for b in bolalar}
    assert ismlar == {"Aliyev Ali", "Aliyeva Zarina"}
    # Begona bola roʻyxatda yoʻq
    assert "Valiyev Vali" not in ismlar


async def test_farzandlar_royxatida_shaxsiy_malumot_yoq(client: AsyncClient, world: dict) -> None:
    """X-6: roʻyxat endpointida telefon, manzil, hujjat boʻlmaydi."""
    token = await _token(client, "ota.aliyev")
    resp = await client.get("/api/v1/parent/children", headers=_auth(token))

    maydonlar = set(resp.json()[0])
    assert maydonlar == {
        "student_id",
        "full_name",
        "short_name",
        "class_name",
        "relation",
        "is_archived",  # O7: qarzi qolgan ketgan farzand belgisi
    }


async def test_tokensiz_farzandlar_royxati_yopiq(client: AsyncClient, world: dict) -> None:
    resp = await client.get("/api/v1/parent/children")
    assert resp.status_code == 401


# ─────────────────────── X-1: eng muhim test ───────────────────────


async def test_begona_bolaning_davomatini_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    """OWASP API Top 10 #1 (BOLA).

    Ota-ona B, URL dagi id ni ota-ona A ning bolasiga oʻzgartiradi.
    """
    token = await _token(client, "ota.valiyev")
    resp = await client.get(
        f"/api/v1/parent/children/{world['ali'].id}/attendance", headers=_auth(token)
    )
    assert resp.status_code == 403

    # X-3: xabar umumiy — bolaning mavjudligi, ismi va sinfi oshkor boʻlmaydi.
    xabar = resp.json()["message"].lower()
    assert "ali" not in xabar
    assert "8-a" not in xabar


async def test_oz_bolasining_davomatini_koradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "ota.aliyev")
    resp = await client.get(
        f"/api/v1/parent/children/{world['ali'].id}/attendance", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text

    kunlar = resp.json()
    assert len(kunlar) == 1  # joriy oydagi bitta kun
    assert kunlar[0]["date"] == world["bugun"].isoformat()
    assert kunlar[0]["lessons"][0]["status"] == "absent"
    assert kunlar[0]["lessons"][0]["note"] == "Kasal"


async def test_mavjud_bolmagan_bola_uchun_ham_403(client: AsyncClient, world: dict) -> None:
    """X-3: `404` obyekt mavjudligini oshkor qilardi va id larni
    sanab chiqishga yoʻl ochardi. Har doim `403`."""
    import uuid as _uuid

    token = await _token(client, "ota.aliyev")
    resp = await client.get(
        f"/api/v1/parent/children/{_uuid.uuid4()}/attendance", headers=_auth(token)
    )
    assert resp.status_code == 403


# ─────────────────────── OTA-03: sana filtri ───────────────────────


async def test_sukut_boyicha_joriy_oy(client: AsyncClient, world: dict) -> None:
    """Oʻtgan oydagi dars sukut boʻyicha chiqmaydi."""
    token = await _token(client, "ota.aliyev")
    resp = await client.get(
        f"/api/v1/parent/children/{world['ali'].id}/attendance", headers=_auth(token)
    )
    sanalar = {k["date"] for k in resp.json()}
    assert world["otgan_oy"].isoformat() not in sanalar


async def test_sana_oraligi_berilganda_eski_kun_ham_chiqadi(
    client: AsyncClient, world: dict
) -> None:
    token = await _token(client, "ota.aliyev")
    resp = await client.get(
        f"/api/v1/parent/children/{world['ali'].id}/attendance"
        f"?date_from={world['otgan_oy']}&date_to={world['bugun']}",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    sanalar = {k["date"] for k in resp.json()}
    assert world["otgan_oy"].isoformat() in sanalar
    assert world["bugun"].isoformat() in sanalar


async def test_davomat_belgilanmagan_bola_bosh_royxat_oladi(
    client: AsyncClient, world: dict
) -> None:
    """Zarinaning darsi yoʻq — boʻsh roʻyxat, xato emas.

    Kabinet «Bugun dars yoʻq» matnini koʻrsatadi.
    """
    token = await _token(client, "ota.aliyev")
    resp = await client.get(
        f"/api/v1/parent/children/{world['zarina'].id}/attendance", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ─────────────────────── DAV-06 bilan bogʻlanish ───────────────────────


async def test_foiz_endpointi_ham_oz_bolasi_bilan_cheklangan(
    client: AsyncClient, world: dict
) -> None:
    """Ota-ona `/attendance/stats` orqali ham chetlab oʻta olmaydi."""
    token = await _token(client, "ota.valiyev")
    resp = await client.get(
        f"/api/v1/attendance/stats?student_id={world['ali'].id}", headers=_auth(token)
    )
    assert resp.status_code == 403
