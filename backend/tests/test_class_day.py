"""Sinf rahbari kunlik davomat ekrani (T-015, DAV-02).

TZ: «Sinf rahbari kunlik davomatni bitta ekranda, butun sinf boʻyicha
belgilay oladi.»

Salbiy testlar muhim: bu ekran sinf rahbariga BOSHQA ustozning darsini
ham belgilashga ruxsat beradi (DAV-02 shuni talab qiladi), shuning
uchun chegara aniq boʻlishi kerak — begona sinf ochilmasin, muddati
oʻtgan dars jimgina oʻtkazib yuborilmasin.
"""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    AcademicYear,
    AttendanceRecord,
    Lesson,
    Role,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    User,
)

PASSWORD = "Sinov12345!"  # noqa: S106


async def _user(session, roles, names, login, familiya):  # noqa: ANN001, ANN202
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name=familiya,
        first_name="Sinov",
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


def _dars(sinf, fan, ustoz, kun: date, period: int, tugadi) -> Lesson:  # noqa: ANN001
    return Lesson(
        class_id=sinf.id,
        subject_id=fan.id,
        teacher_id=ustoz.id,
        lesson_date=kun,
        period=period,
        starts_at=tugadi - timedelta(minutes=45),
        ends_at=tugadi,
    )


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}

    rahbar = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "cd.rahbar",
        "Rahbarov",
    )
    fanchi = await _user(session, roles, [RoleName.TEACHER.value], "cd.fanchi", "Fanchiyev")
    await _user(session, roles, [RoleName.TEACHER.value], "cd.begona", "Begonov")

    year = AcademicYear(name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25))
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(academic_year_id=year.id, name="6-A", homeroom_teacher_id=rahbar.id)
    fizika = Subject(name="Fizika")
    tarix = Subject(name="Tarix")
    session.add_all([sinf, fizika, tarix])
    await session.flush()

    ali = Student(class_id=sinf.id, last_name="Aliyev", first_name="Ali")
    vali = Student(class_id=sinf.id, last_name="Valiyev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    # Bugungi ikki dars: biri sinf rahbariniki, biri fan ustoziniki.
    tugadi = utcnow() - timedelta(minutes=20)
    kun = tugadi.date()
    d1 = _dars(sinf, fizika, rahbar, kun, 1, tugadi)
    d2 = _dars(sinf, tarix, fanchi, kun, 2, tugadi)
    # Muddati oʻtgan dars (DAV-03 oynasi yopiq) — boshqa kunda.
    eski_tugadi = utcnow() - timedelta(days=3)
    d3 = _dars(sinf, fizika, rahbar, eski_tugadi.date(), 1, eski_tugadi)
    # SHU kunda, lekin hali BOSHLANMAGAN: oldindan toʻldirib boʻlmaydi.
    kelasi = utcnow() + timedelta(hours=3)
    d4 = _dars(sinf, tarix, rahbar, kun, 8, kelasi)
    session.add_all([d1, d2, d3, d4])
    await session.commit()
    return {
        "sinf": sinf, "ali": ali, "vali": vali,
        "d1": d1, "d2": d2, "d3": d3, "d4": d4, "kun": kun,
    }


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _kun(client: AsyncClient, login: str, world: dict, kun: date | None = None):  # noqa: ANN202
    token = await _token(client, login)
    sana = (kun or world["kun"]).isoformat()
    return await client.get(
        f"/api/v1/attendance/classes/{world['sinf'].id}/day?on={sana}",
        headers=_auth(token),
    )


# ─────────────────────── Yuklash ───────────────────────


async def test_butun_kun_bitta_sorovda(client: AsyncClient, world: dict) -> None:
    """T-015 mezoni: «Bir kunlik butun sinf bitta soʻrovda yuklanadi»."""
    r = await _kun(client, "cd.rahbar", world)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["students"]) == 2
    assert len(d["lessons"]) == 3
    assert [x["period"] for x in d["lessons"]] == [1, 2, 8]
    assert {x["subject_name"] for x in d["lessons"]} == {"Fizika", "Tarix"}


async def test_belgilanmagan_katak_royxatda_yoq(client: AsyncClient, world: dict) -> None:
    """25 × 8 = 200 ta boʻsh yozuvni uzatishning maʼnosi yoʻq."""
    r = await _kun(client, "cd.rahbar", world)
    assert r.json()["marks"] == []


async def test_sinf_rahbari_begona_ustoz_darsini_ham_belgilaydi(
    client: AsyncClient, world: dict
) -> None:
    """DAV-02 ning asosi: butun kun, kim oʻtganidan qatʼi nazar."""
    r = await _kun(client, "cd.rahbar", world)
    darslar = {x["period"]: x for x in r.json()["lessons"]}
    assert darslar[2]["editable"] is True
    assert darslar[2]["teacher_name"] == "Fanchiyev S."


async def test_muddati_otgan_dars_yopiq_korinadi(
    client: AsyncClient, world: dict
) -> None:
    """DAV-03: oyna yopilgan — ustun faqat oʻqiladi."""
    r = await _kun(client, "cd.rahbar", world, world["d3"].lesson_date)
    assert r.status_code == 200, r.text
    darslar = r.json()["lessons"]
    assert len(darslar) == 1
    assert darslar[0]["editable"] is False


async def test_begona_ustoz_sinfni_ocholmaydi(client: AsyncClient, world: dict) -> None:
    """X-2: dars ham bermaydi, sinf rahbari ham emas — 403."""
    r = await _kun(client, "cd.begona", world)
    assert r.status_code == 403, r.text


async def test_fan_ustozi_oz_sinfini_koradi(client: AsyncClient, world: dict) -> None:
    """U shu sinfda dars beradi — ekran ochiladi."""
    r = await _kun(client, "cd.fanchi", world)
    assert r.status_code == 200, r.text


# ─────────────────────── Saqlash ───────────────────────


async def _saqla(client: AsyncClient, login: str, world: dict, entries: list) -> object:  # noqa: ANN401
    token = await _token(client, login)
    return await client.post(
        f"/api/v1/attendance/classes/{world['sinf'].id}/day",
        headers=_auth(token),
        json={"lesson_date": world["kun"].isoformat(), "entries": entries},
    )


async def test_ikki_dars_bitta_sorovda_saqlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    r = await _saqla(
        client,
        "cd.rahbar",
        world,
        [
            {
                "lesson_id": str(world["d1"].id),
                "rows": [
                    {"student_id": str(world["ali"].id), "status": "absent"},
                    {"student_id": str(world["vali"].id), "status": "present"},
                ],
            },
            {
                "lesson_id": str(world["d2"].id),
                "rows": [{"student_id": str(world["ali"].id), "status": "late"}],
            },
        ],
    )
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 3

    yozuvlar = await session.execute(select(AttendanceRecord))
    assert len(list(yozuvlar.scalars())) == 3


async def test_muddati_otgan_dars_butun_sorovni_rad_etadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Jimgina oʻtkazib yuborish yomonroq: ustoz belgiladim deb
    oʻylab ketardi.

    `d4` — shu kunda, lekin hali BOSHLANMAGAN dars. Uni belgilash
    ham taqiqlangan: aks holda ustoz kelasi haftani oldindan
    «toʻldirib» qoʻyishi mumkin edi.
    """
    r = await _saqla(
        client,
        "cd.rahbar",
        world,
        [
            {
                "lesson_id": str(world["d1"].id),
                "rows": [{"student_id": str(world["ali"].id), "status": "absent"}],
            },
            {
                "lesson_id": str(world["d4"].id),
                "rows": [{"student_id": str(world["ali"].id), "status": "absent"}],
            },
        ],
    )
    assert r.status_code == 403, r.text

    # Birinchi dars ham SAQLANMAGAN — tranzaksiya yaxlit.
    yozuvlar = await session.execute(select(AttendanceRecord))
    assert list(yozuvlar.scalars()) == []


async def test_boshqa_kunning_darsi_rad_etiladi(
    client: AsyncClient, world: dict
) -> None:
    r = await _saqla(
        client,
        "cd.rahbar",
        world,
        [
            {
                "lesson_id": str(world["d3"].id),
                "rows": [{"student_id": str(world["ali"].id), "status": "absent"}],
            }
        ],
    )
    assert r.status_code == 422, r.text


async def test_begona_ustoz_saqlay_olmaydi(client: AsyncClient, world: dict) -> None:
    r = await _saqla(
        client,
        "cd.begona",
        world,
        [
            {
                "lesson_id": str(world["d1"].id),
                "rows": [{"student_id": str(world["ali"].id), "status": "absent"}],
            }
        ],
    )
    assert r.status_code == 403, r.text


async def test_saqlangandan_keyin_kataklar_qaytadi(
    client: AsyncClient, world: dict
) -> None:
    await _saqla(
        client,
        "cd.rahbar",
        world,
        [
            {
                "lesson_id": str(world["d1"].id),
                "rows": [
                    {
                        "student_id": str(world["ali"].id),
                        "status": "excused",
                        "note": "Shifokorda",
                    }
                ],
            }
        ],
    )
    r = await _kun(client, "cd.rahbar", world)
    marks = r.json()["marks"]
    assert len(marks) == 1
    assert marks[0]["status"] == "excused"
    assert marks[0]["note"] == "Shifokorda"
