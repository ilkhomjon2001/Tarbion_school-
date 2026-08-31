"""Darslar generatsiyasi (T-012).

Eng muhim testlar:
  · chorak uchun darslar bir marta generatsiya qilinadi (idempotent)
  · taʼtil kunida dars yaratilmaydi
  · jadval oʻzgarsa, oʻtgan darslar oʻzgarmaydi
  · dars vaqti MAHALLIY qoʻngʻiroqdan hisoblanadi (CLAUDE.md 3-qoida)
"""

from datetime import date, time

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import DISPLAY_TZ
from app.models import (
    AcademicYear,
    BellSchedule,
    Holiday,
    Lesson,
    Permission,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Subject,
    User,
)
from app.services import permissions
from app.services.access import CurrentUser

PASSWORD = "Sinov12345!"  # noqa: S106

# 2026-09-07 — dushanba. Oraliq ataylab bitta toʻliq haftaga teng.
DUSHANBA = date(2026, 9, 7)
YAKSHANBA = date(2026, 9, 13)


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, object]:
    roles = await _roles(session)

    superadmin = User(
        login="gen.sa",
        password_hash=hash_password(PASSWORD),
        last_name="Boshqaruv",
        first_name="Sinov",
    )
    superadmin.roles = [roles[RoleName.SUPERADMIN.value]]
    ustoz = User(
        login="gen.ustoz",
        password_hash=hash_password(PASSWORD),
        last_name="Aliyev",
        first_name="Anvar",
    )
    ustoz.roles = [roles[RoleName.TEACHER.value]]
    session.add_all([superadmin, ustoz])
    await session.flush()

    await permissions.grant(
        session,
        target_user_id=ustoz.id,
        permission=Permission.SCHEDULE_MANAGE,
        granted_by=CurrentUser.from_model(superadmin),
    )
    await session.flush()

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    session.add_all(
        [
            BellSchedule(
                academic_year_id=year.id, period=1, starts_at=time(8, 30), ends_at=time(9, 15)
            ),
            BellSchedule(
                academic_year_id=year.id, period=2, starts_at=time(9, 25), ends_at=time(10, 10)
            ),
        ]
    )

    math = Subject(name="Matematika", short_name="Mat")
    session.add(math)
    await session.flush()

    cls = SchoolClass(academic_year_id=year.id, name="8-A")
    session.add(cls)
    await session.flush()

    # Dushanba 1-para va chorshanba 2-para.
    session.add_all(
        [
            ScheduleEntry(
                academic_year_id=year.id,
                class_id=cls.id,
                subject_id=math.id,
                teacher_id=ustoz.id,
                weekday=1,
                period=1,
                room="204",
            ),
            ScheduleEntry(
                academic_year_id=year.id,
                class_id=cls.id,
                subject_id=math.id,
                teacher_id=ustoz.id,
                weekday=3,
                period=2,
                room="204",
            ),
        ]
    )
    await session.flush()

    return {"superadmin": superadmin, "ustoz": ustoz, "year": year, "class": cls, "math": math}


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _generate(client: AsyncClient, token: str, start: date, end: date) -> dict:
    resp = await client.post(
        "/api/v1/attendance/generate",
        headers=_auth(token),
        params={"date_from": start.isoformat(), "date_to": end.isoformat()},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# ─────────────────────────── Generatsiya ───────────────────────────


async def test_hafta_uchun_darslar_yaratiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gen.ustoz")
    natija = await _generate(client, token, DUSHANBA, YAKSHANBA)
    # Bitta haftada dushanba va chorshanba — ikkita dars.
    assert natija["created"] == 2


async def test_idempotent(client: AsyncClient, world: dict, session: AsyncSession) -> None:
    """T-012 qabul mezoni: ikki marta ishga tushirilsa takror yaratilmaydi."""
    token = await _token(client, "gen.ustoz")
    await _generate(client, token, DUSHANBA, YAKSHANBA)
    ikkinchi = await _generate(client, token, DUSHANBA, YAKSHANBA)

    assert ikkinchi["created"] == 0
    assert ikkinchi["skipped_existing"] == 2

    jami = (await session.execute(select(Lesson))).scalars().all()
    assert len(jami) == 2


async def test_tatil_kunida_dars_yaratilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """T-012 qabul mezoni."""
    session.add(Holiday(academic_year_id=world["year"].id, day=DUSHANBA, title="Mustaqillik kuni"))
    await session.flush()

    token = await _token(client, "gen.ustoz")
    natija = await _generate(client, token, DUSHANBA, YAKSHANBA)

    assert natija["skipped_holidays"] == 1
    assert natija["created"] == 1, "taʼtil kuniga dars yaratildi"

    sanalar = {lesson.lesson_date for lesson in (await session.execute(select(Lesson))).scalars()}
    assert DUSHANBA not in sanalar


async def test_dars_vaqti_mahalliy_qongiroqdan(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 3-qoida: bazada UTC, lekin mahalliy 08:30 ga teng boʻlsin."""
    token = await _token(client, "gen.ustoz")
    await _generate(client, token, DUSHANBA, DUSHANBA)

    lesson = await session.scalar(select(Lesson).where(Lesson.lesson_date == DUSHANBA))
    assert lesson is not None
    mahalliy = lesson.starts_at.astimezone(DISPLAY_TZ)
    assert (mahalliy.hour, mahalliy.minute) == (8, 30)
    assert mahalliy.date() == DUSHANBA


async def test_qongiroqsiz_para_dars_bermaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Vaqtsiz dars DAV-03 oynasini hisoblab bera olmaydi — yaratilmaydi."""
    session.add(
        ScheduleEntry(
            academic_year_id=world["year"].id,
            class_id=world["class"].id,
            subject_id=world["math"].id,
            teacher_id=world["ustoz"].id,
            weekday=2,
            period=7,  # qoʻngʻiroqlar jadvalida yoʻq
            room="204",
        )
    )
    await session.flush()

    token = await _token(client, "gen.ustoz")
    natija = await _generate(client, token, DUSHANBA, YAKSHANBA)

    assert natija["missing_bells"] == [7]
    assert natija["created"] == 2


async def test_jadval_ozgarsa_otgan_darslar_ozgarmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """T-012 qabul mezoni: davomat darsga bogʻlangan, jadvalga emas."""
    token = await _token(client, "gen.ustoz")
    await _generate(client, token, DUSHANBA, DUSHANBA)

    lesson = await session.scalar(select(Lesson).where(Lesson.lesson_date == DUSHANBA))
    assert lesson is not None
    eski_ustoz = lesson.teacher_id
    eski_xona = lesson.room

    # Jadvaldagi ustozni almashtiramiz.
    entry = await session.scalar(select(ScheduleEntry).where(ScheduleEntry.weekday == 1))
    assert entry is not None
    resp = await client.patch(
        f"/api/v1/schedule/entries/{entry.id}",
        headers=_auth(token),
        json={"room": "999"},
    )
    assert resp.status_code == 200, resp.text

    await _generate(client, token, DUSHANBA, DUSHANBA)
    await session.refresh(lesson)

    assert lesson.teacher_id == eski_ustoz
    assert lesson.room == eski_xona, "oʻtgan dars jadval bilan birga oʻzgarib ketdi"


async def test_chorak_uchun_generatsiya(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gen.ustoz")
    year_id = world["year"].id

    resp = await client.put(
        f"/api/v1/academic/years/{year_id}/terms",
        headers=_auth(token),
        json={
            "terms": [
                {
                    "index": 1,
                    "name": "1-chorak",
                    "starts_on": DUSHANBA.isoformat(),
                    "ends_on": YAKSHANBA.isoformat(),
                }
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    term_id = resp.json()[0]["id"]

    resp = await client.post(f"/api/v1/attendance/generate/term/{term_id}", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["created"] == 2


async def test_teskari_sana_422(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gen.ustoz")
    resp = await client.post(
        "/api/v1/attendance/generate",
        headers=_auth(token),
        params={"date_from": YAKSHANBA.isoformat(), "date_to": DUSHANBA.isoformat()},
    )
    assert resp.status_code == 422


async def test_huquqsiz_generatsiya_qila_olmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    roles = await _roles(session)
    boshqa = User(
        login="gen.ustoz2",
        password_hash=hash_password(PASSWORD),
        last_name="Valiyev",
        first_name="Vali",
    )
    boshqa.roles = [roles[RoleName.TEACHER.value]]
    session.add(boshqa)
    await session.flush()

    token = await _token(client, "gen.ustoz2")
    resp = await client.post(
        "/api/v1/attendance/generate",
        headers=_auth(token),
        params={"date_from": DUSHANBA.isoformat(), "date_to": YAKSHANBA.isoformat()},
    )
    assert resp.status_code == 403, resp.text


# ─────────────────── Ustozning oraliqdagi darslari ───────────────────


async def test_ustoz_oraliqdagi_darslarini_oladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gen.ustoz")
    await _generate(client, token, DUSHANBA, YAKSHANBA)

    resp = await client.get(
        "/api/v1/attendance/my-lessons/range",
        headers=_auth(token),
        params={"date_from": DUSHANBA.isoformat(), "date_to": YAKSHANBA.isoformat()},
    )
    assert resp.status_code == 200, resp.text

    darslar = resp.json()
    assert len(darslar) == 2
    assert {d["class_name"] for d in darslar} == {"8-A"}
    assert darslar[0]["period"] == 1


async def test_begona_ustoz_bosh_royxat_oladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """«Mening darslarim» — boshqa ustozning darsi chiqmaydi."""
    roles = await _roles(session)
    boshqa = User(
        login="gen.ustoz3",
        password_hash=hash_password(PASSWORD),
        last_name="Nosirov",
        first_name="Nodir",
    )
    boshqa.roles = [roles[RoleName.TEACHER.value]]
    session.add(boshqa)
    await session.flush()

    token = await _token(client, "gen.ustoz")
    await _generate(client, token, DUSHANBA, YAKSHANBA)

    token = await _token(client, "gen.ustoz3")
    resp = await client.get(
        "/api/v1/attendance/my-lessons/range",
        headers=_auth(token),
        params={"date_from": DUSHANBA.isoformat(), "date_to": YAKSHANBA.isoformat()},
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_juda_uzun_oraliq_422(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "gen.ustoz")
    resp = await client.get(
        "/api/v1/attendance/my-lessons/range",
        headers=_auth(token),
        params={"date_from": "2026-09-01", "date_to": "2027-05-25"},
    )
    assert resp.status_code == 422
