"""Jurnal — baho qoʻyish (JUR-01…JUR-07).

Loyiha egasi aytgan beshta qoidaning har biri uchun test:
  · ustoz faqat oʻz sinfida va OʻZ fanidan baho qoʻyadi
  · boshqa kunning bahosini oʻzgartira olmaydi (DAV-03 oynasi)
  · kelmagan va sababli oʻquvchiga baho qoʻyilmaydi
  · chorak/oʻrtacha baho fan ustoziga koʻrinmaydi
  · har oʻzgarish auditga tushadi
"""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.core.timeutil import local_today, utcnow
from app.models import (
    AcademicYear,
    AuditLog,
    Grade,
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

    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "jr.ustoz", "Aliyev")
    begona = await _user(session, roles, [RoleName.TEACHER.value], "jr.begona", "Valiyev")
    rahbar = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "jr.rahbar",
        "Nosirov",
    )
    ota = await _user(session, roles, [RoleName.PARENT.value], "jr.otaona", "Karimov")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 1), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    fizika = Subject(name="Fizika", short_name="Fiz")
    session.add_all([math, fizika])
    await session.flush()

    cls = SchoolClass(academic_year_id=year.id, name="8-A", homeroom_teacher_id=rahbar.id)
    session.add(cls)
    await session.flush()

    ali = Student(class_id=cls.id, last_name="Abdullayev", first_name="Ali")
    vali = Student(class_id=cls.id, last_name="Boboyev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    session.add(
        ScheduleEntry(
            academic_year_id=year.id,
            class_id=cls.id,
            subject_id=math.id,
            teacher_id=ustoz.id,
            weekday=1,
            period=1,
        )
    )

    bugun = local_today()
    dars = Lesson(
        class_id=cls.id,
        subject_id=math.id,
        teacher_id=ustoz.id,
        lesson_date=bugun,
        period=1,
        starts_at=utcnow() - timedelta(hours=2),
        ends_at=utcnow() - timedelta(hours=1),
    )
    # Boshqa fanning darsi — ustoz unga baho qoʻya olmasligi kerak.
    ozga = Lesson(
        class_id=cls.id,
        subject_id=fizika.id,
        teacher_id=begona.id,
        lesson_date=bugun,
        period=2,
        starts_at=utcnow() - timedelta(hours=1),
        ends_at=utcnow() - timedelta(minutes=30),
    )
    # Muddati oʻtgan dars (DAV-03).
    eski = Lesson(
        class_id=cls.id,
        subject_id=math.id,
        teacher_id=ustoz.id,
        lesson_date=bugun - timedelta(days=7),
        period=1,
        starts_at=utcnow() - timedelta(days=7, hours=2),
        ends_at=utcnow() - timedelta(days=7, hours=1),
    )
    session.add_all([dars, ozga, eski])
    await session.flush()

    return {
        "ustoz": ustoz,
        "begona": begona,
        "rahbar": rahbar,
        "ota": ota,
        "class": cls,
        "math": math,
        "fizika": fizika,
        "ali": ali,
        "vali": vali,
        "lesson": dars,
        "ozga_lesson": ozga,
        "eski_lesson": eski,
    }


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _mark(client: AsyncClient, token: str, world: dict, statuses: dict) -> None:
    """Davomat belgilaydi — baho uchun shart (3-qoida)."""
    r = await client.post(
        f"/api/v1/attendance/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={
            "rows": [
                {"student_id": str(sid), "status": st, "note": None} for sid, st in statuses.items()
            ],
            "topic": "Kvadrat tenglama",
        },
    )
    assert r.status_code == 200, r.text


# ─────────────────────────── Asosiy oqim ───────────────────────────


async def test_jurnal_davomat_bilan_ochiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "absent"})

    r = await client.get(f"/api/v1/journal/lessons/{world['lesson'].id}", headers=_auth(token))
    assert r.status_code == 200, r.text

    body = r.json()
    assert body["subject_name"] == "Matematika"
    assert body["topic"] == "Kvadrat tenglama"
    assert body["max_value"] == 5

    holat = {s["full_name"]: s for s in body["students"]}
    assert holat["Abdullayev Ali"]["gradable"] is True
    assert holat["Boboyev Vali"]["gradable"] is False


async def test_baho_qoyiladi_va_oqiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})

    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 5, "comment": "Aʼlo"}]},
    )
    assert r.status_code == 200, r.text

    ali = next(s for s in r.json()["students"] if s["full_name"] == "Abdullayev Ali")
    assert ali["grade"]["value"] == 5
    assert ali["grade"]["comment"] == "Aʼlo"


async def test_baho_olib_tashlansa_arxivlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 1-qoida: baho ham oʻchirilmaydi."""
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})

    await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 4}]},
    )
    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": None}]},
    )
    assert r.status_code == 200, r.text

    ali = next(s for s in r.json()["students"] if s["full_name"] == "Abdullayev Ali")
    assert ali["grade"] is None

    barchasi = (await session.execute(select(Grade))).scalars().all()
    assert len(barchasi) == 1, "baho oʻchirilgan — 1-qoida buzildi"
    assert barchasi[0].is_archived is True


# ─────────── 3-qoida: kelmagan oʻquvchiga baho qoʻyilmaydi ───────────


async def test_kelmagan_oquvchiga_baho_qoyilmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "absent"})

    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["vali"].id), "value": 5}]},
    )
    assert r.status_code == 422, r.text
    assert "boʻlmagan" in r.json()["message"]


async def test_sababli_oquvchiga_ham_baho_qoyilmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "excused"})

    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["vali"].id), "value": 5}]},
    )
    assert r.status_code == 422, r.text


async def test_davomatsiz_baho_qoyilmaydi(client: AsyncClient, world: dict) -> None:
    """Davomatsiz baho «keldi» ni nazarda tutardi — keyin ziddiyat chiqardi."""
    token = await _token(client, "jr.ustoz")
    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 5}]},
    )
    assert r.status_code == 422, r.text
    assert "davomat" in r.json()["message"].lower()


async def test_kechikkan_oquvchiga_baho_qoyiladi(client: AsyncClient, world: dict) -> None:
    """Kechikish — darsda boʻlgan. Baho qoʻyish mumkin."""
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "late", world["vali"].id: "present"})

    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 3}]},
    )
    assert r.status_code == 200, r.text


# ─────────── 1-qoida: oʻz sinfi va OʻZ fani ───────────


async def test_begona_ustoz_baho_qoya_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.begona")
    r = await client.get(f"/api/v1/journal/lessons/{world['lesson'].id}", headers=_auth(token))
    assert r.status_code == 403, r.text


async def test_sinf_rahbari_ozga_fandan_baho_qoya_olmaydi(client: AsyncClient, world: dict) -> None:
    """Sinf rahbari oʻz sinfining davomatini koʻradi (DAV-02), lekin
    boshqa ustozning fanidan baho qoʻymaydi."""
    token = await _token(client, "jr.rahbar")
    r = await client.get(f"/api/v1/journal/lessons/{world['ozga_lesson'].id}", headers=_auth(token))
    assert r.status_code == 403, r.text


async def test_ozga_fan_jurnalini_sorasa_403(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    bugun = local_today()
    r = await client.get(
        f"/api/v1/journal/classes/{world['class'].id}",
        headers=_auth(token),
        params={
            "subject_id": str(world["fizika"].id),
            "date_from": str(bugun - timedelta(days=7)),
            "date_to": str(bugun),
        },
    )
    assert r.status_code == 403, r.text


# ─────────── 2-qoida: boshqa kunning bahosi ───────────


async def test_muddati_otgan_darsga_baho_qoyilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """DAV-03 oynasi baho uchun ham amal qiladi."""
    token = await _token(client, "jr.ustoz")

    # Eski darsga davomat administrator qoʻygan boʻlsin deb toʻgʻridan-toʻgʻri yozamiz.
    from app.models import AttendanceRecord

    session.add(
        AttendanceRecord(
            lesson_id=world["eski_lesson"].id,
            student_id=world["ali"].id,
            status="present",
            marked_by_id=world["ustoz"].id,
            marked_at=utcnow() - timedelta(days=7),
        )
    )
    await session.flush()

    r = await client.post(
        f"/api/v1/journal/lessons/{world['eski_lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 5}]},
    )
    assert r.status_code == 403, r.text
    assert "muddat" in r.json()["message"].lower()

    # Oʻqish esa taqiqlanmaydi — ustoz oʻtgan darsni koʻra oladi.
    r = await client.get(f"/api/v1/journal/lessons/{world['eski_lesson'].id}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["editable"] is False
    assert settings.attendance_edit_window_hours > 0


# ─────────── 4-qoida: oʻrtacha fan ustoziga koʻrinmaydi ───────────


async def test_fan_ustoziga_ortacha_korinmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})
    await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 5}]},
    )

    bugun = local_today()
    r = await client.get(
        f"/api/v1/journal/classes/{world['class'].id}",
        headers=_auth(token),
        params={
            "subject_id": str(world["math"].id),
            "date_from": str(bugun - timedelta(days=7)),
            "date_to": str(bugun),
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["shows_average"] is False
    assert all(row["average"] is None for row in r.json()["rows"])
    # Baholarning oʻzi koʻrinadi — yashiriladigani faqat yakuniy koʻrsatkich.
    ali = next(x for x in r.json()["rows"] if x["full_name"] == "Abdullayev Ali")
    assert list(ali["grades"].values()) == [5]


async def test_sinf_rahbariga_ortacha_korinadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})
    await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 4}]},
    )

    token = await _token(client, "jr.rahbar")
    bugun = local_today()
    r = await client.get(
        f"/api/v1/journal/classes/{world['class'].id}",
        headers=_auth(token),
        params={
            "subject_id": str(world["math"].id),
            "date_from": str(bugun - timedelta(days=7)),
            "date_to": str(bugun),
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["shows_average"] is True
    ali = next(x for x in r.json()["rows"] if x["full_name"] == "Abdullayev Ali")
    assert ali["average"] == 4.0


async def test_fan_ustozi_sinf_ortachasini_sorasa_403(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    r = await client.get(
        f"/api/v1/journal/classes/{world['class'].id}/averages", headers=_auth(token)
    )
    assert r.status_code == 403, r.text


# ─────────── 5-qoida: audit ───────────


async def test_baho_ozgarishi_auditga_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 4-qoida: eski qiymat, yangi qiymat, kim, qachon."""
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})

    url = f"/api/v1/journal/lessons/{world['lesson'].id}"
    await client.post(
        url, headers=_auth(token), json={"rows": [{"student_id": str(world["ali"].id), "value": 3}]}
    )
    await client.post(
        url, headers=_auth(token), json={"rows": [{"student_id": str(world["ali"].id), "value": 5}]}
    )

    rows = (
        (await session.execute(select(AuditLog).where(AuditLog.object_type == "grade")))
        .scalars()
        .all()
    )
    assert len(rows) == 2
    ozgarish = next(r for r in rows if r.action == "update")
    assert ozgarish.old_value == {"value": 3}
    assert ozgarish.new_value == {"value": 5}
    assert ozgarish.actor_id == world["ustoz"].id


async def test_ozgarmagan_baho_auditga_tushmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Jurnal har ochilganda audit shishmasin."""
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})

    url = f"/api/v1/journal/lessons/{world['lesson'].id}"
    body = {"rows": [{"student_id": str(world["ali"].id), "value": 4}]}
    await client.post(url, headers=_auth(token), json=body)
    await client.post(url, headers=_auth(token), json=body)

    rows = (
        (await session.execute(select(AuditLog).where(AuditLog.object_type == "grade")))
        .scalars()
        .all()
    )
    assert len(rows) == 1


# ─────────── Oʻquvchi kesimi va ota-ona ───────────


async def test_notogri_baho_422(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})

    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "value": 9}]},
    )
    assert r.status_code == 422, r.text


async def test_begona_otaona_baholarni_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-1: URL dagi `student_id` ni oʻzgartirish."""
    token = await _token(client, "jr.otaona")
    r = await client.get(f"/api/v1/journal/students/{world['ali'].id}/grades", headers=_auth(token))
    assert r.status_code == 403, r.text


# ─────────────────────────── Reyting (REY-01) ───────────────────────────


async def test_reyting_faqat_oz_ornini_beradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Reyting: o'rin to'g'ri hisoblanadi, sinfdoshlar ma'lumoti sizmaydi (X-6)."""
    token = await _token(client, "jr.ustoz")
    await _mark(client, token, world, {world["ali"].id: "present", world["vali"].id: "present"})
    r = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={
            "rows": [
                {"student_id": str(world["ali"].id), "value": 5},
                {"student_id": str(world["vali"].id), "value": 3},
            ]
        },
    )
    assert r.status_code == 200, r.text

    rahbar = await _token(client, "jr.rahbar")
    r = await client.get(
        f"/api/v1/journal/students/{world['vali'].id}/rating", headers=_auth(rahbar)
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["rank"] == 2
    assert body["total_students"] == 2
    assert body["average"] == 3.0
    # X-6: javobda faqat o'z ko'rsatkichlari — ismlar ro'yxati yo'q.
    assert set(body) == {"rank", "total_students", "average", "attendance_percent"}


async def test_begona_otaona_reytingni_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "jr.otaona")
    r = await client.get(
        f"/api/v1/journal/students/{world['ali'].id}/rating", headers=_auth(token)
    )
    assert r.status_code == 403, r.text
