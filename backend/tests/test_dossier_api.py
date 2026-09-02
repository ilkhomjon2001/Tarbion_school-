"""Oʻquvchi dossieri — yigʻma kartochka va uning kirish chegarasi.

Dossierda toʻlov, psixologik qayd va oila bilan boʻlgan suhbatlar bir
joyda turadi. Shuning uchun bu yerdagi salbiy testlar ijobiylaridan
muhimroq:

  · oʻquv boʻlimi (`academic`) — 403. U `is_staff_wide` ga kiradi,
    lekin moliyani koʻrmaydi. Dossier `is_staff_wide` ga tayansa
    jimgina ochilib ketardi;
  · sinf rahbari — 403. U tarbiyaviy qaydni oʻz boʻlimida koʻradi,
    lekin toʻlov va ichki suhbat qaydlari unga tegishli emas;
  · ota-ona — 403, hatto OʻZ farzandi uchun ham. Kartochka oila
    haqidagi ichki yozuvlarni ham koʻrsatadi.
"""

from datetime import UTC, date, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    AcademicYear,
    AttendanceRecord,
    AttendanceStatus,
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


async def _user(session, roles, names, login, last):  # noqa: ANN001, ANN202
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name=last,
        first_name="Sinov",
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


def _dars(sinf, fan, ustoz, kun: date, period: int) -> Lesson:  # noqa: ANN001
    return Lesson(
        class_id=sinf.id,
        subject_id=fan.id,
        teacher_id=ustoz.id,
        lesson_date=kun,
        period=period,
        starts_at=datetime(kun.year, kun.month, kun.day, 3, 30, tzinfo=UTC),
        ends_at=datetime(kun.year, kun.month, kun.day, 4, 15, tzinfo=UTC),
    )


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)

    await _user(session, roles, [RoleName.ADMIN.value], "ds.admin", "Adminov")
    await _user(session, roles, [RoleName.DIRECTOR.value], "ds.rahbar", "Rahbarov")
    await _user(session, roles, [RoleName.ACADEMIC.value], "ds.oquv", "Oquvov")
    ustoz = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "ds.ustoz",
        "Ustozov",
    )
    ota = await _user(session, roles, [RoleName.PARENT.value], "ds.ota", "Otayev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(academic_year_id=year.id, name="6-A", homeroom_teacher_id=ustoz.id)
    fan = Subject(name="Fizika")
    session.add_all([sinf, fan])
    await session.flush()

    ali = Student(class_id=sinf.id, last_name="Aliyev", first_name="Ali")
    session.add(ali)
    await session.flush()
    session.add(Guardian(student_id=ali.id, user_id=ota.id, relation="father"))

    joriy = _dars(sinf, fan, ustoz, date(2026, 9, 7), 1)
    # Yildan OLDINGI dars — sanoqqa kirmasligi kerak.
    eski = _dars(sinf, fan, ustoz, date(2026, 6, 1), 1)
    session.add_all([joriy, eski])
    await session.flush()

    session.add_all(
        [
            AttendanceRecord(
                lesson_id=joriy.id,
                student_id=ali.id,
                status=AttendanceStatus.ABSENT.value,
                note="Kasal boʻldi, onasi qoʻngʻiroq qildi",
                marked_by_id=ustoz.id,
                marked_at=utcnow(),
            ),
            AttendanceRecord(
                lesson_id=eski.id,
                student_id=ali.id,
                status=AttendanceStatus.ABSENT.value,
                marked_by_id=ustoz.id,
                marked_at=utcnow(),
            ),
        ]
    )
    await session.commit()
    return {"ali": ali}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _dossier(client: AsyncClient, login: str, student_id):  # noqa: ANN001, ANN202
    token = await _token(client, login)
    return await client.get(
        f"/api/v1/school/students/{student_id}/dossier", headers=_auth(token)
    )


# ─────────────────────────── Kim koʻradi ───────────────────────────


@pytest.mark.parametrize("login", ["ds.rahbar", "ds.admin"])
async def test_rahbar_va_administrator_koradi(
    client: AsyncClient, world: dict, login: str
) -> None:
    r = await _dossier(client, login, world["ali"].id)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["full_name"] == "Aliyev Ali"
    assert d["class_name"] == "6-A"
    # Har bir blok mavjud — kartochka boʻsh qaytmasin.
    for kalit in ("guardians", "absences", "wellbeing", "conversations", "finance"):
        assert kalit in d


async def test_oquv_bolimi_kormaydi(client: AsyncClient, world: dict) -> None:
    """`is_staff_wide` ga kiradi, lekin toʻlovni koʻrmaydi — 403.

    Dossier moliya maʼlumotini oʻz ichiga oladi, shuning uchun uni
    koʻra oladigan doira moliya doirasidan keng boʻlishi mumkin emas.
    """
    r = await _dossier(client, "ds.oquv", world["ali"].id)
    assert r.status_code == 403, r.text


async def test_sinf_rahbari_kormaydi(client: AsyncClient, world: dict) -> None:
    """Oʻz sinfi boʻlsa ham — ichki suhbat qaydlari va toʻlov unga emas."""
    r = await _dossier(client, "ds.ustoz", world["ali"].id)
    assert r.status_code == 403, r.text


async def test_ota_ona_oz_farzandi_uchun_ham_kormaydi(
    client: AsyncClient, world: dict
) -> None:
    """X-2. Vasiy farzandini koʻradi, lekin dossier — ichki hujjat."""
    r = await _dossier(client, "ds.ota", world["ali"].id)
    assert r.status_code == 403, r.text


# ─────────────────────────── Mazmuni ───────────────────────────


async def test_kelmaslik_sababi_kartochkada_korinadi(
    client: AsyncClient, world: dict
) -> None:
    """Rahbar «nega kelmagan» degan savolga shu yerdan javob topadi."""
    r = await _dossier(client, "ds.rahbar", world["ali"].id)
    assert r.status_code == 200, r.text
    absences = r.json()["absences"]
    assert len(absences) == 1
    assert absences[0]["note"] == "Kasal boʻldi, onasi qoʻngʻiroq qildi"
    assert absences[0]["subject_name"] == "Fizika"


async def test_sanoq_joriy_oquv_yili_bilan_chegaralanadi(
    client: AsyncClient, world: dict
) -> None:
    """Oʻtgan yilgi qoldirilgan darslar bugungi manzarani buzmasin.

    Fikstura ikkita «kelmadi» yozadi: biri joriy yilda, biri undan
    oldin. Sanoqda faqat bittasi koʻrinishi kerak.
    """
    r = await _dossier(client, "ds.rahbar", world["ali"].id)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["year_name"] == "2026-2027"
    assert d["attendance_counts"]["absent"] == 1
