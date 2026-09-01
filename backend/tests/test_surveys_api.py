"""Soʻrovnomalar — anonimlik va qamrov testda mixlanadi.

Eng muhim tekshiruvlar:
  · ota-ona faqat farzandiga dars beradigan ustozni baholaydi;
  · bitta ustozga bir marta — takror 409;
  · natijada ota-onaning kimligi YOʻQ;
  · ustoz natijalarni koʻra olmaydi;
  · yopilgan soʻrovnoma qayta ochilmaydi.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    Guardian,
    Permission,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    User,
    UserPermission,
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


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)

    admin = await _user(session, roles, [RoleName.ADMIN.value], "sv.admin", "Adminov")
    session.add(
        UserPermission(user_id=admin.id, permission=Permission.SURVEYS_MANAGE.value)
    )
    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "sv.ustoz", "Aliyev")
    begona_ustoz = await _user(session, roles, [RoleName.TEACHER.value], "sv.begona", "Begona")
    ota = await _user(session, roles, [RoleName.PARENT.value], "sv.ota", "Otayev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf_a = SchoolClass(academic_year_id=year.id, name="7-A")
    sinf_b = SchoolClass(academic_year_id=year.id, name="7-B")
    fan = Subject(name="Kimyo")
    session.add_all([sinf_a, sinf_b, fan])
    await session.flush()

    ali = Student(class_id=sinf_a.id, last_name="Otayev", first_name="Ali")
    session.add(ali)
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=ota.id, relation="father"),
            # `sv.ustoz` 7-A da dars beradi — ota uni baholay oladi.
            ScheduleEntry(
                academic_year_id=year.id,
                class_id=sinf_a.id,
                subject_id=fan.id,
                teacher_id=ustoz.id,
                weekday=1,
                period=1,
            ),
            # `sv.begona` faqat 7-B da — ota uni baholay OLMAYDI.
            ScheduleEntry(
                academic_year_id=year.id,
                class_id=sinf_b.id,
                subject_id=fan.id,
                teacher_id=begona_ustoz.id,
                weekday=2,
                period=1,
            ),
        ]
    )
    await session.commit()
    return {"ustoz": ustoz, "begona": begona_ustoz}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _faol_sorovnoma(client: AsyncClient) -> dict:
    """Admin soʻrovnoma tuzib faollashtiradi. Savol id lari bilan qaytadi."""
    token = await _token(client, "sv.admin")
    r = await client.post(
        "/api/v1/surveys",
        headers=_auth(token),
        json={
            "title": "1-chorak yakuni",
            "questions": ["Darsni tushunarli tushuntiradi", "Bolam bilan aloqasi yaxshi"],
        },
    )
    assert r.status_code == 201, r.text
    survey = r.json()
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/status?status=active", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    return survey


async def test_ota_faqat_oz_ustozlarini_koradi(client: AsyncClient, world: dict) -> None:
    await _faol_sorovnoma(client)
    token = await _token(client, "sv.ota")
    r = await client.get("/api/v1/surveys/active", headers=_auth(token))
    assert r.status_code == 200, r.text
    ustozlar = r.json()["teachers"]
    assert [u["teacher_name"] for u in ustozlar] == ["Aliyev Sinov"]
    assert ustozlar[0]["class_name"] == "7-A"


async def test_javob_va_natija_anonim(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    survey = await _faol_sorovnoma(client)
    savollar = {q["id"] for q in survey["questions"]}

    token = await _token(client, "sv.ota")
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/respond",
        headers=_auth(token),
        json={
            "teacher_id": str(world["ustoz"].id),
            "scores": {qid: 5 for qid in savollar},
            "comment": "Bolam bu fandan darslarni yaxshi koʻradi.",
        },
    )
    assert r.status_code == 201, r.text

    admin = await _token(client, "sv.admin")
    r = await client.get(f"/api/v1/surveys/{survey['id']}/results", headers=_auth(admin))
    natija = r.json()
    assert len(natija) == 1
    assert natija[0]["average"] == 5.0
    assert natija[0]["response_count"] == 1
    assert natija[0]["comments"] == [
        {"class_name": "7-A", "text": "Bolam bu fandan darslarni yaxshi koʻradi."}
    ]
    # Anonimlik: natijada respondent haqida hech narsa yoʻq.
    assert "respondent" not in str(natija).lower()
    assert "Otayev" not in str(natija)


async def test_begona_ustozga_javob_403(client: AsyncClient, world: dict) -> None:
    """Farzandiga dars bermaydigan ustozga baho «sepish» yoʻq."""
    survey = await _faol_sorovnoma(client)
    savollar = {q["id"] for q in survey["questions"]}
    token = await _token(client, "sv.ota")
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/respond",
        headers=_auth(token),
        json={"teacher_id": str(world["begona"].id), "scores": {qid: 1 for qid in savollar}},
    )
    assert r.status_code == 403, r.text


async def test_takror_javob_409(client: AsyncClient, world: dict) -> None:
    survey = await _faol_sorovnoma(client)
    savollar = {q["id"] for q in survey["questions"]}
    token = await _token(client, "sv.ota")
    body = {"teacher_id": str(world["ustoz"].id), "scores": {qid: 4 for qid in savollar}}
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/respond", headers=_auth(token), json=body
    )
    assert r.status_code == 201
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/respond", headers=_auth(token), json=body
    )
    assert r.status_code == 409, r.text


async def test_ustoz_natijani_kormaydi(client: AsyncClient, world: dict) -> None:
    """Bu rahbariyat vositasi — ustozga koʻrsatish alohida qaror."""
    survey = await _faol_sorovnoma(client)
    token = await _token(client, "sv.ustoz")
    r = await client.get(f"/api/v1/surveys/{survey['id']}/results", headers=_auth(token))
    assert r.status_code == 403, r.text
    r = await client.get("/api/v1/surveys", headers=_auth(token))
    assert r.status_code == 403, r.text


async def test_yopilgan_qayta_ochilmaydi(client: AsyncClient, world: dict) -> None:
    survey = await _faol_sorovnoma(client)
    token = await _token(client, "sv.admin")
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/status?status=closed", headers=_auth(token)
    )
    assert r.status_code == 200
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/status?status=active", headers=_auth(token)
    )
    assert r.status_code == 409, r.text

    # Yopilganidan keyin javob ham qabul qilinmaydi.
    savollar = {q["id"] for q in survey["questions"]}
    ota = await _token(client, "sv.ota")
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/respond",
        headers=_auth(ota),
        json={"teacher_id": str(world["ustoz"].id), "scores": {qid: 3 for qid in savollar}},
    )
    assert r.status_code == 409, r.text


async def test_hamma_savolga_baho_shart(client: AsyncClient, world: dict) -> None:
    survey = await _faol_sorovnoma(client)
    birinchi = survey["questions"][0]["id"]
    token = await _token(client, "sv.ota")
    r = await client.post(
        f"/api/v1/surveys/{survey['id']}/respond",
        headers=_auth(token),
        json={"teacher_id": str(world["ustoz"].id), "scores": {birinchi: 5}},
    )
    assert r.status_code == 422, r.text
