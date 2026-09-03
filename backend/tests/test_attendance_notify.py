"""Davomat xabarnomalari (T-019, DAV-05, Ilova B).

Uchta qabul mezoni shu yerda mixlanadi:
  · kechikish vaqti administrator sozlamasidan oʻzgaradi;
  · davomat tuzatilsa, yuborilmagan xabar bekor qilinadi;
  · shablonni administrator tahrirlay oladi.

Eng nozik joyi — BEKOR QILISH. Ustoz dars boshida «kelmadi» deb
belgilab, kech qolgan bolani keyin «keldi» ga tuzatadi. Xabar oʻsha
paytgacha navbatda turgan boʻlishi va oʻchishi kerak: aks holda
ota-ona bolasi sinfda oʻtirganida «kelmadi» degan xabar olardi.
"""

from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    AcademicYear,
    Guardian,
    Lesson,
    NotificationOutbox,
    OutboxStatus,
    Role,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    User,
)
from app.services import attendance_service, template_service

PASSWORD = "Sinov12345!"  # noqa: S106
KUN = date(2026, 9, 7)


async def _user(session, roles, names, login, **kw):  # noqa: ANN001, ANN003, ANN202
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinovov",
        first_name="Sinov",
        **kw,
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}

    ustoz = await _user(session, roles, [RoleName.TEACHER.value], "an.ustoz")
    # Vasiyda Telegram BOR — aks holda navbatga qator yozilmaydi.
    ota = await _user(session, roles, [RoleName.PARENT.value], "an.ota", telegram_id=900001)
    await _user(session, roles, [RoleName.ADMIN.value], "an.admin")

    year = AcademicYear(name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25))
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(academic_year_id=year.id, name="6-A")
    fan = Subject(name="Fizika")
    session.add_all([sinf, fan])
    await session.flush()

    ali = Student(class_id=sinf.id, last_name="Aliyev", first_name="Ali")
    session.add(ali)
    await session.flush()
    session.add(Guardian(student_id=ali.id, user_id=ota.id, relation="father"))

    # Dars YAQINDA tugagan boʻlsin: DAV-03 oynasi ochiq qolsin.
    tugadi = utcnow() - timedelta(minutes=15)
    dars = Lesson(
        class_id=sinf.id,
        subject_id=fan.id,
        teacher_id=ustoz.id,
        lesson_date=tugadi.date(),
        period=1,
        starts_at=tugadi - timedelta(minutes=45),
        ends_at=tugadi,
    )
    session.add(dars)
    await session.commit()
    return {"ustoz": ustoz, "ota": ota, "ali": ali, "dars": dars}


async def _belgila(session: AsyncSession, world: dict, status: str) -> None:
    from app.services.access import CurrentUser

    ustoz = world["ustoz"]
    user = CurrentUser(
        id=ustoz.id,
        login=ustoz.login,
        full_name=ustoz.full_name,
        short_name=ustoz.short_name,
        roles=frozenset({RoleName.TEACHER.value}),
        must_change_password=False,
    )
    await attendance_service.mark_attendance(
        session,
        user,
        world["dars"].id,
        [attendance_service.MarkRow(student_id=world["ali"].id, status=status)],
    )


async def _navbat(session: AsyncSession) -> list[NotificationOutbox]:
    rows = await session.execute(
        select(NotificationOutbox).where(NotificationOutbox.kind.like("attendance%"))
    )
    return list(rows.scalars())


# ─────────────────────── Navbatga qoʻyish ───────────────────────


async def test_kelmadi_navbatga_tushadi(session: AsyncSession, world: dict) -> None:
    await _belgila(session, world, "absent")
    navbat = await _navbat(session)
    assert len(navbat) == 1
    assert navbat[0].user_id == world["ota"].id
    assert "Aliyev Ali" in navbat[0].title
    assert navbat[0].status == OutboxStatus.PENDING.value


async def test_xabar_kechikib_yuboriladi(session: AsyncSession, world: dict) -> None:
    """DAV-05: sukut boʻyicha 30 daqiqa."""
    await _belgila(session, world, "absent")
    navbat = await _navbat(session)
    kechikish = navbat[0].send_after - utcnow()
    # 30 daqiqa ± bir necha soniya.
    assert timedelta(minutes=29) < kechikish <= timedelta(minutes=30)


async def test_keldi_uchun_xabar_yozilmaydi(session: AsyncSession, world: dict) -> None:
    await _belgila(session, world, "present")
    assert await _navbat(session) == []


async def test_telegramsiz_vasiyga_navbat_toldirilmaydi(
    session: AsyncSession, world: dict
) -> None:
    world["ota"].telegram_id = None
    await session.commit()
    await _belgila(session, world, "absent")
    assert await _navbat(session) == []


# ─────────────────────── Bekor qilish ───────────────────────


async def test_davomat_tuzatilsa_xabar_bekor_qilinadi(
    session: AsyncSession, world: dict
) -> None:
    """T-019 mezoni. Ota-ona bolasi sinfda oʻtirganida «kelmadi» degan
    xabar olmasligi kerak."""
    await _belgila(session, world, "absent")
    await _belgila(session, world, "present")

    navbat = await _navbat(session)
    assert len(navbat) == 1
    assert navbat[0].status == OutboxStatus.CANCELLED.value


async def test_yuborilgan_xabar_bekor_qilinmaydi(
    session: AsyncSession, world: dict
) -> None:
    """U allaqachon ketgan — holatini oʻzgartirish yolgʻon boʻlardi."""
    await _belgila(session, world, "absent")
    navbat = await _navbat(session)
    navbat[0].status = OutboxStatus.SENT.value
    navbat[0].sent_at = utcnow()
    await session.commit()

    await _belgila(session, world, "present")
    await session.refresh(navbat[0])
    assert navbat[0].status == OutboxStatus.SENT.value


async def test_takror_saqlash_ikkinchi_xabar_yozmaydi(
    session: AsyncSession, world: dict
) -> None:
    """Ustoz jurnalni qayta saqlasa ota-ona ikki marta xabar olmasin."""
    await _belgila(session, world, "absent")
    await _belgila(session, world, "absent")
    assert len(await _navbat(session)) == 1


# ─────────────────────── Sozlama ───────────────────────


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def test_kechikish_sozlamadan_ozgaradi(
    client: AsyncClient, session: AsyncSession, world: dict
) -> None:
    """T-019 mezoni: «Kechikish vaqti admin sozlamasidan oʻzgaradi»."""
    from app.models import SchoolSettings

    session.add(SchoolSettings(name="Tarbion", attendance_notify_delay_minutes=5))
    await session.commit()

    await _belgila(session, world, "absent")
    navbat = await _navbat(session)
    kechikish = navbat[0].send_after - utcnow()
    assert timedelta(minutes=4) < kechikish <= timedelta(minutes=5)


# ─────────────────────── Shablon ───────────────────────


async def test_shablon_ozgartirilsa_xabar_matni_ozgaradi(
    session: AsyncSession, world: dict
) -> None:
    """T-019 mezoni: «Shablonni admin tahrirlay oladi»."""
    from app.services.access import CurrentUser

    admin = await session.scalar(select(User).where(User.login == "an.admin"))
    actor = CurrentUser(
        id=admin.id,
        login=admin.login,
        full_name=admin.full_name,
        short_name=admin.short_name,
        roles=frozenset({RoleName.SUPERADMIN.value}),
        must_change_password=False,
    )
    await template_service.set_template(
        session,
        actor=actor,
        kind="attendance_absent",
        title="DIQQAT: {student_name}",
        body="{date} kuni {subject} darsida yoʻq edi.",
    )

    await _belgila(session, world, "absent")
    navbat = await _navbat(session)
    assert navbat[0].title == "DIQQAT: Aliyev Ali"
    assert "Fizika darsida yoʻq edi" in navbat[0].body


async def test_notogri_maydon_rad_etiladi(session: AsyncSession) -> None:
    """Administrator `{parol}` deb yozib, xabarga sir chiqarib
    yubormasin — nomaʼlum maydon SAQLASHDA rad etiladi."""
    from app.core.exceptions import ValidationError
    from app.services.access import CurrentUser

    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    admin = await _user(session, roles, [RoleName.SUPERADMIN.value], "an.super")
    await session.commit()
    actor = CurrentUser(
        id=admin.id,
        login=admin.login,
        full_name=admin.full_name,
        short_name=admin.short_name,
        roles=frozenset({RoleName.SUPERADMIN.value}),
        must_change_password=False,
    )
    with pytest.raises(ValidationError, match="parol"):
        await template_service.set_template(
            session,
            actor=actor,
            kind="attendance_absent",
            title="{student_name}",
            body="Parolingiz: {parol}",
        )


# ─────────────────────── Kunlik xulosa ───────────────────────


async def test_kunlik_xulosa_navbatga_qoyiladi(
    session: AsyncSession, world: dict
) -> None:
    from app.workers import daily_summary

    await _belgila(session, world, "absent")
    n = await daily_summary._kun_uchun(session, world["dars"].lesson_date)
    assert n == 1

    xulosa = await session.scalar(
        select(NotificationOutbox).where(NotificationOutbox.kind == "attendance_daily")
    )
    assert xulosa is not None
    assert "Aliyev Ali" in xulosa.title


async def test_kunlik_xulosa_takrorlanmaydi(session: AsyncSession, world: dict) -> None:
    """Taymer ikki marta ishga tushsa ham ota-ona bitta xabar oladi."""
    from app.workers import daily_summary

    await _belgila(session, world, "absent")
    kun = world["dars"].lesson_date
    await daily_summary._kun_uchun(session, kun)
    ikkinchi = await daily_summary._kun_uchun(session, kun)
    assert ikkinchi == 0


async def test_hammasi_keldi_bolsa_xulosa_yuborilmaydi(
    session: AsyncSession, world: dict
) -> None:
    """Har kuni «hammasi joyida» degan xabar oʻqilmay qoladi va keyin
    haqiqiy xabar ham eʼtibordan chetda qolardi."""
    from app.workers import daily_summary

    await _belgila(session, world, "present")
    n = await daily_summary._kun_uchun(session, world["dars"].lesson_date)
    assert n == 0


def test_sana_obyekti_barqaror() -> None:
    """Takrorni aniqlash shunga tayanadi — har safar bir xil chiqsin."""
    from app.workers.daily_summary import _kun_obyekti

    sid = __import__("uuid").uuid4()
    assert _kun_obyekti(sid, KUN) == _kun_obyekti(sid, KUN)
    assert _kun_obyekti(sid, KUN) != _kun_obyekti(sid, date(2026, 9, 8))
    assert datetime(2026, 9, 7, tzinfo=UTC).date() == KUN
