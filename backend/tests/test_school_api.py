"""Maʼlumotnoma: sinf, fan, oʻquvchi, xodim (T-008, T-009).

Eng muhim testlar:
  · ota-ona oʻquvchilar roʻyxatidan faqat oʻz farzandini oladi
  · roʻyxatda tugʻilgan sana va telefon YOʻQ (X-6)
  · huquqsiz administrator oʻquvchi qabul qila olmaydi (T-005)
  · arxivlangan oʻquvchi OʻCHMAYDI, roʻyxatdan chiqadi (1-qoida)
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    AuditLog,
    ClassSubject,
    Guardian,
    Permission,
    Role,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    User,
)
from app.services import permissions
from app.services.access import CurrentUser

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
        phone="998901112233",
    )
    user.roles = [roles[r] for r in role_names]
    session.add(user)
    await session.flush()
    return user


@pytest.fixture
async def world(session: AsyncSession) -> dict[str, object]:
    roles = await _roles(session)

    superadmin = await _user(session, roles, [RoleName.SUPERADMIN.value], "sch.sa", "Boshqaruv")
    admin = await _user(session, roles, [RoleName.ADMIN.value], "sch.admin", "Adminov")
    teacher = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "sch.ustoz",
        "Ustozov",
    )
    parent_a = await _user(session, roles, [RoleName.PARENT.value], "sch.otaona_a", "Aliyev")
    parent_b = await _user(session, roles, [RoleName.PARENT.value], "sch.otaona_b", "Valiyev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 8, 24), ends_on=date(2027, 5, 25), is_current=True
    )
    session.add(year)
    await session.flush()

    math = Subject(name="Matematika", short_name="Mat")
    session.add(math)
    await session.flush()
    session.add(TeacherSubject(teacher_id=teacher.id, subject_id=math.id))

    class_a = SchoolClass(academic_year_id=year.id, name="8-A", homeroom_teacher_id=teacher.id)
    class_b = SchoolClass(academic_year_id=year.id, name="8-B")
    session.add_all([class_a, class_b])
    await session.flush()
    session.add(ClassSubject(class_id=class_a.id, subject_id=math.id, weekly_hours=5))

    ali = Student(
        class_id=class_a.id, last_name="Aliyev", first_name="Ali", birth_date=date(2012, 3, 4)
    )
    vali = Student(class_id=class_b.id, last_name="Valiyev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=parent_a.id, relation="father"),
            Guardian(student_id=vali.id, user_id=parent_b.id, relation="mother"),
        ]
    )
    await session.flush()

    return {
        "superadmin": superadmin,
        "admin": admin,
        "teacher": teacher,
        "parent_a": parent_a,
        "parent_b": parent_b,
        "class_a": class_a,
        "class_b": class_b,
        "ali": ali,
        "vali": vali,
        "math": math,
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────── Maʼlumotnomalar ───────────────────────────


async def test_sinflar_oquvchi_soni_bilan(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/classes", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    sinflar = {c["name"]: c for c in resp.json()}
    assert sinflar["8-A"]["student_count"] == 1
    assert sinflar["8-A"]["homeroom_teacher"] == "Ustozov Sinov"
    # Sinf rahbari yoʻq boʻlsa `null`, xato emas
    assert sinflar["8-B"]["homeroom_teacher"] is None


async def test_fanlar_royxati(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/subjects", headers=_auth(token))
    assert resp.status_code == 200
    assert [s["name"] for s in resp.json()] == ["Matematika"]


async def test_sinf_fanlari_haftalik_soat_bilan(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get(
        f"/api/v1/school/classes/{world['class_a'].id}/subjects", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json() == [
        {
            "subject_id": str(world["math"].id),
            "subject_name": "Matematika",
            "weekly_hours": 5,
        }
    ]


async def test_xodimlar_royxatida_otaona_yoq(client: AsyncClient, world: dict) -> None:
    """Bu XODIMLAR roʻyxati — ota-ona va oʻquvchi rollari chiqmaydi."""
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/staff", headers=_auth(token))
    assert resp.status_code == 200

    loginlar = {s["login"] for s in resp.json()}
    assert "sch.ustoz" in loginlar
    assert "sch.otaona_a" not in loginlar

    ustoz = next(s for s in resp.json() if s["login"] == "sch.ustoz")
    assert ustoz["subjects"] == ["Matematika"]


# ─────────────────────── Kirish nazorati (X-1, X-6) ───────────────────────


async def test_otaona_faqat_oz_farzandini_koradi(client: AsyncClient, world: dict) -> None:
    """Roʻyxat endpointida ham kesim soʻrov darajasida."""
    token = await _token(client, "sch.otaona_a")
    resp = await client.get("/api/v1/school/students", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    ismlar = {s["full_name"] for s in resp.json()}
    assert ismlar == {"Aliyev Ali"}


async def test_royxatda_shaxsiy_malumot_yoq(client: AsyncClient, world: dict) -> None:
    """X-6: tugʻilgan sana, telefon, vasiy — faqat kartochkada."""
    token = await _token(client, "sch.admin")
    resp = await client.get("/api/v1/school/students", headers=_auth(token))

    maydonlar = set(resp.json()[0])
    assert maydonlar == {"id", "full_name", "class_name", "is_archived"}


async def test_kartochkada_shaxsiy_malumot_bor(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.admin")
    resp = await client.get(f"/api/v1/school/students/{world['ali'].id}", headers=_auth(token))
    assert resp.status_code == 200, resp.text

    body = resp.json()
    assert body["birth_date"] == "2012-03-04"
    assert body["class_name"] == "8-A"
    assert len(body["guardians"]) == 1
    assert body["guardians"][0]["relation"] == "father"


async def test_begona_otaona_kartochkani_kora_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-1: URL dagi id ni oʻzgartirish."""
    token = await _token(client, "sch.otaona_b")
    resp = await client.get(f"/api/v1/school/students/{world['ali'].id}", headers=_auth(token))
    assert resp.status_code == 403


async def test_ustoz_oz_sinfini_koradi(client: AsyncClient, world: dict) -> None:
    """Sinf rahbari oʻz sinfining oʻquvchilarini koʻradi."""
    token = await _token(client, "sch.ustoz")
    resp = await client.get("/api/v1/school/students", headers=_auth(token))
    assert resp.status_code == 200

    ismlar = {s["full_name"] for s in resp.json()}
    assert "Aliyev Ali" in ismlar
    assert "Valiyev Vali" not in ismlar


async def test_tokensiz_royxat_yopiq(client: AsyncClient, world: dict) -> None:
    resp = await client.get("/api/v1/school/students")
    assert resp.status_code == 401


# ─────────────────────── Yozish huquqi (T-005) ───────────────────────


async def test_huquqsiz_admin_oquvchi_qosha_olmaydi(client: AsyncClient, world: dict) -> None:
    """Administrator ROLI yolgʻiz yetarli emas."""
    token = await _token(client, "sch.admin")
    resp = await client.post(
        "/api/v1/school/students",
        headers=_auth(token),
        json={"last_name": "Yangi", "first_name": "Oʻquvchi"},
    )
    assert resp.status_code == 403


async def test_huquqli_admin_oquvchi_qoshadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=Permission.STUDENTS_MANAGE,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    token = await _token(client, "sch.admin")
    resp = await client.post(
        "/api/v1/school/students",
        headers=_auth(token),
        json={
            "last_name": "Yangiyev",
            "first_name": "Bekzod",
            "birth_date": "2013-05-06",
            "class_id": str(world["class_a"].id),
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["class_name"] == "8-A"


async def test_takroriy_oquvchi_rad_etiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Bir xil ism, familiya va tugʻilgan sana — ehtimol takroriy qabul."""
    await permissions.grant(
        session,
        target_user_id=world["superadmin"].id,
        permission=Permission.STUDENTS_MANAGE,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()

    token = await _token(client, "sch.sa")
    resp = await client.post(
        "/api/v1/school/students",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Ali", "birth_date": "2012-03-04"},
    )
    assert resp.status_code == 409


async def test_sinfga_kochirish(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.sa")
    resp = await client.put(
        f"/api/v1/school/students/{world['ali'].id}/class",
        headers=_auth(token),
        json={"class_id": str(world["class_b"].id)},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["class_name"] == "8-B"


# ─────────────────────── Arxivlash (1-qoida) ───────────────────────


async def test_arxivlangan_oquvchi_ochmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "sch.sa")
    resp = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": "Boshqa maktabga koʻchdi"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_archived"] is True

    # Yozuv bazada QOLADI — oʻtgan davomat va toʻlov hisobotda kerak
    hali_bor = await session.get(Student, world["ali"].id)
    assert hali_bor is not None

    # Oddiy roʻyxatda koʻrinmaydi
    royxat = await client.get("/api/v1/school/students", headers=_auth(token))
    assert "Aliyev Ali" not in {s["full_name"] for s in royxat.json()}

    # Arxiv roʻyxatida koʻrinadi
    arxiv = await client.get("/api/v1/school/students?archived=true", headers=_auth(token))
    assert "Aliyev Ali" in {s["full_name"] for s in arxiv.json()}


async def test_arxivlash_sababsiz_bolmaydi(client: AsyncClient, world: dict) -> None:
    """ "Nega ketdi" hisoboti shundan chiqadi."""
    token = await _token(client, "sch.sa")
    resp = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": ""},
    )
    assert resp.status_code == 422


async def test_arxivdan_qaytarish(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "sch.sa")
    yol = f"/api/v1/school/students/{world['ali'].id}"

    await client.post(f"{yol}/archive", headers=_auth(token), json={"reason": "Xato"})
    resp = await client.post(f"{yol}/restore", headers=_auth(token))

    assert resp.status_code == 200
    assert resp.json()["is_archived"] is False


async def test_arxivlash_auditga_sabab_bilan_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 4-qoida."""
    token = await _token(client, "sch.sa")
    await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": "Oilaviy sabab"},
    )

    yozuv = await session.scalar(
        select(AuditLog).where(AuditLog.object_type == "student", AuditLog.action == "archive")
    )
    assert yozuv is not None
    assert yozuv.new_value["reason"] == "Oilaviy sabab"
    assert yozuv.actor_id == world["superadmin"].id


# ──────────────── O'quvchining ustozlari (X-6: loginsiz) ────────────────


async def test_oquvchi_ustozlarini_koradi_loginsiz(
    client: AsyncClient, world: dict
) -> None:
    """Jadvaldan ustozlar ro'yxati — har qatorda ism va fan bor, login YO'Q (X-6)."""
    admin = await _token(client, "sch.admin")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/teachers", headers=_auth(admin)
    )
    assert r.status_code == 200, r.text
    for row in r.json():
        assert set(row) == {"teacher_id", "full_name", "subjects", "is_homeroom"}


async def test_begona_ota_ustozlar_royxatini_kora_olmaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-1: boshqa oilaning bolasi uchun ustozlar so'ralsa 403."""
    begona = await _token(client, "sch.otaona_b")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/teachers", headers=_auth(begona)
    )
    assert r.status_code == 403, r.text


# ─────────────────────────── Oshxona menyusi ───────────────────────────


async def test_menyu_yoziladi_va_oqiladi(client: AsyncClient, world: dict) -> None:
    admin = await _token(client, "sch.sa")  # superadmin — barcha huquqlar
    r = await client.put(
        "/api/v1/school/menu",
        headers=_auth(admin),
        json={"days": {"1": ["Osh", "Salat"], "2": ["Shorva"]}},
    )
    assert r.status_code == 200, r.text

    # Ota-ona ham o'qiy oladi — ochiq ma'lumot.
    ota = await _token(client, "sch.otaona_a")
    r = await client.get("/api/v1/school/menu", headers=_auth(ota))
    assert r.status_code == 200, r.text
    assert r.json()["days"]["1"] == ["Osh", "Salat"]

    # Yaxlit yozish: eski hafta almashadi, qo'shilib ketmaydi.
    await client.put(
        "/api/v1/school/menu",
        headers=_auth(admin),
        json={"days": {"1": ["Lag'mon"]}},
    )
    r = await client.get("/api/v1/school/menu", headers=_auth(admin))
    assert r.json()["days"] == {"1": ["Lag'mon"]}


async def test_menyuni_ota_ona_yoza_olmaydi(client: AsyncClient, world: dict) -> None:
    ota = await _token(client, "sch.otaona_a")
    r = await client.put(
        "/api/v1/school/menu", headers=_auth(ota), json={"days": {"1": ["Osh"]}}
    )
    assert r.status_code == 403, r.text


# ─────────────────────────── Maktab rekvizitlari ───────────────────────────


async def test_maktab_rekvizitlari_yoziladi(client: AsyncClient, world: dict) -> None:
    sa_t = await _token(client, "sch.sa")
    r = await client.put(
        "/api/v1/school/settings",
        headers=_auth(sa_t),
        json={
            "name": "«Tarbion» xususiy maktabi",
            "address": "Toshkent sh.",
            "phone": "+998 71 200 00 00",
            "director_name": "Karimov B.",
        },
    )
    assert r.status_code == 200, r.text

    # Ustoz o'qiy oladi (hujjat/kvitansiya uchun), ota-ona esa yo'q.
    ustoz = await _token(client, "sch.ustoz")
    r = await client.get("/api/v1/school/settings", headers=_auth(ustoz))
    assert r.status_code == 200, r.text
    assert r.json()["director_name"] == "Karimov B."

    ota = await _token(client, "sch.otaona_a")
    assert (
        await client.get("/api/v1/school/settings", headers=_auth(ota))
    ).status_code == 403

    # Yozish faqat users.manage bilan.
    assert (
        await client.put(
            "/api/v1/school/settings", headers=_auth(ustoz), json={"name": "X"}
        )
    ).status_code == 403


# ────────── Kartochkani tahrirlash (ADM-05, loyiha egasining soʻrovi) ──────────
#
# Oʻquvchi qabul qilinganda hamma maʼlumot toʻliq boʻlmaydi: vasiyning
# F.I.Sh., yashash joyi, kasbi va oʻquvchining oldingi maktabi keyin,
# hujjat kelganda toʻldiriladi.


async def _huquq(session: AsyncSession, world: dict, permission: Permission) -> None:
    """Bitta huquqni administratorga beradi.

    `_huquqli` faqat `students.manage` beradi; sozlama va toʻlov
    endpointlari boshqa huquq soʻraydi va rol yolgʻiz yetarli emas (X-2).
    """
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=permission,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()


async def _huquqli(session: AsyncSession, world: dict) -> None:
    await permissions.grant(
        session,
        target_user_id=world["admin"].id,
        permission=Permission.STUDENTS_MANAGE,
        granted_by=CurrentUser.from_model(world["superadmin"]),
    )
    await session.flush()


async def test_oquvchi_kartochkasi_tahrirlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Ali",
            "middle_name": "Anvarovich",
            "birth_date": "2012-03-04",
            "previous_school": "12-maktab, Chilonzor",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["middle_name"] == "Anvarovich"
    assert body["previous_school"] == "12-maktab, Chilonzor"


async def test_oldingi_maktab_bosh_qolishi_mumkin(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """0 va 1-sinf uchun bu maydon toʻldirilmaydi — xato emas."""
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Ali"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["previous_school"] is None


async def test_kelajakdagi_tugilgan_sana_rad_etiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Ali", "birth_date": "2099-01-01"},
    )
    assert r.status_code == 422, r.text


async def test_huquqsiz_admin_kartochkani_tahrirlay_olmaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-2: rol yolgʻiz yetarli emas."""
    token = await _token(client, "sch.admin")
    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}",
        headers=_auth(token),
        json={"last_name": "Boshqa", "first_name": "Nom"},
    )
    assert r.status_code == 403, r.text


async def test_kartochka_tahriri_auditga_tushadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """4-domen qoidasi: eski va yangi qiymat bilan."""
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    await client.put(
        f"/api/v1/school/students/{world['ali'].id}",
        headers=_auth(token),
        json={"last_name": "Aliyev", "first_name": "Ali", "previous_school": "5-maktab"},
    )

    yozuv = (
        await session.execute(
            select(AuditLog).where(
                AuditLog.object_type == "student", AuditLog.action == "update"
            )
        )
    ).scalars().all()
    assert len(yozuv) == 1
    assert yozuv[0].old_value["previous_school"] is None
    assert yozuv[0].new_value["previous_school"] == "5-maktab"


async def test_ozgarish_bolmasa_audit_yozilmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Bir xil qiymat qayta yuborilsa audit shovqinga koʻmilmasin."""
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")
    tana = {"last_name": "Aliyev", "first_name": "Ali", "birth_date": "2012-03-04"}

    await client.put(
        f"/api/v1/school/students/{world['ali'].id}", headers=_auth(token), json=tana
    )
    await client.put(
        f"/api/v1/school/students/{world['ali'].id}", headers=_auth(token), json=tana
    )

    soni = await session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.object_type == "student", AuditLog.action == "update")
    )
    assert soni == 0, "hech narsa oʻzgarmagan, lekin audit yozildi"


# ─────────────────────────── Vasiy ───────────────────────────


async def test_vasiy_malumoti_tahrirlanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{world['parent_a'].id}",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Anvar",
            "middle_name": "Sobirovich",
            "phone": "901234567",
            "address": "Toshkent, Chilonzor 5-mavze, 12-uy",
            "profession": "Shifokor",
            "relation": "father",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["address"] == "Toshkent, Chilonzor 5-mavze, 12-uy"
    assert body["profession"] == "Shifokor"
    assert body["first_name"] == "Anvar"
    # Login OʻZGARMAYDI — u kirish identifikatori.
    assert body["login"] == "sch.otaona_a"


async def test_boshqa_oquvchining_vasiysini_tahrirlab_bolmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Vasiy OʻQUVCHI orqali topiladi.

    Aks holda bu endpoint istalgan foydalanuvchini tahrirlash yoʻliga
    aylanardi: `user_id` yolgʻiz yetarli emas.
    """
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{world['parent_b'].id}",
        headers=_auth(token),
        json={
            "last_name": "Begona",
            "first_name": "Odam",
            "relation": "father",
        },
    )
    assert r.status_code == 404, r.text


async def test_huquqsiz_admin_vasiyni_tahrirlay_olmaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-2."""
    token = await _token(client, "sch.admin")
    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{world['parent_a'].id}",
        headers=_auth(token),
        json={"last_name": "Boshqa", "first_name": "Nom", "relation": "father"},
    )
    assert r.status_code == 403, r.text


async def test_band_telefon_kimligini_aytadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Telefon boʻyicha oila topiladi — takror bogʻlanishni buzardi."""
    await _huquqli(session, world)

    # Fiksturada hammaning raqami bir xil; boshqa oilaga ALOHIDA raqam
    # beramiz, keyin oʻshani birinchi oilaga koʻchirishga urinamiz.
    world["parent_b"].phone = "998907654321"
    await session.flush()

    token = await _token(client, "sch.admin")
    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{world['parent_a'].id}",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Anvar",
            "phone": "998907654321",
            "relation": "father",
        },
    )
    assert r.status_code == 409, r.text
    assert "Valiyev" in r.json()["message"], r.text


async def test_vasiy_royxatida_manzil_va_kasb_qaytadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """X-6: bu bitta oʻquvchi kartochkasi, roʻyxat emas — shaxsiy maʼlumot shu yerda."""
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")
    await client.put(
        f"/api/v1/school/students/{world['ali'].id}/guardians/{world['parent_a'].id}",
        headers=_auth(token),
        json={
            "last_name": "Aliyev",
            "first_name": "Anvar",
            "address": "Toshkent",
            "profession": "Muhandis",
            "relation": "father",
        },
    )

    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    qator = r.json()[0]
    assert qator["address"] == "Toshkent"
    assert qator["profession"] == "Muhandis"


async def test_ism_tuzatilsa_kirish_hisobi_ham_yangilanadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Ism ikki joyda: kartochkada va `users` da.

    Faqat kartochka tuzatilsa oʻquvchi oʻz kabinetida hamon eski ism
    bilan koʻrinadi — imlo xatosi tuzatilgandan keyin ham. LOGIN esa
    OʻZGARMAYDI: u odamning tizimdagi manzili.
    """
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    hisob = User(
        login="std.ali",
        password_hash=hash_password(PASSWORD),
        last_name="Xolmahammatov",
        first_name="Ali",
    )
    session.add(hisob)
    await session.flush()
    student = await session.get(Student, world["ali"].id)
    assert student is not None
    student.user_id = hisob.id
    await session.commit()

    r = await client.put(
        f"/api/v1/school/students/{world['ali'].id}",
        headers=_auth(token),
        json={"last_name": "Xolmuhammadov", "first_name": "Alisher"},
    )
    assert r.status_code == 200, r.text

    await session.refresh(hisob)
    assert hisob.last_name == "Xolmuhammadov"
    assert hisob.first_name == "Alisher"
    assert hisob.login == "std.ali"  # manzil oʻzgarmaydi


# ─────────────────── Telefon boʻyicha vasiy topish ───────────────────


async def test_telefon_boyicha_mavjud_vasiy_topiladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Ikkinchi farzand: raqam kiritilishi bilan oila koʻrinsin.

    Ilgari bu faqat `409` orqali bilinardi — administrator butun
    shaklni toʻldirib yuborardi va mavjud hisobga bogʻlash yoʻli
    interfeysda umuman yoʻq edi.
    """
    await _huquqli(session, world)
    world["parent_b"].phone = "+998 90 765-43-21"
    await session.flush()

    token = await _token(client, "sch.admin")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians/lookup",
        headers=_auth(token),
        params={"phone": "998907654321"},  # boshqa yozilish — bir xil raqam
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_id"] == str(world["parent_b"].id)
    assert body["children_count"] == 1
    assert body["children"] == [world["vali"].full_name]
    assert body["already_linked"] is False


async def test_oz_vasiysi_qayta_taklif_qilinmaydi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Allaqachon shu oʻquvchining vasiysi — «biriktirish» taklifi keraksiz."""
    await _huquqli(session, world)
    world["parent_a"].phone = "998901112233"
    await session.flush()

    token = await _token(client, "sch.admin")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians/lookup",
        headers=_auth(token),
        params={"phone": "998901112233"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["already_linked"] is True


async def test_notanish_telefonda_bosh_javob(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians/lookup",
        headers=_auth(token),
        params={"phone": "998000000000"},
    )
    assert r.status_code == 200, r.text
    assert r.json() is None


async def test_huquqsiz_admin_telefon_qidira_olmaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-2 va X-6: bu endpoint telefon sanab chiqish yoʻli boʻlmasin."""
    token = await _token(client, "sch.admin")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians/lookup",
        headers=_auth(token),
        params={"phone": "998901112233"},
    )
    assert r.status_code == 403, r.text


async def test_otaona_telefon_qidira_olmaydi(client: AsyncClient, world: dict) -> None:
    """X-1: ota-ona oʻz farzandi kartochkasida ham qidira olmaydi."""
    token = await _token(client, "sch.otaona_a")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/guardians/lookup",
        headers=_auth(token),
        params={"phone": "998901112233"},
    )
    assert r.status_code == 403, r.text


async def test_mavjud_vasiyga_ikkinchi_oquvchi_biriktiriladi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Bitta hisob — ikki farzand. Yangi hisob ochilmaydi."""
    await _huquqli(session, world)
    token = await _token(client, "sch.admin")

    r = await client.put(
        f"/api/v1/school/students/{world['vali'].id}/guardians",
        headers=_auth(token),
        json={"user_id": str(world["parent_a"].id), "relation": "father"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["children_count"] == 2

    rows = (
        await client.get(
            f"/api/v1/school/students/{world['vali'].id}/guardians", headers=_auth(token)
        )
    ).json()
    assert {g["user_id"] for g in rows} == {
        str(world["parent_a"].id),
        str(world["parent_b"].id),
    }


# ─────────────────── Shartnoma hujjati ───────────────────


async def test_otaona_oz_farzandining_shartnomasini_koradi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Hujjatga oʻquvchi, vasiy va maktab rekvizitlari tushadi."""
    await _huquq(session, world, Permission.USERS_MANAGE)
    admin = await _token(client, "sch.admin")
    r = await client.put(
        "/api/v1/school/settings",
        headers=_auth(admin),
        json={
            "name": "«Tarbion» NTM",
            "address": "Andijon viloyati, Marhamat tumani",
            "phone": "+998901234567",
            "director_name": "Toʻxtarov Fazliddin",
            "tax_id": "313032894",
            "bank_account": "20208000007467234001",
            "bank_code": "00450",
            "bank_name": "«Milliy Bank» AJ Marhamat BXM",
            "attendance_notify_delay_minutes": 30,
        },
    )
    assert r.status_code == 200, r.text

    token = await _token(client, "sch.otaona_a")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/contract", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["student_name"] == world["ali"].full_name
    assert b["director_name"] == "Toʻxtarov Fazliddin"
    # MFO bosh noli saqlanadi — bu identifikator, raqam emas.
    assert b["bank_code"] == "00450"
    assert [g["full_name"] for g in b["guardians"]]
    # Shartnoma summasi hujjatdan (3.1) — hali shartnoma ochilmagan.
    assert b["monthly_fee"] == 2_300_000
    assert b["has_contract"] is False
    assert b["advance"] == 1_150_000
    assert b["due_day"] == 5


async def test_begona_otaona_shartnomani_kora_olmaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-1, X-3: 403, 404 emas — mavjudligi oshkor boʻlmasin."""
    token = await _token(client, "sch.otaona_b")
    r = await client.get(
        f"/api/v1/school/students/{world['ali'].id}/contract", headers=_auth(token)
    )
    assert r.status_code == 403, r.text


async def test_shartnomada_amaldagi_summa_korinadi(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Shartnoma ochilgan boʻlsa summa OʻSHANDAN, standartdan emas."""
    await _huquq(session, world, Permission.PAYMENTS_MANAGE)
    admin = await _token(client, "sch.admin")
    r = await client.put(
        f"/api/v1/payments/students/{world['ali'].id}/contract",
        headers=_auth(admin),
        json={"monthly_fee": 1_800_000, "starts_on": "2026-09-01"},
    )
    assert r.status_code == 200, r.text

    token = await _token(client, "sch.otaona_a")
    b = (
        await client.get(
            f"/api/v1/school/students/{world['ali'].id}/contract", headers=_auth(token)
        )
    ).json()
    assert b["monthly_fee"] == 1_800_000
    assert b["has_contract"] is True
