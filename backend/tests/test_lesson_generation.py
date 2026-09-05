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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import DISPLAY_TZ, combine_local
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
    # ADM-10 almashtirish testlari uchun ikkinchi ustoz.
    boshqa = User(
        login="gen.boshqa",
        password_hash=hash_password(PASSWORD),
        last_name="Valiyev",
        first_name="Vali",
    )
    boshqa.roles = [roles[RoleName.TEACHER.value]]
    session.add_all([superadmin, ustoz, boshqa])
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

    return {
        "superadmin": superadmin,
        "ustoz": ustoz,
        "boshqa": boshqa,
        "year": year,
        "class": cls,
        "math": math,
    }


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

    # Y4 (audit): KELAJAKDAGI toza dars jadvalga ERGASHADI — yangi xona
    # unda ham koʻrinadi. Ustoz oʻzgartirilmagani uchun oʻsha qoladi.
    assert lesson.teacher_id == eski_ustoz
    assert lesson.room == "999", "kelajak dars jadval oʻzgarishiga ergashishi kerak (Y4)"


async def test_otgan_dars_jadval_ozgarsa_qotadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """T-012 mezoni + Y4 chegarasi: OʻTGAN dars jadval bilan oʻzgarmaydi."""
    from datetime import date as _date

    token = await _token(client, "gen.ustoz")
    await _generate(client, token, DUSHANBA, DUSHANBA)

    lesson = await session.scalar(select(Lesson).where(Lesson.lesson_date == DUSHANBA))
    assert lesson is not None
    # Darsni sun'iy ravishda oʻtmishga suramiz — davomatli tarixiy dars kabi.
    lesson.lesson_date = _date(2026, 8, 24)
    await session.commit()
    eski_xona = lesson.room

    entry = await session.scalar(select(ScheduleEntry).where(ScheduleEntry.weekday == 1))
    assert entry is not None
    resp = await client.patch(
        f"/api/v1/schedule/entries/{entry.id}",
        headers=_auth(token),
        json={"room": "777"},
    )
    assert resp.status_code == 200, resp.text

    await session.refresh(lesson)
    assert lesson.room == eski_xona, "oʻtgan dars jadval bilan birga oʻzgarib ketdi"
    assert lesson.is_archived is False


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


# ─────────────── Jadval istisnolari (ADM-10) ───────────────


async def _bir_dars(client: AsyncClient, token: str, session: AsyncSession) -> Lesson:
    """Bitta hafta generatsiya qilinadi va dushanbaning darsi qaytadi."""
    await _generate(client, token, DUSHANBA, YAKSHANBA)
    return (
        await session.execute(
            select(Lesson).where(Lesson.lesson_date == DUSHANBA, Lesson.period == 1)
        )
    ).scalar_one()


async def test_dars_bekor_qilinadi_va_arxivlanmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Arxivlansa keyingi generatsiya darsni QAYTA yaratardi."""
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)

    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/cancel",
        headers=_auth(token),
        json={"reason": "Ustoz kasal"},
    )
    assert r.status_code == 204, r.text

    await session.refresh(dars)
    assert dars.cancelled_at is not None
    assert dars.cancel_reason == "Ustoz kasal"
    assert dars.is_archived is False


async def test_bekor_qilingan_dars_qayta_yaratilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)
    await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/cancel",
        headers=_auth(token),
        json={"reason": "Ustoz kasal"},
    )

    natija = await _generate(client, token, DUSHANBA, YAKSHANBA)
    assert natija["created"] == 0

    soni = (
        await session.execute(
            select(func.count())
            .select_from(Lesson)
            .where(Lesson.lesson_date == DUSHANBA, Lesson.period == 1)
        )
    ).scalar_one()
    assert soni == 1


async def test_bekor_qilishda_sabab_majburiy(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)

    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/cancel",
        headers=_auth(token),
        json={"reason": ""},
    )
    assert r.status_code == 422


async def test_bekor_qilingan_darsga_davomat_olinmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Dars oʻtmagan — «keldi/kelmadi» savolining oʻzi yoʻq."""
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)
    await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/cancel",
        headers=_auth(token),
        json={"reason": "Bino taʼmirda"},
    )

    r = await client.post(
        f"/api/v1/attendance/lessons/{dars.id}",
        headers=_auth(token),
        json={"rows": []},
    )
    assert r.status_code == 422


async def test_bekor_qilish_qaytariladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)
    await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/cancel",
        headers=_auth(token),
        json={"reason": "Xato bosildi"},
    )

    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/restore", headers=_auth(token)
    )
    assert r.status_code == 204

    await session.refresh(dars)
    assert dars.cancelled_at is None


async def test_ustoz_vaqtincha_almashtiriladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Jadval TEGILMAYDI — almashtirish bitta sanaga tegishli."""
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)

    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/substitute",
        headers=_auth(token),
        json={"teacher_id": str(world["boshqa"].id), "note": "Ustoz malaka oshirishda"},
    )
    assert r.status_code == 204, r.text

    await session.refresh(dars)
    assert dars.teacher_id == world["boshqa"].id
    assert dars.is_substituted is True

    # Jadval yozuvi oʻzgarmagan: keyingi haftaning darsi eski ustozda.
    keyingi = (
        await session.execute(
            select(ScheduleEntry).where(ScheduleEntry.weekday == 1)
        )
    ).scalar_one()
    assert keyingi.teacher_id == world["ustoz"].id


async def test_band_ustozni_almashtirib_bolmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """ADM-09: bitta ustoz bir vaqtda ikki joyda dars bera olmaydi."""
    token = await _token(client, "gen.ustoz")
    await _generate(client, token, DUSHANBA, YAKSHANBA)

    # Ikkinchi sinf va shu vaqtdagi dars — «boshqa» ustoz band boʻlsin.
    cls2 = SchoolClass(academic_year_id=world["year"].id, name="8-B")
    session.add(cls2)
    await session.flush()
    session.add(
        Lesson(
            class_id=cls2.id,
            subject_id=world["math"].id,
            teacher_id=world["boshqa"].id,
            lesson_date=DUSHANBA,
            period=1,
            starts_at=combine_local(DUSHANBA, time(8, 30)),
            ends_at=combine_local(DUSHANBA, time(9, 15)),
        )
    )
    await session.commit()

    dars = (
        await session.execute(
            select(Lesson).where(
                Lesson.lesson_date == DUSHANBA,
                Lesson.period == 1,
                Lesson.class_id == world["class"].id,
            )
        )
    ).scalar_one()

    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/substitute",
        headers=_auth(token),
        json={"teacher_id": str(world["boshqa"].id)},
    )
    assert r.status_code == 409


async def test_dars_boshqa_paraga_kochiriladi_va_vaqti_qayta_hisoblanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Vaqt qoʻngʻiroqdan qayta olinadi — DAV-03 oynasi toʻgʻri sanalsin."""
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)

    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/move",
        headers=_auth(token),
        json={"period": 2, "room": "305", "note": "Xona band edi"},
    )
    assert r.status_code == 204, r.text

    await session.refresh(dars)
    assert dars.period == 2
    assert dars.room == "305"
    # 2-para 09:25 da boshlanadi (fixture'dagi qoʻngʻiroq).
    assert dars.starts_at.astimezone(DISPLAY_TZ).time() == time(9, 25)


async def test_qongiroqsiz_paraga_kochirilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Vaqtsiz dars DAV-03 oynasini hisoblab bera olmaydi."""
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)

    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/move",
        headers=_auth(token),
        json={"period": 7},
    )
    assert r.status_code == 422


async def test_huquqsiz_odam_darsni_bekor_qila_olmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """`schedule.manage` yoʻq — `403`."""
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)

    begona = await _token(client, "gen.boshqa")
    r = await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/cancel",
        headers=_auth(begona),
        json={"reason": "Shunchaki"},
    )
    assert r.status_code == 403


async def test_istisnolar_royxati(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "gen.ustoz")
    dars = await _bir_dars(client, token, session)
    await client.post(
        f"/api/v1/schedule/lessons/{dars.id}/cancel",
        headers=_auth(token),
        json={"reason": "Ustoz kasal"},
    )

    r = await client.get(
        "/api/v1/schedule/exceptions",
        headers=_auth(token),
        params={"date_from": str(DUSHANBA), "date_to": str(YAKSHANBA)},
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["is_cancelled"] is True
    assert rows[0]["cancel_reason"] == "Ustoz kasal"
    assert rows[0]["class_name"] == "8-A"
