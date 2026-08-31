"""Bildirishnomalar: kirish nazorati va hodisadan xabargacha boʻlgan yoʻl.

Eng muhim testlar — salbiy testlar (X-2). Bildirishnoma matnida bolaning
ismi va nima boʻlgani turadi («Aliyev Ali darsga kelmadi»), demak begona
odamga koʻrinib qolsa bu oddiy nomuvofiqlik emas.

Tekshiriladigan hujum yoʻllari:
  · ota-ona B → ota-ona A ning bildirishnomalari
  · ota-ona B → begona bildirishnomani «oʻqildi» deb belgilash
  · ustoz → oʻzi belgilagan davomat boʻyicha oʻziga xabar (kelmasligi kerak)
  · oʻquv boʻlimi → murojaat bildirishnomasi (ataylab yopiq)

Va oqimning oʻzi: davomat belgilandi → oilada xabar, murojaatga javob
yozildi → narigi tomonda xabar, oʻqildi → sanoq kamaydi.
"""

from datetime import date, time, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import combine_local, utcnow
from app.models import (
    AcademicYear,
    Guardian,
    Lesson,
    Notification,
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
    """Bitta sinf, ikki oila. Dars BUGUN — DAV-03 oynasi ochiq boʻlsin.

    Sana qatʼiy yozilmaydi: 24 soatlik tahrirlash oynasi oʻtib ketsa
    davomat saqlanmasdi va test kalendarga qarab yiqilardi.
    """
    roles = await _roles(session)

    admin = await _user(session, roles, [RoleName.ADMIN.value], "bild.admin", "Adminov")
    academic = await _user(
        session, roles, [RoleName.ACADEMIC.value], "bild.oquvbolim", "Oquvchiyev"
    )
    teacher = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "bild.ustoz",
        "Ustozov",
    )
    parent_a = await _user(session, roles, [RoleName.PARENT.value], "bild.otaona_a", "Aliyev")
    parent_b = await _user(session, roles, [RoleName.PARENT.value], "bild.otaona_b", "Valiyev")
    student_user = await _user(
        session, roles, [RoleName.STUDENT.value], "bild.oquvchi", "Aliyev"
    )

    today = utcnow().date()
    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 24), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    session.add(math)
    school_class = SchoolClass(
        academic_year_id=year.id, name="8-A", homeroom_teacher_id=teacher.id
    )
    session.add(school_class)
    await session.flush()

    # Ali — oʻz hisobi bor. Vali — yoʻq: 1-bosqichda hamma oʻquvchida
    # hisob boʻlmasligi mumkin va bu yiqilishga sabab boʻlmasligi kerak.
    ali = Student(
        class_id=school_class.id,
        user_id=student_user.id,
        last_name="Aliyev",
        first_name="Ali",
    )
    vali = Student(class_id=school_class.id, last_name="Valiyev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=parent_a.id, relation="father"),
            Guardian(student_id=vali.id, user_id=parent_b.id, relation="father"),
        ]
    )

    lesson = Lesson(
        class_id=school_class.id,
        subject_id=math.id,
        teacher_id=teacher.id,
        lesson_date=today,
        period=1,
        room="8-A",
        starts_at=combine_local(today, time(8, 30)),
        ends_at=combine_local(today, time(9, 15)),
    )
    session.add(lesson)

    # Uy vazifasi berish uchun jadvalda yozuv boʻlishi shart
    # (`assert_teaches_class_subject` manbasi — jadval, `teacher_subjects`
    # emas). Bahoga kerak emas: dars ustozniki.
    session.add(
        ScheduleEntry(
            academic_year_id=year.id,
            class_id=school_class.id,
            subject_id=math.id,
            teacher_id=teacher.id,
            weekday=1,
            period=1,
        )
    )
    await session.flush()

    return {
        "admin": admin,
        "academic": academic,
        "teacher": teacher,
        "parent_a": parent_a,
        "parent_b": parent_b,
        "student_user": student_user,
        "ali": ali,
        "vali": vali,
        "lesson": lesson,
        "class": school_class,
        "math": math,
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _mark(client: AsyncClient, world: dict, *pairs: tuple[str, str]) -> dict:
    """Davomat belgilaydi: `("ali", "absent")` koʻrinishida."""
    token = await _token(client, "bild.ustoz")
    resp = await client.post(
        f"/api/v1/attendance/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world[k].id), "status": s} for k, s in pairs]},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _list(client: AsyncClient, login: str, **params) -> list[dict]:
    token = await _token(client, login)
    resp = await client.get("/api/v1/notifications", headers=_auth(token), params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _badges(client: AsyncClient, login: str) -> dict:
    token = await _token(client, login)
    resp = await client.get("/api/v1/notifications/badges", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


# ───────────────────────── Davomat → oila ─────────────────────────


async def test_absent_notifies_guardian_and_student(client: AsyncClient, world: dict) -> None:
    """Oʻquvchi kelmasa — ota-onasi ham, oʻzi ham xabar oladi."""
    await _mark(client, world, ("ali", "absent"), ("vali", "present"))

    ota = await _list(client, "bild.otaona_a")
    assert len(ota) == 1
    assert ota[0]["kind"] == "attendance_absent"
    assert ota[0]["title"] == "Aliyev Ali darsga kelmadi"
    assert "Matematika" in ota[0]["body"]
    assert ota[0]["student_name"] == "Aliyev Ali"
    # Ota-ona kabinetida bu «Davomat» boʻlimida sanaladi.
    assert ota[0]["section"] == "/ota-ona/davomat"

    oquvchi = await _list(client, "bild.oquvchi")
    assert len(oquvchi) == 1
    # Oʻquvchi kabinetida davomat boʻlimi yoʻq — bosh sahifada sanaladi.
    assert oquvchi[0]["section"] == "/student"


async def test_late_has_its_own_kind(client: AsyncClient, world: dict) -> None:
    """«Kechikdi» «kelmadi» dan alohida turkum."""
    await _mark(client, world, ("ali", "late"))

    ota = await _list(client, "bild.otaona_a")
    assert ota[0]["kind"] == "attendance_late"
    assert ota[0]["title"] == "Aliyev Ali darsga kechikdi"
    assert ota[0]["kind_label"] == "Darsga kechikdi"


async def test_present_creates_no_notification(client: AsyncClient, world: dict) -> None:
    """Kelgan bola haqida xabar yuborilmaydi — bu shovqin boʻlardi."""
    await _mark(client, world, ("ali", "present"), ("vali", "present"))
    assert await _list(client, "bild.otaona_a") == []


async def test_excused_creates_no_notification(client: AsyncClient, world: dict) -> None:
    """«Sababli» — oila oʻzi maʼlum qilgan, qaytarib xabar berilmaydi."""
    await _mark(client, world, ("ali", "excused"))
    assert await _list(client, "bild.otaona_a") == []


async def test_teacher_gets_no_notification_from_own_marking(
    client: AsyncClient, world: dict
) -> None:
    """Oʻz amalidan xabar kelmaydi.

    Ustoz davomatni oʻzi belgiladi — unga «Ali kelmadi» deb qaytarish
    qoʻngʻiroqni foydasiz toʻldirardi.
    """
    await _mark(client, world, ("ali", "absent"))
    assert await _list(client, "bild.ustoz") == []


async def test_resaving_same_attendance_does_not_repeat(
    client: AsyncClient, world: dict
) -> None:
    """Ustoz jurnalni qayta saqlasa ikkinchi xabar ketmaydi.

    Shart holat OʻZGARISHIGA bogʻlangan, yozuvning mavjudligiga emas —
    aks holda har saqlashda ota-onaga bir xil xabar borardi.
    """
    await _mark(client, world, ("ali", "absent"))
    await _mark(client, world, ("ali", "absent"))
    assert len(await _list(client, "bild.otaona_a")) == 1


async def test_correcting_absent_to_present_sends_nothing_new(
    client: AsyncClient, world: dict
) -> None:
    """Xato tuzatilsa yangi xabar chiqmaydi (eskisi joyida qoladi)."""
    await _mark(client, world, ("ali", "absent"))
    await _mark(client, world, ("ali", "present"))
    assert len(await _list(client, "bild.otaona_a")) == 1


async def test_guardian_of_other_child_sees_nothing(client: AsyncClient, world: dict) -> None:
    """X-1: ota-ona B, Ali kelmagani haqida xabar OLMAYDI."""
    await _mark(client, world, ("ali", "absent"), ("vali", "present"))
    assert await _list(client, "bild.otaona_b") == []


async def test_student_without_account_does_not_break_marking(
    client: AsyncClient, world: dict
) -> None:
    """Hisobi yoʻq oʻquvchi davomatni yiqitmaydi — vasiy baribir xabar oladi."""
    result = await _mark(client, world, ("vali", "absent"))
    assert result["created"] == 1

    ota = await _list(client, "bild.otaona_b")
    assert len(ota) == 1
    assert ota[0]["title"] == "Valiyev Vali darsga kelmadi"


# ───────────────────────── Murojaat → xabar ─────────────────────────


async def _open_appeal(client: AsyncClient, world: dict) -> str:
    token = await _token(client, "bild.otaona_a")
    resp = await client.post(
        "/api/v1/appeals",
        headers=_auth(token),
        json={
            "student_id": str(world["ali"].id),
            "target": "homeroom",
            "title": "Savol bor edi",
            "body": "Assalomu alaykum.",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_new_appeal_notifies_the_assigned_teacher(
    client: AsyncClient, world: dict
) -> None:
    """MUR-01: sinf rahbariga tushgan murojaat unga xabar qiladi."""
    await _open_appeal(client, world)

    ustoz = await _list(client, "bild.ustoz")
    assert len(ustoz) == 1
    assert ustoz[0]["kind"] == "appeal_new"
    assert ustoz[0]["section"] == "/teacher/murojaat"

    # Yozgan odamning oʻziga xabar bormaydi.
    assert await _list(client, "bild.otaona_a") == []


async def test_reply_notifies_the_other_side(client: AsyncClient, world: dict) -> None:
    """Xabar NARIGI tomonga boradi — ustoz javob yozsa oilaga."""
    appeal_id = await _open_appeal(client, world)

    ustoz = await _token(client, "bild.ustoz")
    resp = await client.post(
        f"/api/v1/appeals/{appeal_id}/messages",
        headers=_auth(ustoz),
        json={"body": "Assalomu alaykum, albatta."},
    )
    assert resp.status_code == 201, resp.text

    ota = await _list(client, "bild.otaona_a")
    assert len(ota) == 1
    assert ota[0]["kind"] == "appeal_message"
    assert ota[0]["body"] == "Assalomu alaykum, albatta."
    assert ota[0]["section"] == "/ota-ona/murojaat"


async def test_parent_reply_notifies_the_assignee_not_the_parent(
    client: AsyncClient, world: dict
) -> None:
    appeal_id = await _open_appeal(client, world)

    ota = await _token(client, "bild.otaona_a")
    await client.post(
        f"/api/v1/appeals/{appeal_id}/messages",
        headers=_auth(ota),
        json={"body": "Yana bir savol."},
    )

    # Ustozda: ochilgani + javobi = 2 ta.
    assert len(await _list(client, "bild.ustoz")) == 2
    # Ota-onada hech narsa — oʻz xabaridan bildirishnoma kelmaydi.
    assert await _list(client, "bild.otaona_a") == []


async def test_school_initiated_thread_notifies_the_family(
    client: AsyncClient, world: dict
) -> None:
    """ADM-16: maktab yozishmani boshlasa xabar OILAGA boradi."""
    admin = await _token(client, "bild.admin")
    resp = await client.post(
        "/api/v1/appeals",
        headers=_auth(admin),
        json={
            "student_id": str(world["ali"].id),
            "target": "management",
            "title": "Soʻrovnoma",
            "body": "Fikringizni bilmoqchi edik.",
        },
    )
    assert resp.status_code == 201, resp.text

    ota = await _list(client, "bild.otaona_a")
    assert len(ota) == 1
    assert ota[0]["title"] == "Maktabdan xabar"


async def test_closing_appeal_notifies_the_family(client: AsyncClient, world: dict) -> None:
    appeal_id = await _open_appeal(client, world)

    ustoz = await _token(client, "bild.ustoz")
    resp = await client.patch(
        f"/api/v1/appeals/{appeal_id}/status",
        headers=_auth(ustoz),
        json={"status": "closed"},
    )
    assert resp.status_code == 200, resp.text

    ota = await _list(client, "bild.otaona_a")
    assert [n["kind"] for n in ota] == ["appeal_closed"]


async def test_academic_never_receives_appeal_notifications(
    client: AsyncClient, world: dict
) -> None:
    """Oʻquv boʻlimi murojaatlarni koʻrmaydi — xabar ham olmaydi.

    Ruxsat `appeals_service.APPEAL_WIDE_ROLES` da yopilgan; bu test
    bildirishnoma orqali chetlab oʻtish yoʻli ochilmaganini tekshiradi.
    """
    await _open_appeal(client, world)
    assert await _list(client, "bild.oquvbolim") == []


# ───────────────────────── Sanoq va oʻqilgani ─────────────────────────


async def test_badges_group_by_section(client: AsyncClient, world: dict) -> None:
    """Yon menyudagi sanoq boʻlim boʻyicha ajratiladi."""
    await _mark(client, world, ("ali", "absent"))
    await _open_appeal(client, world)

    ota = await _badges(client, "bild.otaona_a")
    assert ota["total"] == 1
    assert ota["sections"] == {"/ota-ona/davomat": 1}

    ustoz = await _badges(client, "bild.ustoz")
    assert ustoz["sections"] == {"/teacher/murojaat": 1}


async def test_mark_read_lowers_the_badge(client: AsyncClient, world: dict) -> None:
    await _mark(client, world, ("ali", "absent"))
    items = await _list(client, "bild.otaona_a")

    token = await _token(client, "bild.otaona_a")
    resp = await client.post(
        "/api/v1/notifications/read", headers=_auth(token), json={"ids": [items[0]["id"]]}
    )
    assert resp.json() == {"updated": 1}

    assert (await _badges(client, "bild.otaona_a"))["total"] == 0
    # Yozuv yoʻqolmaydi — faqat oʻqilgan deb belgilanadi.
    assert len(await _list(client, "bild.otaona_a")) == 1
    assert await _list(client, "bild.otaona_a", only_unread=True) == []


async def test_read_all_can_be_limited_to_one_section(
    client: AsyncClient, world: dict
) -> None:
    await _mark(client, world, ("ali", "absent"))
    appeal_id = await _open_appeal(client, world)
    ustoz = await _token(client, "bild.ustoz")
    await client.post(
        f"/api/v1/appeals/{appeal_id}/messages",
        headers=_auth(ustoz),
        json={"body": "Javob."},
    )

    token = await _token(client, "bild.otaona_a")
    resp = await client.post(
        "/api/v1/notifications/read-all",
        headers=_auth(token),
        json={"section": "/ota-ona/davomat"},
    )
    assert resp.json() == {"updated": 1}

    qolgan = (await _badges(client, "bild.otaona_a"))["sections"]
    assert qolgan == {"/ota-ona/murojaat": 1}


async def test_marking_someone_elses_notification_changes_nothing(
    client: AsyncClient, world: dict
) -> None:
    """X-1: begona id yuborilsa hech narsa oʻzgarmaydi.

    Javob ataylab `403` emas: xato qaytarish «bunday bildirishnoma bor»
    degan maʼlumotni oshkor qilardi (X-3 mantigʻi). Tekshiruv SOʻROV
    darajasida — `WHERE user_id = :men`.
    """
    await _mark(client, world, ("ali", "absent"))
    begona = (await _list(client, "bild.otaona_a"))[0]["id"]

    token = await _token(client, "bild.otaona_b")
    resp = await client.post(
        "/api/v1/notifications/read", headers=_auth(token), json={"ids": [begona]}
    )
    assert resp.status_code == 200
    assert resp.json() == {"updated": 0}

    # Egasida hamon oʻqilmagan.
    assert (await _badges(client, "bild.otaona_a"))["total"] == 1


async def test_read_all_touches_only_own_rows(client: AsyncClient, world: dict) -> None:
    await _mark(client, world, ("ali", "absent"), ("vali", "absent"))

    token = await _token(client, "bild.otaona_b")
    resp = await client.post(
        "/api/v1/notifications/read-all", headers=_auth(token), json={}
    )
    assert resp.json() == {"updated": 1}

    assert (await _badges(client, "bild.otaona_a"))["total"] == 1


async def test_section_filter_narrows_the_list(client: AsyncClient, world: dict) -> None:
    await _mark(client, world, ("ali", "absent"))
    await _open_appeal(client, world)

    faqat_davomat = await _list(client, "bild.otaona_a", section="/ota-ona/davomat")
    assert [n["kind"] for n in faqat_davomat] == ["attendance_absent"]


async def test_anonymous_request_is_rejected(client: AsyncClient, world: dict) -> None:
    resp = await client.get("/api/v1/notifications")
    assert resp.status_code == 401


async def test_notification_carries_no_contact_details(
    client: AsyncClient, world: dict
) -> None:
    """X-6: bildirishnomada telefon, login yoki manzil boʻlmaydi."""
    await _mark(client, world, ("ali", "absent"))

    token = await _token(client, "bild.otaona_a")
    resp = await client.get("/api/v1/notifications", headers=_auth(token))
    assert "phone" not in resp.text
    assert "login" not in resp.text


async def test_notification_is_never_deleted(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 1-qoida: oʻqilgan xabar ham bazada qoladi."""
    await _mark(client, world, ("ali", "absent"))

    token = await _token(client, "bild.otaona_a")
    await client.post("/api/v1/notifications/read-all", headers=_auth(token), json={})

    rows = (await session.execute(select(Notification))).scalars().all()
    assert len(rows) == 2  # ota-ona va oʻquvchi
    assert all(not r.is_archived for r in rows)


# ───────────────────── Baho va uy vazifasi ─────────────────────


async def _grade(client: AsyncClient, world: dict, *pairs: tuple[str, int | None]) -> dict:
    """Darsga baho qoʻyadi. Baho uchun avval davomat kerak (JUR qoidasi)."""
    token = await _token(client, "bild.ustoz")
    resp = await client.post(
        f"/api/v1/journal/lessons/{world['lesson'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world[k].id), "value": v} for k, v in pairs]},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _new_homework(client: AsyncClient, world: dict, title: str = "3-mashq") -> dict:
    token = await _token(client, "bild.ustoz")
    resp = await client.post(
        "/api/v1/journal/homework",
        headers=_auth(token),
        json={
            "class_id": str(world["class"].id),
            "subject_id": str(world["math"].id),
            "title": title,
            "description": "Daftarda bajarilsin.",
            "due_at": (utcnow() + timedelta(days=3)).isoformat(),
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _submission_of(client: AsyncClient, world: dict, homework_id: str) -> dict:
    token = await _token(client, "bild.ustoz")
    resp = await client.get(
        f"/api/v1/journal/homework/{homework_id}/submissions", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()["rows"]
    return next(s for s in rows if s["student_id"] == str(world["ali"].id))


async def test_new_grade_notifies_guardian_and_student(
    client: AsyncClient, world: dict
) -> None:
    """Baho qoʻyilsa ota-ona ham, oʻquvchi ham xabar oladi."""
    await _mark(client, world, ("ali", "present"))
    await _grade(client, world, ("ali", 5))

    ota = await _list(client, "bild.otaona_a")
    assert [n["kind"] for n in ota] == ["grade_new"]
    assert ota[0]["title"] == "Aliyev Ali — Matematika fanidan 5 baho"
    assert ota[0]["body"].endswith("5/5")
    assert ota[0]["section"] == "/ota-ona/baholar"

    oquvchi = await _list(client, "bild.oquvchi")
    assert oquvchi[0]["section"] == "/student/grades"


async def test_grade_notification_repeats_only_when_value_changes(
    client: AsyncClient, world: dict
) -> None:
    """Ustoz jurnalni qayta saqlasa takror xabar ketmaydi.

    Baho oʻzgarsa — yangi xabar: bu oila bilishi kerak boʻlgan yangilik.
    """
    await _mark(client, world, ("ali", "present"))
    await _grade(client, world, ("ali", 4))
    await _grade(client, world, ("ali", 4))
    assert len(await _list(client, "bild.otaona_a")) == 1

    await _grade(client, world, ("ali", 5))
    ota = await _list(client, "bild.otaona_a")
    assert len(ota) == 2
    assert ota[0]["title"].endswith("5 baho")


async def test_removing_a_grade_sends_nothing(client: AsyncClient, world: dict) -> None:
    """Xato baho olib tashlansa yangi xabar chiqmaydi."""
    await _mark(client, world, ("ali", "present"))
    await _grade(client, world, ("ali", 3))
    await _grade(client, world, ("ali", None))
    assert len(await _list(client, "bild.otaona_a")) == 1


async def test_teacher_gets_no_notification_from_own_grade(
    client: AsyncClient, world: dict
) -> None:
    await _mark(client, world, ("ali", "present"))
    await _grade(client, world, ("ali", 5))
    assert await _list(client, "bild.ustoz") == []


async def test_other_family_sees_no_grade(client: AsyncClient, world: dict) -> None:
    """X-1: Ali ning bahosi Vali ning oilasiga koʻrinmaydi."""
    await _mark(client, world, ("ali", "present"), ("vali", "present"))
    await _grade(client, world, ("ali", 5))
    assert await _list(client, "bild.otaona_b") == []


async def test_new_homework_notifies_students_only(client: AsyncClient, world: dict) -> None:
    """Uy vazifasi OʻQUVCHIGA boradi, ota-onaga emas.

    Kuniga olti-yetti dars boʻladi; har biriga vazifa xabari ota-onaning
    qoʻngʻirogʻini toʻldirib, «kelmadi» kabi muhim xabarni koʻmib
    yuborardi.
    """
    await _new_homework(client, world)

    oquvchi = await _list(client, "bild.oquvchi")
    assert [n["kind"] for n in oquvchi] == ["homework_new"]
    assert oquvchi[0]["title"] == "Matematika: 3-mashq"
    assert oquvchi[0]["section"] == "/student/homework"

    assert await _list(client, "bild.otaona_a") == []
    assert await _list(client, "bild.otaona_b") == []


async def test_graded_homework_notifies_the_family(client: AsyncClient, world: dict) -> None:
    """Vazifa bahosi — baho, shuning uchun ota-ona ham koʻradi."""
    hw = await _new_homework(client, world)
    sub = await _submission_of(client, world, hw["id"])

    token = await _token(client, "bild.ustoz")
    resp = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/grade",
        headers=_auth(token),
        json={"score": 4, "comment": "Yaxshi."},
    )
    assert resp.status_code == 200, resp.text

    ota = await _list(client, "bild.otaona_a")
    assert [n["kind"] for n in ota] == ["homework_graded"]
    assert "4/5 ball" in ota[0]["title"]
    assert ota[0]["section"] == "/ota-ona/baholar"

    # Oʻquvchida: vazifa berilgani + baholangani, yangisi birinchi.
    oquvchi = await _list(client, "bild.oquvchi")
    assert [n["kind"] for n in oquvchi] == ["homework_graded", "homework_new"]


async def test_graded_homework_sends_one_notification_not_two(
    client: AsyncClient, world: dict
) -> None:
    """Vazifa bahosi jurnalga ham tushadi, lekin xabar BITTA.

    `grade_submission` `Grade` yozuvini oʻzi yaratadi va
    `set_lesson_grades` dan oʻtmaydi — ikkilanish shu sabab yoʻq.
    """
    hw = await _new_homework(client, world)
    sub = await _submission_of(client, world, hw["id"])

    token = await _token(client, "bild.ustoz")
    await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/grade",
        headers=_auth(token),
        json={"score": 5},
    )

    ota = await _list(client, "bild.otaona_a")
    assert len(ota) == 1
    assert ota[0]["kind"] == "homework_graded"


async def test_returned_homework_notifies_the_student_only(
    client: AsyncClient, world: dict
) -> None:
    """Qaytarilgan ish oʻquvchidan AMAL talab qiladi — ota-onaga bormaydi."""
    hw = await _new_homework(client, world)
    sub = await _submission_of(client, world, hw["id"])

    token = await _token(client, "bild.ustoz")
    resp = await client.post(
        f"/api/v1/journal/submissions/{sub['id']}/return",
        headers=_auth(token),
        json={"comment": "2-masala notoʻgʻri."},
    )
    assert resp.status_code == 200, resp.text

    oquvchi = await _list(client, "bild.oquvchi")
    assert oquvchi[0]["kind"] == "homework_returned"
    assert oquvchi[0]["body"] == "2-masala notoʻgʻri."
    assert oquvchi[0]["section"] == "/student/homework"

    assert await _list(client, "bild.otaona_a") == []


async def test_grade_and_homework_count_in_their_own_sections(
    client: AsyncClient, world: dict
) -> None:
    """Yon menyudagi sanoq turkumga emas, BOʻLIMGA bogʻlangan."""
    await _mark(client, world, ("ali", "present"))
    await _grade(client, world, ("ali", 5))
    await _new_homework(client, world)

    assert (await _badges(client, "bild.otaona_a"))["sections"] == {"/ota-ona/baholar": 1}
    assert (await _badges(client, "bild.oquvchi"))["sections"] == {
        "/student/grades": 1,
        "/student/homework": 1,
    }
