"""Murojaatlar: kirish nazorati va yozishma oqimi (MUR-01…MUR-06).

Bu fayldagi eng muhim testlar — salbiy testlar (X-2). Murojaat ichida
oilaviy holat, toʻlov qiyinchiligi va sogʻliq haqida gap boradi: boshqa
oilaning yozishmasi koʻrinib qolsa, bu oddiy xato emas.

Tekshiriladigan hujum yoʻllari:
  · ota-ona B → ota-ona A ning murojaati (roʻyxatda ham, id boʻyicha ham)
  · ota-ona → boshqa bola nomidan murojaat yozish
  · ota-ona → «fan oʻqituvchisi» niqobida direktorga yozish
  · ustoz → oʻziga tegishli boʻlmagan murojaat
  · ustoz va ota-ona → administratorning ICHKI qaydlari
  · oʻquv boʻlimi → murojaatlar (ataylab yopiq)
  · ota-ona → oʻz murojaatini «javob berildi» deb belgilash
"""

from datetime import date, time

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import combine_local
from app.models import (
    AcademicYear,
    Appeal,
    AppealNote,
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
    """Rollar `t003` migratsiyasida qatʼiy UUID bilan seed qilingan —
    bu yerda faqat oʻqiladi, qayta yaratish `unique` ni buzadi."""
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
    """Ikki oila, ikki sinf, ikki ustoz — «begona» tushunchasi paydo boʻlsin."""
    roles = await _roles(session)

    admin = await _user(session, roles, [RoleName.ADMIN.value], "sinov.admin", "Adminov")
    director = await _user(
        session, roles, [RoleName.DIRECTOR.value], "sinov.direktor", "Direktorov"
    )
    academic = await _user(
        session, roles, [RoleName.ACADEMIC.value], "sinov.oquvbolim", "Oquvchiyev"
    )
    teacher_a = await _user(
        session,
        roles,
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "sinov.ustoz_a",
        "Ustozov",
    )
    teacher_b = await _user(session, roles, [RoleName.TEACHER.value], "sinov.ustoz_b", "Boshqayev")
    parent_a = await _user(session, roles, [RoleName.PARENT.value], "sinov.otaona_a", "Aliyev")
    parent_b = await _user(session, roles, [RoleName.PARENT.value], "sinov.otaona_b", "Valiyev")

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

    student_a = Student(class_id=class_a.id, last_name="Aliyev", first_name="Ali")
    student_b = Student(class_id=class_b.id, last_name="Valiyev", first_name="Vali")
    session.add_all([student_a, student_b])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=student_a.id, user_id=parent_a.id, relation="father"),
            Guardian(student_id=student_b.id, user_id=parent_b.id, relation="father"),
        ]
    )

    # Ustoz A → 8-A da matematika. Ustoz B → 8-B da fizika.
    for teacher, cls, subject, period in (
        (teacher_a, class_a, math, 1),
        (teacher_b, class_b, physics, 2),
    ):
        session.add(
            Lesson(
                class_id=cls.id,
                subject_id=subject.id,
                teacher_id=teacher.id,
                lesson_date=DAY,
                period=period,
                room=cls.name,
                starts_at=combine_local(DAY, time(8, 30)),
                ends_at=combine_local(DAY, time(9, 15)),
            )
        )
    await session.flush()

    return {
        "admin": admin,
        "director": director,
        "academic": academic,
        "teacher_a": teacher_a,
        "teacher_b": teacher_b,
        "parent_a": parent_a,
        "parent_b": parent_b,
        "student_a": student_a,
        "student_b": student_b,
        "math": math,
        "physics": physics,
    }


async def _token(client: AsyncClient, login: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _open_appeal(
    client: AsyncClient, world: dict, *, login: str = "sinov.otaona_a", **overrides
) -> dict:
    """Ota-ona A dan sinf rahbariga murojaat ochadi."""
    token = await _token(client, login)
    body = {
        "student_id": str(world["student_a"].id),
        "target": "homeroom",
        "title": "Sinfdagi holat haqida",
        "body": "Assalomu alaykum, bir savolim bor edi.",
    }
    body.update(overrides)
    resp = await client.post("/api/v1/appeals", json=body, headers=_auth(token))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ───────────────────────── Oddiy oqim ─────────────────────────


async def test_parent_creates_appeal_routed_to_homeroom_teacher(
    client: AsyncClient, world: dict
) -> None:
    """MUR-01: sinf rahbari SOʻROVDAN emas, bolaning sinfidan olinadi."""
    appeal = await _open_appeal(client, world)

    assert appeal["status"] == "new"
    assert appeal["target"] == "homeroom"
    assert appeal["class_name"] == "8-A"
    assert appeal["assignee_id"] == str(world["teacher_a"].id)
    # MUR-04: javob muddati oʻrnatiladi.
    assert appeal["due_at"] is not None
    # Birinchi xabar yozishmaga tushadi.
    assert len(appeal["messages"]) == 1


async def test_reply_from_teacher_marks_answered(client: AsyncClient, world: dict) -> None:
    """MUR-03/MUR-05: xodim javob berdi → holat «javob berildi»."""
    appeal = await _open_appeal(client, world)
    token = await _token(client, "sinov.ustoz_a")  # ustoz A

    resp = await client.post(
        f"/api/v1/appeals/{appeal['id']}/messages",
        json={"body": "Vaalaykum assalom, ertaga uchrashaylik."},
        headers=_auth(token),
    )
    assert resp.status_code == 201

    detail = await client.get(f"/api/v1/appeals/{appeal['id']}", headers=_auth(token))
    assert detail.json()["status"] == "answered"
    assert len(detail.json()["messages"]) == 2


async def test_parent_reply_after_answer_reopens_review(client: AsyncClient, world: dict) -> None:
    """Ota-ona qayta yozdi → «javob berildi» emas, yana koʻrib chiqilmoqda.

    Aks holda ustozning javob berish koʻrsatkichi yolgʻon yaxshi chiqardi:
    savol davom etayotgan boʻlsa ham murojaat «yopilgan»dek koʻrinardi.
    """
    appeal = await _open_appeal(client, world)
    teacher = await _token(client, "sinov.ustoz_a")
    await client.post(
        f"/api/v1/appeals/{appeal['id']}/messages",
        json={"body": "Javob."},
        headers=_auth(teacher),
    )

    parent = await _token(client, "sinov.otaona_a")
    await client.post(
        f"/api/v1/appeals/{appeal['id']}/messages",
        json={"body": "Rahmat, lekin yana savolim bor."},
        headers=_auth(parent),
    )

    detail = await client.get(f"/api/v1/appeals/{appeal['id']}", headers=_auth(parent))
    assert detail.json()["status"] == "in_review"


async def test_appeal_change_is_written_to_audit_log(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 4-qoida kengaytmasi: murojaat holati ham auditga tushadi."""
    appeal = await _open_appeal(client, world)
    admin = await _token(client, "sinov.admin")
    await client.patch(
        f"/api/v1/appeals/{appeal['id']}/status",
        json={"status": "closed"},
        headers=_auth(admin),
    )

    rows = (
        (
            await session.execute(
                select(AuditLog)
                .where(AuditLog.object_type == "appeal")
                .order_by(AuditLog.created_at)
            )
        )
        .scalars()
        .all()
    )
    actions = [r.action for r in rows]
    assert "create" in actions
    closed = [r for r in rows if r.new_value and r.new_value.get("status") == "closed"]
    assert closed, "yopish audit'ga tushmadi"
    assert closed[0].old_value == {"status": "new"}


# ───────────────────────── Kirish nazorati ─────────────────────────


async def test_other_parent_sees_nothing_in_list(client: AsyncClient, world: dict) -> None:
    """Ota-ona B ota-ona A ning murojaatini roʻyxatda koʻrmaydi."""
    await _open_appeal(client, world)
    token = await _token(client, "sinov.otaona_b")
    resp = await client.get("/api/v1/appeals", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


async def test_other_parent_gets_403_not_404(client: AsyncClient, world: dict) -> None:
    """X-3: ruxsat yoʻq → 403. 404 murojaat mavjudligini oshkor qilardi."""
    appeal = await _open_appeal(client, world)
    token = await _token(client, "sinov.otaona_b")
    resp = await client.get(f"/api/v1/appeals/{appeal['id']}", headers=_auth(token))
    assert resp.status_code == 403
    # Xabar umumiy — «bunday murojaat yoʻq» deyilmaydi.
    assert "murojaat" in resp.json()["message"].lower()


async def test_other_parent_cannot_post_message(client: AsyncClient, world: dict) -> None:
    appeal = await _open_appeal(client, world)
    token = await _token(client, "sinov.otaona_b")
    resp = await client.post(
        f"/api/v1/appeals/{appeal['id']}/messages",
        json={"body": "Begona xabar"},
        headers=_auth(token),
    )
    assert resp.status_code == 403


async def test_parent_cannot_write_about_another_family_child(
    client: AsyncClient, world: dict
) -> None:
    """URL'dagi `student_id` ni almashtirish — BOLA hujumi (X-1)."""
    token = await _token(client, "sinov.otaona_a")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_b"].id),  # begona bola
            "target": "homeroom",
            "title": "Begona bola haqida",
            "body": "Bu murojaat oʻtmasligi kerak.",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 403


async def test_parent_cannot_route_to_arbitrary_staff(client: AsyncClient, world: dict) -> None:
    """«Fan oʻqituvchisi» niqobida direktorga yozib boʻlmaydi.

    `assignee_id` soʻrovdan keladi, lekin ishonchli deb qabul qilinmaydi:
    tanlangan xodim shu bolaga dars berayotgani tekshiriladi.
    """
    token = await _token(client, "sinov.otaona_a")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "target": "subject_teacher",
            "subject_id": str(world["physics"].id),
            "assignee_id": str(world["director"].id),
            "title": "Yoʻnaltirishni aylanib oʻtish",
            "body": "Bu oʻtmasligi kerak.",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert "dars bermaydi" in resp.json()["message"]


async def test_teacher_sees_only_own_appeals(client: AsyncClient, world: dict) -> None:
    """Ustoz B — boshqa sinf ustozi. Unga hech narsa koʻrinmaydi."""
    await _open_appeal(client, world)

    own = await _token(client, "sinov.ustoz_a")
    assert len((await client.get("/api/v1/appeals", headers=_auth(own))).json()) == 1

    other = await _token(client, "sinov.ustoz_b")
    assert (await client.get("/api/v1/appeals", headers=_auth(other))).json() == []


async def test_teacher_cannot_open_foreign_appeal(client: AsyncClient, world: dict) -> None:
    appeal = await _open_appeal(client, world)
    token = await _token(client, "sinov.ustoz_b")
    resp = await client.get(f"/api/v1/appeals/{appeal['id']}", headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.parametrize("login", ["sinov.admin", "sinov.direktor"])
async def test_admin_and_director_see_everything(
    client: AsyncClient, world: dict, login: str
) -> None:
    await _open_appeal(client, world)
    token = await _token(client, login)
    resp = await client.get("/api/v1/appeals", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_academic_head_cannot_read_appeals(client: AsyncClient, world: dict) -> None:
    """Oʻquv boʻlimi murojaatlarni KOʻRMAYDI — ataylab.

    `access.py` dagi `is_staff_wide` unga oʻquv maʼlumotini ochadi, lekin
    murojaatda oilaviy va moliyaviy holat haqida gap boradi.
    """
    await _open_appeal(client, world)
    token = await _token(client, "sinov.oquvbolim")
    assert (await client.get("/api/v1/appeals", headers=_auth(token))).json() == []
    stats = await client.get("/api/v1/appeals/stats/classes", headers=_auth(token))
    assert stats.status_code == 403


async def test_parent_cannot_change_status(client: AsyncClient, world: dict) -> None:
    """Ota-ona oʻz murojaatini «javob berildi» deb belgilay olmaydi."""
    appeal = await _open_appeal(client, world)
    token = await _token(client, "sinov.otaona_a")
    resp = await client.patch(
        f"/api/v1/appeals/{appeal['id']}/status",
        json={"status": "answered"},
        headers=_auth(token),
    )
    assert resp.status_code == 403


async def test_staff_cannot_create_appeal(client: AsyncClient, world: dict) -> None:
    """Murojaatni faqat ota-ona ochadi; xodimlar ichki qayd qoldiradi."""
    token = await _token(client, "sinov.ustoz_a")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "target": "management",
            "title": "Ustozdan murojaat",
            "body": "Bu yoʻl yopiq.",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 403


async def test_endpoints_require_authentication(client: AsyncClient, world: dict) -> None:
    for path in ("/api/v1/appeals", "/api/v1/appeals/summary", "/api/v1/appeals/options"):
        assert (await client.get(path)).status_code == 401


# ───────────────────────── Ichki qaydlar ─────────────────────────


async def test_internal_note_is_invisible_to_parent_and_teacher(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """ADM-16: ichki qayd — maktabning oʻz kuzatuvi, ota-onaga koʻrinmaydi."""
    appeal = await _open_appeal(client, world)
    admin = await _token(client, "sinov.admin")

    created = await client.post(
        f"/api/v1/appeals/{appeal['id']}/notes",
        json={"kind": "phone", "summary": "Otasi bilan gaplashildi, toʻlovni suradi."},
        headers=_auth(admin),
    )
    assert created.status_code == 201

    for login in ("sinov.otaona_a", "sinov.ustoz_a"):  # ota-ona, ustoz
        token = await _token(client, login)
        assert (
            await client.get(f"/api/v1/appeals/{appeal['id']}/notes", headers=_auth(token))
        ).status_code == 403
        # Qayd matni murojaat javobiga ham sizib chiqmasligi kerak.
        detail = await client.get(f"/api/v1/appeals/{appeal['id']}", headers=_auth(token))
        if detail.status_code == 200:
            assert "toʻlovni suradi" not in detail.text

    stored = (await session.execute(select(AppealNote))).scalars().all()
    assert len(stored) == 1


async def test_teacher_cannot_write_internal_note(client: AsyncClient, world: dict) -> None:
    appeal = await _open_appeal(client, world)
    token = await _token(client, "sinov.ustoz_a")
    resp = await client.post(
        f"/api/v1/appeals/{appeal['id']}/notes",
        json={"kind": "phone", "summary": "Ustoz qaydi"},
        headers=_auth(token),
    )
    assert resp.status_code == 403


# ───────────────────────── Hisobot ─────────────────────────


async def test_summary_is_scoped_per_user(client: AsyncClient, world: dict) -> None:
    """Bir xil endpoint, har kimga oʻz raqami."""
    await _open_appeal(client, world)

    parent_a = await _token(client, "sinov.otaona_a")
    parent_b = await _token(client, "sinov.otaona_b")
    admin = await _token(client, "sinov.admin")

    assert (await client.get("/api/v1/appeals/summary", headers=_auth(parent_a))).json()[
        "total"
    ] == 1
    assert (await client.get("/api/v1/appeals/summary", headers=_auth(parent_b))).json()[
        "total"
    ] == 0
    assert (await client.get("/api/v1/appeals/summary", headers=_auth(admin))).json()["new"] == 1


async def test_class_stats_group_by_class(client: AsyncClient, world: dict) -> None:
    await _open_appeal(client, world)
    token = await _token(client, "sinov.direktor")  # direktor
    rows = (await client.get("/api/v1/appeals/stats/classes", headers=_auth(token))).json()
    assert rows == [
        {
            "class_name": "8-A",
            "total": 1,
            "open": 1,
            "to_management": 0,
            "to_teachers": 1,
            "overdue": 0,
        }
    ]


async def test_compose_options_lists_only_own_children_and_their_teachers(
    client: AsyncClient, world: dict
) -> None:
    """X-6: forma ota-onaga butun kadrlar tarkibini koʻrsatmaydi."""
    token = await _token(client, "sinov.otaona_a")
    body = (await client.get("/api/v1/appeals/options", headers=_auth(token))).json()

    assert len(body["children"]) == 1
    child = body["children"][0]
    assert child["full_name"] == "Aliyev Ali"
    assert child["class_name"] == "8-A"
    assert child["homeroom_teacher_name"] == "Ustozov Sinov"
    # Faqat 8-A da dars beradigan ustoz. Ustoz B roʻyxatda yoʻq.
    assert [t["full_name"] for t in child["teachers"]] == ["Ustozov Sinov"]
    assert child["teachers"][0]["subject_name"] == "Matematika"


async def test_closed_appeal_rejects_parent_message(client: AsyncClient, world: dict) -> None:
    appeal = await _open_appeal(client, world)
    admin = await _token(client, "sinov.admin")
    await client.patch(
        f"/api/v1/appeals/{appeal['id']}/status",
        json={"status": "closed"},
        headers=_auth(admin),
    )

    parent = await _token(client, "sinov.otaona_a")
    resp = await client.post(
        f"/api/v1/appeals/{appeal['id']}/messages",
        json={"body": "Yana yozmoqchiman"},
        headers=_auth(parent),
    )
    assert resp.status_code == 422


async def test_admin_assigns_management_appeal(client: AsyncClient, world: dict) -> None:
    """Rahbariyatga kelgan murojaat masʼulsiz keladi, admin taqsimlaydi."""
    appeal = await _open_appeal(client, world, target="management", title="Toʻlov haqida")
    assert appeal["assignee_id"] is None

    admin = await _token(client, "sinov.admin")
    resp = await client.patch(
        f"/api/v1/appeals/{appeal['id']}/assignee",
        json={"assignee_id": str(world["director"].id)},
        headers=_auth(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["assignee_id"] == str(world["director"].id)
    # Biriktirilgach «yangi» emas — kimdir koʻrib chiqmoqda.
    assert resp.json()["status"] == "in_review"


async def test_teacher_cannot_assign(client: AsyncClient, world: dict) -> None:
    appeal = await _open_appeal(client, world, target="management", title="Toʻlov haqida")
    token = await _token(client, "sinov.ustoz_a")
    resp = await client.patch(
        f"/api/v1/appeals/{appeal['id']}/assignee",
        json={"assignee_id": str(world["teacher_a"].id)},
        headers=_auth(token),
    )
    assert resp.status_code == 403


async def test_appeal_is_never_hard_deleted(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """CLAUDE.md 1-qoida: yopilgan murojaat ham bazada qoladi."""
    appeal = await _open_appeal(client, world)
    admin = await _token(client, "sinov.admin")
    await client.patch(
        f"/api/v1/appeals/{appeal['id']}/status",
        json={"status": "closed"},
        headers=_auth(admin),
    )
    stored = (await session.execute(select(Appeal))).scalars().all()
    assert len(stored) == 1
    assert stored[0].is_archived is False
    assert stored[0].closed_at is not None


async def test_note_can_rate_a_teacher(client: AsyncClient, world: dict) -> None:
    """ADM-16: qayd muayyan ustoz haqida boʻlishi mumkin.

    Bu maydon administrator kabinetidagi mavjud formadan keladi
    («ota-ona darsdagi shovqindan norozi, ustoz bilan gaplashildi»).
    """
    appeal = await _open_appeal(client, world)
    admin = await _token(client, "sinov.admin")

    resp = await client.post(
        f"/api/v1/appeals/{appeal['id']}/notes",
        json={
            "kind": "in_person",
            "summary": "Ota-ona bilan uchrashildi.",
            "about_teacher_id": str(world["teacher_a"].id),
            "teacher_rating": 4,
            "teacher_comment": "Darsdagi shovqin boʻyicha gaplashildi.",
        },
        headers=_auth(admin),
    )
    assert resp.status_code == 201

    rows = (await client.get(f"/api/v1/appeals/{appeal['id']}/notes", headers=_auth(admin))).json()
    assert rows[0]["teacher_rating"] == 4
    assert rows[0]["about_teacher_name"] == "Ustozov Sinov"


async def test_rating_requires_a_teacher(client: AsyncClient, world: dict) -> None:
    """Ustozsiz reyting maʼnosiz — u hisobotda kimga tegishli boʻlardi?"""
    appeal = await _open_appeal(client, world)
    admin = await _token(client, "sinov.admin")
    resp = await client.post(
        f"/api/v1/appeals/{appeal['id']}/notes",
        json={"kind": "phone", "summary": "Umumiy suhbat", "teacher_rating": 5},
        headers=_auth(admin),
    )
    assert resp.status_code == 422


@pytest.mark.parametrize("value", [0, 6])
async def test_rating_out_of_range_is_rejected(
    client: AsyncClient, world: dict, value: int
) -> None:
    """1..5 dan tashqari qiymat oʻrtacha koʻrsatkichni buzardi."""
    appeal = await _open_appeal(client, world)
    admin = await _token(client, "sinov.admin")
    resp = await client.post(
        f"/api/v1/appeals/{appeal['id']}/notes",
        json={
            "kind": "phone",
            "summary": "Suhbat",
            "about_teacher_id": str(world["teacher_a"].id),
            "teacher_rating": value,
        },
        headers=_auth(admin),
    )
    assert resp.status_code == 422


# ─────────────── Maktab boshlagan yozishma (ADM-16) ───────────────


async def test_admin_opens_conversation_with_parent(client: AsyncClient, world: dict) -> None:
    """Administrator ota-ona bilan yozishmani boshlaydi.

    Yozishma OILAGA tegishli (`author_id` — vasiy), lekin kim ochgani
    yozuvda qoladi (`created_by_id`). Ikkisi aralashtirilsa «maktab
    ota-ona nomidan gapirdi» degan yozuv paydo boʻlardi.
    """
    admin = await _token(client, "sinov.admin")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "target": "management",
            "title": "Ustozlar faoliyati boʻyicha soʻrov",
            "body": "Assalomu alaykum. Bir necha daqiqa vaqt ajrata olasizmi?",
        },
        headers=_auth(admin),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["author_id"] == str(world["parent_a"].id)
    assert body["created_by_id"] == str(world["admin"].id)
    assert body["created_by_name"] == "Adminov Sinov"
    # Javob kutayotgan tomon — ota-ona, shuning uchun «yangi murojaat» emas.
    assert body["status"] == "in_review"
    # Maktabning oʻz savoliga javob berish muddati boʻlmaydi.
    assert body["due_at"] is None
    # Birinchi xabar muallifi — xodim, ota-onaning ogʻziga soʻz solinmaydi.
    assert body["messages"][0]["author_name"] == "Adminov Sinov"


async def test_parent_sees_and_answers_school_initiated_thread(
    client: AsyncClient, world: dict
) -> None:
    """Ota-ona maktab boshlagan yozishmani oʻz kabinetida koʻradi."""
    admin = await _token(client, "sinov.admin")
    created = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "target": "management",
            "title": "Soʻrovnoma",
            "body": "Fikringizni bilmoqchi edik.",
        },
        headers=_auth(admin),
    )
    appeal_id = created.json()["id"]

    parent = await _token(client, "sinov.otaona_a")
    listed = (await client.get("/api/v1/appeals", headers=_auth(parent))).json()
    assert [a["id"] for a in listed] == [appeal_id]

    answered = await client.post(
        f"/api/v1/appeals/{appeal_id}/messages",
        json={"body": "Albatta, ertaga qoʻngʻiroq qiling."},
        headers=_auth(parent),
    )
    assert answered.status_code == 201

    detail = (await client.get(f"/api/v1/appeals/{appeal_id}", headers=_auth(parent))).json()
    # Ota-ona javob yozdi → endi navbat maktabda, MUR-04 muddati qoʻyiladi.
    assert detail["due_at"] is not None


async def test_school_thread_ignores_requested_routing(client: AsyncClient, world: dict) -> None:
    """Maktab boshlagan yozishma har doim `management`.

    Yoʻnaltirish qoidalari ota-ona «kimga yozaman» deb tanlashi uchun;
    oila tomonidan qaralganda yozgan tomon bitta — maktab.
    """
    admin = await _token(client, "sinov.admin")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "target": "subject_teacher",
            "subject_id": str(world["math"].id),
            "assignee_id": str(world["teacher_a"].id),
            "title": "Sinov",
            "body": "Matn.",
        },
        headers=_auth(admin),
    )
    assert resp.status_code == 201
    assert resp.json()["target"] == "management"
    assert resp.json()["subject_name"] is None
    # Masʼul — yozishmani boshlagan xodim.
    assert resp.json()["assignee_id"] == str(world["admin"].id)


async def test_teacher_cannot_open_conversation_with_parent(
    client: AsyncClient, world: dict
) -> None:
    """Ustoz ota-onaga toʻgʻridan-toʻgʻri yozishma ocha olmaydi.

    Aks holda har bir ustoz istagan oilaga nazoratsiz kanal ochardi.
    """
    token = await _token(client, "sinov.ustoz_a")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "target": "management",
            "title": "Ustozdan xabar",
            "body": "Bu yoʻl yopiq.",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 403


async def test_admin_cannot_attach_thread_to_unrelated_account(
    client: AsyncClient, world: dict
) -> None:
    """Tanlangan hisob shu oʻquvchining vasiysi boʻlishi shart.

    Aks holda yozishma begona oilaning kabinetida paydo boʻlardi.
    """
    admin = await _token(client, "sinov.admin")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "author_id": str(world["parent_b"].id),  # boshqa oilaning vasiysi
            "target": "management",
            "title": "Notoʻgʻri oila",
            "body": "Bu oʻtmasligi kerak.",
        },
        headers=_auth(admin),
    )
    assert resp.status_code == 422
    assert "vasiysi emas" in resp.json()["message"]


async def test_parent_cannot_forge_author(client: AsyncClient, world: dict) -> None:
    """Ota-ona `author_id` yuborib boshqa oila nomidan yoza olmaydi.

    Maydon mavjud (maktab uni ishlatadi), lekin ota-ona uchun eʼtiborga
    olinmaydi — X-5 dagi mass assignment holati.
    """
    token = await _token(client, "sinov.otaona_a")
    resp = await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "author_id": str(world["parent_b"].id),
            "target": "homeroom",
            "title": "Muallifni almashtirish",
            "body": "Bu oʻtmasligi kerak.",
        },
        headers=_auth(token),
    )
    assert resp.status_code == 201
    # Muallif — soʻrovdagi emas, kirgan foydalanuvchi.
    assert resp.json()["author_id"] == str(world["parent_a"].id)
    assert resp.json()["created_by_id"] is None


async def test_school_initiated_thread_is_audited(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    """Kim kimga yozishma ochgani auditda qoladi (X-13 mantigʻi)."""
    admin = await _token(client, "sinov.admin")
    await client.post(
        "/api/v1/appeals",
        json={
            "student_id": str(world["student_a"].id),
            "target": "management",
            "title": "Audit sinovi",
            "body": "Matn.",
        },
        headers=_auth(admin),
    )
    row = (
        (
            await session.execute(
                select(AuditLog).where(
                    AuditLog.object_type == "appeal", AuditLog.action == "create"
                )
            )
        )
        .scalars()
        .one()
    )
    assert row.actor_id == world["admin"].id
    assert row.new_value["created_by_id"] == str(world["admin"].id)
    assert row.new_value["author_id"] == str(world["parent_a"].id)


# ─────────────── Oʻquvchi qidiruvi ───────────────


async def test_student_search_returns_guardians(client: AsyncClient, world: dict) -> None:
    admin = await _token(client, "sinov.admin")
    rows = (
        await client.get(
            "/api/v1/appeals/students", params={"q": "aliyev ali"}, headers=_auth(admin)
        )
    ).json()
    assert len(rows) == 1
    assert rows[0]["full_name"] == "Aliyev Ali"
    assert rows[0]["class_name"] == "8-A"
    assert [g["full_name"] for g in rows[0]["guardians"]] == ["Aliyev Sinov"]


async def test_student_search_matches_anywhere_in_the_name(
    client: AsyncClient, world: dict
) -> None:
    """Qidiruv soʻz boshiga bogʻlanmagan: «aliyev» «Valiyev»ni ham topadi.

    Administrator uchun bu ataylab — familiyani toʻliq eslay olmasa ham
    roʻyxatdan tanlab oladi. Aniqlashtirish uchun ism ham yoziladi.
    """
    admin = await _token(client, "sinov.admin")
    rows = (
        await client.get("/api/v1/appeals/students", params={"q": "aliyev"}, headers=_auth(admin))
    ).json()
    assert sorted(r["full_name"] for r in rows) == ["Aliyev Ali", "Valiyev Vali"]


async def test_student_search_carries_no_contact_details(
    client: AsyncClient, world: dict
) -> None:
    """X-6: roʻyxatda telefon, manzil va hujjat raqami boʻlmaydi."""
    admin = await _token(client, "sinov.admin")
    resp = await client.get(
        "/api/v1/appeals/students", params={"q": "aliyev"}, headers=_auth(admin)
    )
    assert "phone" not in resp.text
    assert "login" not in resp.text


@pytest.mark.parametrize("login", ["sinov.otaona_a", "sinov.ustoz_a", "sinov.oquvbolim"])
async def test_student_search_is_closed_to_others(
    client: AsyncClient, world: dict, login: str
) -> None:
    token = await _token(client, login)
    resp = await client.get(
        "/api/v1/appeals/students", params={"q": "aliyev"}, headers=_auth(token)
    )
    assert resp.status_code == 403
