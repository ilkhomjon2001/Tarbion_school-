"""Davomat: kirish nazorati, 24 soatlik oyna va audit (T-013).

TZ: DAV-01, DAV-03, DAV-06, DAV-07.

Eng muhimlari — salbiy testlar (X-2). Davomat oʻquvchining maktabdagi
holati haqida: boshqa sinf ustozi uni oʻzgartira olsa yoki begona ota-ona
koʻrsa, bu oddiy xato emas.

Tekshiriladigan hujum yoʻllari:
  · ustoz B → ustoz A ning darsi
  · ota-ona → begona bolaning davomat foizi
  · ustoz → 24 soatdan keyin tahrirlash (DAV-03)
  · roʻyxatga boshqa sinf oʻquvchisini qoʻshish
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
    AttendanceRecord,
    AuditLog,
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
DAY = date(2026, 9, 15)


async def _roles(session: AsyncSession) -> dict[str, Role]:
    out = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    yetishmaydi = {n.value for n in RoleName} - set(out)
    assert not yetishmaydi, f"Migratsiyada yoʻq rollar: {sorted(yetishmaydi)}"
    return out


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
    """Ikki sinf, ikki ustoz, ikki oila — «begona» tushunchasi boʻlsin.

    Ustoz A ning darsi BUGUN (oyna ochiq), qoʻshimcha dars esa ikki kun
    oldin (oyna yopiq) — DAV-03 ni sinash uchun.
    """
    roles = await _roles(session)

    admin = await _user(session, roles, [RoleName.ADMIN.value], "dav.admin", "Adminov")
    teacher_a = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "dav.ustoz_a",
        "Ustozov",
    )
    teacher_b = await _user(session, roles, [RoleName.TEACHER.value], "dav.ustoz_b", "Boshqayev")
    parent_a = await _user(session, roles, [RoleName.PARENT.value], "dav.otaona_a", "Aliyev")
    parent_b = await _user(session, roles, [RoleName.PARENT.value], "dav.otaona_b", "Valiyev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 24), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    physics = Subject(name="Fizika", short_name="Fiz")
    session.add_all([math, physics])
    class_a = SchoolClass(academic_year_id=year.id, name="8-A", homeroom_teacher_id=teacher_a.id)
    class_b = SchoolClass(academic_year_id=year.id, name="8-B", homeroom_teacher_id=teacher_b.id)
    session.add_all([class_a, class_b])
    await session.flush()

    ali = Student(class_id=class_a.id, last_name="Aliyev", first_name="Ali")
    aziz = Student(class_id=class_a.id, last_name="Azizov", first_name="Aziz")
    vali = Student(class_id=class_b.id, last_name="Valiyev", first_name="Vali")
    session.add_all([ali, aziz, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=parent_a.id, relation="father"),
            Guardian(student_id=vali.id, user_id=parent_b.id, relation="father"),
        ]
    )

    # Bugungi dars — oyna OCHIQ (hozirdan bir soat oldin tugagan).
    now = utcnow()
    bugungi = Lesson(
        class_id=class_a.id,
        subject_id=math.id,
        teacher_id=teacher_a.id,
        lesson_date=now.date(),
        period=1,
        room="8-A",
        starts_at=now - timedelta(hours=2),
        ends_at=now - timedelta(hours=1),
    )
    # Eski dars — oyna YOPIQ (25 soat oldin tugagan).
    eski = Lesson(
        class_id=class_a.id,
        subject_id=math.id,
        teacher_id=teacher_a.id,
        lesson_date=(now - timedelta(days=2)).date(),
        period=2,
        room="8-A",
        starts_at=now - timedelta(hours=26),
        ends_at=now - timedelta(hours=25),
    )
    # Ustoz B ning darsi — begona.
    begona = Lesson(
        class_id=class_b.id,
        subject_id=physics.id,
        teacher_id=teacher_b.id,
        lesson_date=DAY,
        period=3,
        room="8-B",
        starts_at=combine_local(DAY, time(10, 0)),
        ends_at=combine_local(DAY, time(10, 45)),
    )
    session.add_all([bugungi, eski, begona])
    await session.flush()

    return {
        "admin": admin,
        "teacher_a": teacher_a,
        "teacher_b": teacher_b,
        "parent_a": parent_a,
        "parent_b": parent_b,
        "ali": ali,
        "aziz": aziz,
        "vali": vali,
        "class_a": class_a,
        "class_b": class_b,
        "bugungi": bugungi,
        "eski": eski,
        "begona": begona,
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _rows(*pairs: tuple[object, str]) -> list[dict]:
    return [{"student_id": str(s.id), "status": st} for s, st in pairs]  # type: ignore[attr-defined]


# ─────────────────────────── DAV-01: belgilash ───────────────────────────


async def test_royxat_davomatsiz_ham_tolq_qaytadi(client: AsyncClient, world: dict) -> None:
    """Davomat belgilanmagan boʻlsa ham sinf roʻyxati koʻrinadi.

    Aks holda ustoz boʻsh ekran koʻrardi va kimni belgilashini bilmasdi.
    """
    token = await _token(client, "dav.ustoz_a")
    resp = await client.get(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["students"]) == 2
    assert all(s["status"] is None for s in body["students"])
    assert body["editable"] is True


async def test_butun_sinf_bitta_sorovda_saqlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "dav.ustoz_a")
    resp = await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(token),
        json={
            "rows": _rows((world["ali"], "present"), (world["aziz"], "absent")),
            "topic": "Kvadrat tenglamalar",
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"created": 2, "updated": 0, "unchanged": 0}

    saqlangan = (
        (
            await session.execute(
                select(AttendanceRecord).where(AttendanceRecord.lesson_id == world["bugungi"].id)
            )
        )
        .scalars()
        .all()
    )
    assert len(saqlangan) == 2

    # Mavzu dars bilan birga saqlanadi (JUR-01)
    await session.refresh(world["bugungi"])
    assert world["bugungi"].topic == "Kvadrat tenglamalar"
    assert world["bugungi"].attendance_marked_at is not None


async def test_qayta_yuborilganda_ozgarmagani_qayta_yozilmaydi(
    client: AsyncClient, world: dict
) -> None:
    """Ikkinchi marta saqlaganda audit shovqin bilan toʻlmasin."""
    token = await _token(client, "dav.ustoz_a")
    payload = {"rows": _rows((world["ali"], "present"), (world["aziz"], "absent"))}

    await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}", headers=_auth(token), json=payload
    )
    ikkinchi = await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}", headers=_auth(token), json=payload
    )
    assert ikkinchi.json() == {"created": 0, "updated": 0, "unchanged": 2}


async def test_holat_ozgarsa_yangilanadi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "dav.ustoz_a")
    yol = f"/api/v1/attendance/lessons/{world['bugungi'].id}"

    await client.post(yol, headers=_auth(token), json={"rows": _rows((world["ali"], "absent"))})
    resp = await client.post(
        yol, headers=_auth(token), json={"rows": _rows((world["ali"], "present"))}
    )
    assert resp.json() == {"created": 0, "updated": 1, "unchanged": 0}


async def test_begona_oquvchi_royxatga_qoshilmaydi(client: AsyncClient, world: dict) -> None:
    """8-B oʻquvchisini 8-A darsiga yozib boʻlmaydi."""
    token = await _token(client, "dav.ustoz_a")
    resp = await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(token),
        json={"rows": _rows((world["vali"], "present"))},
    )
    assert resp.status_code == 422
    # Xabar umumiy — qaysi id mavjudligi oshkor qilinmaydi (X-3)
    assert "id" not in resp.json()["message"].lower()


async def test_notogri_holat_rad_etiladi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "dav.ustoz_a")
    resp = await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(token),
        json={"rows": [{"student_id": str(world["ali"].id), "status": "kelgan"}]},
    )
    # Pydantic Literal darajasida ushlaydi
    assert resp.status_code == 422


# ─────────────────────────── DAV-03: 24 soat ───────────────────────────


async def test_25_soatdan_keyin_ustoz_ozgartira_olmaydi(client: AsyncClient, world: dict) -> None:
    """DAV-03 ning yuragi. Oyna dars TUGAGANIDAN sanaladi."""
    token = await _token(client, "dav.ustoz_a")
    resp = await client.post(
        f"/api/v1/attendance/lessons/{world['eski'].id}",
        headers=_auth(token),
        json={"rows": _rows((world["ali"], "present"))},
    )
    assert resp.status_code == 403
    assert "muddat" in resp.json()["message"].lower()


async def test_admin_25_soatdan_keyin_ham_ozgartiradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "dav.admin")
    resp = await client.post(
        f"/api/v1/attendance/lessons/{world['eski'].id}",
        headers=_auth(token),
        json={"rows": _rows((world["ali"], "excused"))},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created"] == 1


async def test_eski_darsda_editable_false_qaytadi(client: AsyncClient, world: dict) -> None:
    """Ustoz tugmani bosib koʻrmasdan oldin bilishi kerak."""
    token = await _token(client, "dav.ustoz_a")
    resp = await client.get(f"/api/v1/attendance/lessons/{world['eski'].id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["editable"] is False


# ─────────────────────── Kirish nazorati (X-1, X-2) ───────────────────────


async def test_begona_ustoz_darsni_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "dav.ustoz_b")
    resp = await client.get(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}", headers=_auth(token)
    )
    assert resp.status_code == 403


async def test_begona_ustoz_davomat_belgilay_olmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "dav.ustoz_b")
    resp = await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(token),
        json={"rows": _rows((world["ali"], "present"))},
    )
    assert resp.status_code == 403


async def test_tokensiz_kirish_yopiq(client: AsyncClient, world: dict) -> None:
    resp = await client.get(f"/api/v1/attendance/lessons/{world['bugungi'].id}")
    assert resp.status_code == 401


async def test_otaona_begona_bolaning_foizini_kora_olmaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-1: eng muhim salbiy test. URL dagi id ni oʻzgartirish."""
    token = await _token(client, "dav.otaona_b")
    resp = await client.get(
        f"/api/v1/attendance/stats?student_id={world['ali'].id}", headers=_auth(token)
    )
    assert resp.status_code == 403


async def test_otaona_oz_bolasining_foizini_koradi(client: AsyncClient, world: dict) -> None:
    ustoz = await _token(client, "dav.ustoz_a")
    await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(ustoz),
        json={"rows": _rows((world["ali"], "present"), (world["aziz"], "absent"))},
    )

    token = await _token(client, "dav.otaona_a")
    resp = await client.get(
        f"/api/v1/attendance/stats?student_id={world['ali'].id}", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1
    assert resp.json()["percent"] == 100.0


async def test_otaona_sinf_kesimini_sorasa_faqat_oz_bolasi_hisoblanadi(
    client: AsyncClient, world: dict
) -> None:
    """Filtr soʻrov darajasida — `student_id` bermay ham chetlab oʻtolmaydi."""
    ustoz = await _token(client, "dav.ustoz_a")
    await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(ustoz),
        json={"rows": _rows((world["ali"], "present"), (world["aziz"], "absent"))},
    )

    token = await _token(client, "dav.otaona_a")
    resp = await client.get(
        f"/api/v1/attendance/stats?class_id={world['class_a'].id}", headers=_auth(token)
    )
    assert resp.status_code == 200
    # Sinfda 2 ta yozuv bor, lekin ota-ona faqat oʻz bolasinikini koʻradi
    assert resp.json()["total"] == 1


# ─────────────────────────── DAV-06: foizlar ───────────────────────────


async def test_kechikkan_kelgan_deb_hisoblanadi(client: AsyncClient, world: dict) -> None:
    """Kechikkan oʻquvchi darsda boʻlgan — foizda kelmaganga qoʻshilmaydi."""
    token = await _token(client, "dav.ustoz_a")
    await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(token),
        json={"rows": _rows((world["ali"], "late"), (world["aziz"], "absent"))},
    )

    resp = await client.get(
        f"/api/v1/attendance/stats?class_id={world['class_a'].id}", headers=_auth(token)
    )
    body = resp.json()
    assert body["late"] == 1
    assert body["absent"] == 1
    assert body["percent"] == 50.0


async def test_dars_yoq_bolsa_foiz_nol(client: AsyncClient, world: dict) -> None:
    """0 dars → 0%, 100% emas. «Hammasi joyida» degan yolgʻon xulosa chiqmasin."""
    token = await _token(client, "dav.ustoz_a")
    resp = await client.get(
        f"/api/v1/attendance/stats?class_id={world['class_a'].id}", headers=_auth(token)
    )
    assert resp.json() == {
        "total": 0,
        "present": 0,
        "absent": 0,
        "excused": 0,
        "late": 0,
        "percent": 0.0,
    }


async def test_sinf_royxati_har_oquvchi_kesimida(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "dav.ustoz_a")
    await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(token),
        json={"rows": _rows((world["ali"], "present"), (world["aziz"], "absent"))},
    )

    resp = await client.get(
        f"/api/v1/attendance/classes/{world['class_a'].id}/students", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 2
    foizlar = {r["full_name"]: r["stat"]["percent"] for r in body}
    assert foizlar["Aliyev Ali"] == 100.0
    assert foizlar["Azizov Aziz"] == 0.0


# ─────────────────────────── DAV-07: audit ───────────────────────────


async def test_har_ozgarish_auditga_eski_va_yangi_qiymat_bilan(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 4-qoida."""
    token = await _token(client, "dav.ustoz_a")
    yol = f"/api/v1/attendance/lessons/{world['bugungi'].id}"

    await client.post(yol, headers=_auth(token), json={"rows": _rows((world["ali"], "absent"))})
    await client.post(yol, headers=_auth(token), json={"rows": _rows((world["ali"], "present"))})

    yozuvlar = (
        (
            await session.execute(
                select(AuditLog)
                .where(AuditLog.object_type == "attendance")
                .order_by(AuditLog.created_at)
            )
        )
        .scalars()
        .all()
    )

    assert len(yozuvlar) == 2
    assert yozuvlar[0].action == "create"
    assert yozuvlar[0].new_value["status"] == "absent"

    assert yozuvlar[1].action == "update"
    assert yozuvlar[1].old_value["status"] == "absent"
    assert yozuvlar[1].new_value["status"] == "present"


async def test_mavzu_ozgarishi_ham_auditga_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "dav.ustoz_a")
    await client.post(
        f"/api/v1/attendance/lessons/{world['bugungi'].id}",
        headers=_auth(token),
        json={"rows": _rows((world["ali"], "present")), "topic": "Kasrlar"},
    )

    yozuv = await session.scalar(select(AuditLog).where(AuditLog.object_type == "lesson"))
    assert yozuv is not None
    assert yozuv.new_value["topic"] == "Kasrlar"


# ─────────────────────────── Ustoz darslari ───────────────────────────


async def test_ustoz_faqat_oz_darslarini_koradi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "dav.ustoz_a")
    resp = await client.get("/api/v1/attendance/my-lessons", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    # Bugungi dars — ustoz A niki. Eski dars boshqa kunda, begonasi ustoz B niki.
    sinflar = {r["class_name"] for r in resp.json()}
    assert sinflar <= {"8-A"}
