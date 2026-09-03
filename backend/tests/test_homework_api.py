"""Uy vazifasi (UYV-01…UYV-07).

Eng muhim testlar:
  · vazifa berilganda har oʻquvchi uchun yozuv yaratiladi
  · muddatdan keyin topshirish `late` boʻladi; taqiqlangan boʻlsa rad etiladi
  · baholangan ish jurnalga ham tushadi (JUR-04 bitta manba)
  · begona ustoz boshqaning vazifasini koʻra olmaydi
  · ota-ona faqat oʻz farzandining vazifasini koʻradi (X-1)
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
    Grade,
    Guardian,
    Homework,
    HomeworkSubmission,
    Lesson,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    User,
)

PASSWORD = "Sinov12345!"  # noqa: S106


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(
    session: AsyncSession, roles: dict[str, Role], names: list[str], login: str, last: str
) -> User:
    u = User(login=login, password_hash=hash_password(PASSWORD), last_name=last, first_name="Sinov")
    u.roles = [roles[r] for r in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, object]:
    roles = await _roles(session)

    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "hw.ustoz", "Aliyev")
    begona = await _user(session, roles, [RoleName.TEACHER.value], "hw.begona", "Valiyev")
    ota_a = await _user(session, roles, [RoleName.PARENT.value], "hw.ota_a", "Karimov")
    ota_b = await _user(session, roles, [RoleName.PARENT.value], "hw.ota_b", "Rahimov")
    ali_u = await _user(session, roles, [RoleName.STUDENT.value], "hw.ali", "Abdullayev")
    vali_u = await _user(session, roles, [RoleName.STUDENT.value], "hw.vali", "Boboyev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 1), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    fizika = Subject(name="Fizika", short_name="Fiz")
    session.add_all([math, fizika])
    await session.flush()

    cls = SchoolClass(academic_year_id=year.id, name="8-A")
    session.add(cls)
    await session.flush()

    ali = Student(class_id=cls.id, last_name="Abdullayev", first_name="Ali", user_id=ali_u.id)
    vali = Student(class_id=cls.id, last_name="Boboyev", first_name="Vali", user_id=vali_u.id)
    session.add_all([ali, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=ota_a.id, relation="father"),
            Guardian(student_id=vali.id, user_id=ota_b.id, relation="father"),
            ScheduleEntry(
                academic_year_id=year.id,
                class_id=cls.id,
                subject_id=math.id,
                teacher_id=ustoz.id,
                weekday=1,
                period=1,
            ),
        ]
    )
    await session.flush()

    return {
        "ustoz": ustoz,
        "begona": begona,
        "ota_a": ota_a,
        "ota_b": ota_b,
        "class": cls,
        "math": math,
        "fizika": fizika,
        "ali": ali,
        "vali": vali,
    }


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


def _kelajak(soat: int = 48) -> str:
    return (utcnow() + timedelta(hours=soat)).isoformat()


async def _create(client: AsyncClient, token: str, world: dict, **farq: object) -> dict:
    body = {
        "class_id": str(world["class"].id),
        "subject_id": str(world["math"].id),
        "title": "5-mashq",
        "description": "1–10 misollar",
        "due_at": _kelajak(),
        "max_score": 5,
    }
    body.update(farq)
    r = await client.post("/api/v1/journal/homework", headers=_auth(token), json=body)
    assert r.status_code == 201, r.text
    return r.json()


# ─────────────────────────── Vazifa berish ───────────────────────────


async def test_vazifa_beriladi_va_royxatga_tushadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "hw.ustoz")
    hw = await _create(client, token, world)

    assert hw["class_name"] == "8-A"
    assert hw["subject_name"] == "Matematika"
    # UYV-05: har oʻquvchi uchun yozuv — "kim topshirmadi" shundan.
    assert hw["total_count"] == 2
    assert hw["submitted_count"] == 0

    r = await client.get("/api/v1/journal/homework", headers=_auth(token))
    assert [x["title"] for x in r.json()] == ["5-mashq"]


async def test_har_oquvchi_uchun_yozuv_yaratiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "hw.ustoz")
    hw = await _create(client, token, world)

    rows = (
        (
            await session.execute(
                select(HomeworkSubmission).where(HomeworkSubmission.homework_id == hw["id"])
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2
    assert all(r.status == "assigned" for r in rows)


async def test_ozga_fandan_vazifa_bera_olmaydi(client: AsyncClient, world: dict) -> None:
    """1-qoida jurnaldagi bilan bir xil: oʻz sinfi va oʻz fani."""
    token = await _token(client, "hw.ustoz")
    r = await client.post(
        "/api/v1/journal/homework",
        headers=_auth(token),
        json={
            "class_id": str(world["class"].id),
            "subject_id": str(world["fizika"].id),
            "title": "Fizika mashqi",
            "due_at": _kelajak(),
        },
    )
    assert r.status_code == 403, r.text


async def test_otgan_muddat_422(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "hw.ustoz")
    r = await client.post(
        "/api/v1/journal/homework",
        headers=_auth(token),
        json={
            "class_id": str(world["class"].id),
            "subject_id": str(world["math"].id),
            "title": "Kechikkan vazifa",
            "due_at": (utcnow() - timedelta(days=1)).isoformat(),
        },
    )
    assert r.status_code == 422, r.text


async def test_vazifa_arxivlanadi(client: AsyncClient, world: dict, session: AsyncSession) -> None:
    """CLAUDE.md 1-qoida."""
    token = await _token(client, "hw.ustoz")
    hw = await _create(client, token, world)

    r = await client.post(f"/api/v1/journal/homework/{hw['id']}/archive", headers=_auth(token))
    assert r.status_code == 204

    barchasi = (await session.execute(select(Homework))).scalars().all()
    assert len(barchasi) == 1, "vazifa oʻchirilgan — 1-qoida buzildi"
    assert barchasi[0].is_archived is True

    r = await client.get("/api/v1/journal/homework", headers=_auth(token))
    assert r.json() == []


# ─────────────────────────── Topshirish ───────────────────────────


async def _muddatni_orqaga(session: AsyncSession, homework_id: str) -> None:
    """Muddatni oʻtgan qilib qoʻyadi.

    `freezegun` oʻrniga sanani oʻzgartiramiz: vaqtni muzlatish asyncpg
    ulanishi bilan chalkashadi va test sekinlashadi.
    """
    row = await session.get(Homework, homework_id)
    assert row is not None
    row.due_at = utcnow() - timedelta(hours=1)
    await session.flush()


async def _submission_id(client: AsyncClient, token: str, student_id: str) -> str:
    r = await client.get(f"/api/v1/journal/students/{student_id}/homework", headers=_auth(token))
    assert r.status_code == 200, r.text
    return r.json()[0]["submission_id"]


async def test_oquvchi_topshiradi(client: AsyncClient, world: dict) -> None:
    ustoz = await _token(client, "hw.ustoz")
    await _create(client, ustoz, world)

    ota = await _token(client, "hw.ali")
    sub_id = await _submission_id(client, ota, str(world["ali"].id))

    r = await client.post(
        f"/api/v1/journal/submissions/{sub_id}/submit",
        headers=_auth(ota),
        json={"answer_text": "Hammasi bajarildi"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "submitted"


async def test_muddatdan_keyin_topshirish_late(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """UYV-04."""
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world, due_at=_kelajak(1))

    # Muddatni orqaga suramiz — vaqt oʻtganini simulyatsiya qilish uchun.
    await _muddatni_orqaga(session, hw["id"])

    ota = await _token(client, "hw.ali")
    sub_id = await _submission_id(client, ota, str(world["ali"].id))
    r = await client.post(
        f"/api/v1/journal/submissions/{sub_id}/submit", headers=_auth(ota), json={}
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "late"


async def test_kechikish_taqiqlangan_bolsa_rad_etiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world, allow_late=False)

    await _muddatni_orqaga(session, hw["id"])

    ota = await _token(client, "hw.ali")
    sub_id = await _submission_id(client, ota, str(world["ali"].id))
    r = await client.post(
        f"/api/v1/journal/submissions/{sub_id}/submit", headers=_auth(ota), json={}
    )
    assert r.status_code == 422, r.text


async def test_begona_topshiriqni_topshira_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-1: boshqa oilaning topshirigʻi."""
    ustoz = await _token(client, "hw.ustoz")
    await _create(client, ustoz, world)

    ota_a = await _token(client, "hw.ota_a")
    sub_id = await _submission_id(client, ota_a, str(world["ali"].id))

    # Begona OʻQUVCHI ham, oʻz vasiysi ham topshira olmaydi (K6).
    vali_t = await _token(client, "hw.vali")
    r = await client.post(
        f"/api/v1/journal/submissions/{sub_id}/submit", headers=_auth(vali_t), json={}
    )
    assert r.status_code == 403, r.text

    r = await client.post(
        f"/api/v1/journal/submissions/{sub_id}/submit", headers=_auth(ota_a), json={}
    )
    assert r.status_code == 403, r.text


async def test_begona_otaona_vazifalarni_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    ustoz = await _token(client, "hw.ustoz")
    await _create(client, ustoz, world)

    ota_b = await _token(client, "hw.ota_b")
    r = await client.get(
        f"/api/v1/journal/students/{world['ali'].id}/homework", headers=_auth(ota_b)
    )
    assert r.status_code == 403, r.text


# ─────────────────────────── Tekshirish ───────────────────────────


async def test_baholangan_ish_jurnalga_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """JUR-04: chorak bahosi BITTA manbadan hisoblanadi."""
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world)

    r = await client.get(f"/api/v1/journal/homework/{hw['id']}/submissions", headers=_auth(ustoz))
    assert r.status_code == 200, r.text
    sub = next(x for x in r.json()["rows"] if x["full_name"] == "Abdullayev Ali")

    r = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/grade",
        headers=_auth(ustoz),
        json={"score": 5, "comment": "Toza ish"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "graded"

    baho = await session.scalar(select(Grade).where(Grade.submission_id == sub["id"]))
    assert baho is not None, "uy vazifasi bahosi jurnalga tushmadi"
    assert baho.value == 5
    assert baho.student_id == world["ali"].id


async def test_qayta_baholanganda_yangi_baho_yaratilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world)
    r = await client.get(f"/api/v1/journal/homework/{hw['id']}/submissions", headers=_auth(ustoz))
    sub = r.json()["rows"][0]

    url = f"/api/v1/journal/submissions/{sub['id']}/grade"
    await client.post(url, headers=_auth(ustoz), json={"score": 3})
    await client.post(url, headers=_auth(ustoz), json={"score": 5})

    baholar = (
        (await session.execute(select(Grade).where(Grade.submission_id == sub["id"])))
        .scalars()
        .all()
    )
    assert len(baholar) == 1
    assert baholar[0].value == 5


async def test_ball_maksimaldan_oshsa_422(client: AsyncClient, world: dict) -> None:
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world, max_score=5)
    r = await client.get(f"/api/v1/journal/homework/{hw['id']}/submissions", headers=_auth(ustoz))
    sub = r.json()["rows"][0]

    r = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/grade",
        headers=_auth(ustoz),
        json={"score": 9},
    )
    assert r.status_code == 422, r.text


async def test_qaytarish_izohsiz_bolmaydi(client: AsyncClient, world: dict) -> None:
    """UYV-03: nima notoʻgʻri ekani aytilmasa vazifa maʼnosini yoʻqotadi."""
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world)
    r = await client.get(f"/api/v1/journal/homework/{hw['id']}/submissions", headers=_auth(ustoz))
    sub = r.json()["rows"][0]

    r = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/return",
        headers=_auth(ustoz),
        json={"comment": ""},
    )
    assert r.status_code == 422, r.text

    r = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/return",
        headers=_auth(ustoz),
        json={"comment": "3-misol notoʻgʻri, qayta ishlang."},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "returned"


async def test_begona_ustoz_ishlarni_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world)

    begona = await _token(client, "hw.begona")
    r = await client.get(f"/api/v1/journal/homework/{hw['id']}/submissions", headers=_auth(begona))
    assert r.status_code == 403, r.text


async def test_baholangan_ish_qayta_topshirilmaydi(client: AsyncClient, world: dict) -> None:
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world)
    r = await client.get(f"/api/v1/journal/homework/{hw['id']}/submissions", headers=_auth(ustoz))
    sub = next(x for x in r.json()["rows"] if x["full_name"] == "Abdullayev Ali")
    await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/grade",
        headers=_auth(ustoz),
        json={"score": 4},
    )

    ota = await _token(client, "hw.ali")
    r = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/submit", headers=_auth(ota), json={}
    )
    assert r.status_code == 422, r.text


async def test_topshirilmagan_vazifalar_filtri(client: AsyncClient, world: dict) -> None:
    """UYV-07: oʻquvchiga "bajarilmagan" roʻyxati kerak."""
    ustoz = await _token(client, "hw.ustoz")
    await _create(client, ustoz, world)

    ota = await _token(client, "hw.ali")
    r = await client.get(
        f"/api/v1/journal/students/{world['ali'].id}/homework",
        headers=_auth(ota),
        params={"only_open": "true"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 1

    sub_id = r.json()[0]["submission_id"]
    await client.post(f"/api/v1/journal/submissions/{sub_id}/submit", headers=_auth(ota), json={})

    r = await client.get(
        f"/api/v1/journal/students/{world['ali'].id}/homework",
        headers=_auth(ota),
        params={"only_open": "true"},
    )
    assert r.json() == []


async def test_yuz_ballik_baho_ortachani_buzmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """K1 (audit): 100 ballik vazifa bahosi 5 ballik shkalaga keltiriladi.

    80/100 jurnal oʻrtachasida 4.0 boʻlishi kerak, 80 emas — aks holda
    ota-ona va direktor "oʻrtacha 20+" koʻrardi.
    """
    ustoz = await _token(client, "hw.ustoz")
    hw = await _create(client, ustoz, world, max_score=100)

    r = await client.get(f"/api/v1/journal/homework/{hw['id']}/submissions", headers=_auth(ustoz))
    sub = next(x for x in r.json()["rows"] if x["full_name"] == "Abdullayev Ali")
    r = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/grade",
        headers=_auth(ustoz),
        json={"score": 80},
    )
    assert r.status_code == 200, r.text

    # Ota-ona farzandining baholarini koʻradi (X-1 doirasida).
    ota = await _token(client, "hw.ota_a")
    r = await client.get(
        f"/api/v1/journal/students/{world['ali'].id}/grades", headers=_auth(ota)
    )
    assert r.status_code == 200, r.text
    fanlar = r.json()
    mat = next(f for f in fanlar if f["subject_name"] == "Matematika")
    assert mat["average"] is not None
    assert mat["average"] <= 5, f"oʻrtacha 5 dan oshdi: {mat['average']}"
    assert abs(mat["average"] - 4.0) < 0.01


# ──────────────── Oʻtilgan mavzu asosida vazifa (UYV-01) ────────────────
#
# Loyiha egasining soʻrovi (2026-09-03): ustoz vazifaga oʻzi oʻylab
# topgan nom qoʻymasin — oʻtilgan darsni tanlasin, mavzu jurnaldan
# olinsin.


async def _dars(
    session: AsyncSession,
    world: dict,
    *,
    soat_oldin: int,
    topic: str | None = None,
    subject: object = None,
    period: int = 1,
) -> Lesson:
    """Berilgan vaqtda boshlanadigan dars. Manfiy `soat_oldin` — kelajak."""
    boshi = utcnow() - timedelta(hours=soat_oldin)
    lesson = Lesson(
        class_id=world["class"].id,
        subject_id=(subject or world["math"]).id,
        teacher_id=world["ustoz"].id,
        lesson_date=boshi.date(),
        period=period,
        starts_at=boshi,
        ends_at=boshi + timedelta(minutes=45),
        topic=topic,
    )
    session.add(lesson)
    await session.flush()
    return lesson


async def test_otilgan_darslar_royxati_kelajakdagini_bermaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    otgan = await _dars(session, world, soat_oldin=24, topic="Kasrlar")
    await _dars(session, world, soat_oldin=-24, topic="Darajalar", period=2)

    token = await _token(client, "hw.ustoz")
    r = await client.get(
        "/api/v1/journal/homework/lessons",
        headers=_auth(token),
        params={"class_id": str(world["class"].id), "subject_id": str(world["math"].id)},
    )
    assert r.status_code == 200, r.text
    rows = r.json()
    assert [x["id"] for x in rows] == [str(otgan.id)]
    assert rows[0]["topic"] == "Kasrlar"


async def test_begona_ustoz_darslar_royxatini_ololmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """X-2: bu fandan bu sinfda dars bermaydigan ustozga `403`."""
    await _dars(session, world, soat_oldin=24, topic="Kasrlar")

    token = await _token(client, "hw.begona")
    r = await client.get(
        "/api/v1/journal/homework/lessons",
        headers=_auth(token),
        params={"class_id": str(world["class"].id), "subject_id": str(world["math"].id)},
    )
    assert r.status_code == 403, r.text


async def test_vazifa_darsga_boglanadi_va_mavzu_qaytadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    lesson = await _dars(session, world, soat_oldin=3, topic="Oddiy kasrlarni qoʻshish")

    token = await _token(client, "hw.ustoz")
    hw = await _create(client, token, world, lesson_id=str(lesson.id))
    assert hw["lesson_id"] == str(lesson.id)
    assert hw["topic"] == "Oddiy kasrlarni qoʻshish"

    # Roʻyxatda ham mavzu koʻrinadi — sarlavha ostida.
    r = await client.get("/api/v1/journal/homework", headers=_auth(token))
    assert r.json()[0]["topic"] == "Oddiy kasrlarni qoʻshish"


async def test_boshqa_fan_darsiga_boglab_bolmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Fan mos kelmasa `404` — mavzu chalkashib ketmasin."""
    fizika_darsi = await _dars(session, world, soat_oldin=3, subject=world["fizika"], period=3)

    token = await _token(client, "hw.ustoz")
    r = await client.post(
        "/api/v1/journal/homework",
        headers=_auth(token),
        json={
            "class_id": str(world["class"].id),
            "subject_id": str(world["math"].id),
            "title": "5-mashq",
            "due_at": _kelajak(),
            "lesson_id": str(fizika_darsi.id),
        },
    )
    assert r.status_code == 404, r.text


async def test_kelajakdagi_darsga_vazifa_berilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    lesson = await _dars(session, world, soat_oldin=-5, topic="Darajalar", period=4)

    token = await _token(client, "hw.ustoz")
    r = await client.post(
        "/api/v1/journal/homework",
        headers=_auth(token),
        json={
            "class_id": str(world["class"].id),
            "subject_id": str(world["math"].id),
            "title": "5-mashq",
            "due_at": _kelajak(),
            "lesson_id": str(lesson.id),
        },
    )
    assert r.status_code == 422, r.text
