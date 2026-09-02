"""Xabarnoma navbati (T-018, BOT-02, BOT-06).

Bu qatlamning butun maʼnosi — xabar YOʻQOLMASLIGI. Shuning uchun
testlarning koʻpi nosozlik yoʻllarini tekshiradi: Telegram javob
bermadi, bot bloklandi, sabab yoʻqoldi, ikkita worker bir vaqtda ishga
tushdi.
"""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    NotificationOutbox,
    OutboxStatus,
    Role,
    RoleName,
    User,
)
from app.services import outbox_service

PASSWORD = "Sinov12345!"  # noqa: S106


async def _user(session: AsyncSession, login: str, telegram_id: int | None) -> User:
    roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    user = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name="Sinovov",
        first_name="Sinov",
        telegram_id=telegram_id,
    )
    user.roles = [roles[RoleName.PARENT.value]]
    session.add(user)
    await session.flush()
    return user


# ───────────────────────── Navbatga qoʻyish ─────────────────────────


async def test_telegram_ulanmagan_odamga_navbat_toldirilmaydi(session: AsyncSession) -> None:
    """`telegram_id` boʻsh boʻlsa yuboradigan joy yoʻq.

    Qator yozilsa u hech qachon yetkazilmaydi va navbatni band qilib
    turadi — administrator ekranida ham «yiqilgan» boʻlib koʻrinardi.
    """
    user = await _user(session, "nav.telegramsiz", None)
    natija = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="Sarlavha", body="Matn"
    )
    assert natija is None


async def test_navbatga_qoyiladi(session: AsyncSession) -> None:
    user = await _user(session, "nav.oddiy", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="Kelmadi", body="Matn"
    )
    assert row is not None
    assert row.status == OutboxStatus.PENDING.value
    assert row.attempts == 0


async def test_ochirilgan_tur_navbatga_tushmaydi(session: AsyncSession) -> None:
    user = await _user(session, "nav.ochirgan", 123456)
    await outbox_service.set_preference(
        session, user_id=user.id, kind="attendance_absent", enabled=False
    )
    await session.flush()
    natija = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="Kelmadi", body="Matn"
    )
    assert natija is None


async def test_majburiy_turni_ochirib_bolmaydi(session: AsyncSession) -> None:
    """Hisob maʼlumotlarisiz odam tizimga umuman kira olmaydi (Ilova B)."""
    user = await _user(session, "nav.majburiy", 123456)
    await outbox_service.set_preference(
        session, user_id=user.id, kind="account_created", enabled=False
    )
    await session.flush()
    natija = await outbox_service.enqueue(
        session, user_id=user.id, kind="account_created", title="Kirish", body="Login: x"
    )
    assert natija is not None


async def test_bir_obyekt_boyicha_takror_qoyilmaydi(session: AsyncSession) -> None:
    user = await _user(session, "nav.takror", 123456)
    oid = uuid.uuid4()
    birinchi = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B",
        object_type="attendance", object_id=oid,
    )
    await session.flush()
    ikkinchi = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B",
        object_type="attendance", object_id=oid,
    )
    assert birinchi is not None
    assert ikkinchi is None


# ───────────────────────── Bekor qilish ─────────────────────────


async def test_sabab_yoqolsa_navbatdagi_xabar_bekor_qilinadi(session: AsyncSession) -> None:
    """Ustoz davomatni tuzatsa, hali yuborilmagan xabar ketmasligi kerak.

    Aks holda ota-ona bolasi kelganidan keyin «kelmadi» degan xabar
    olardi va tizimga ishonchi yoʻqolardi.
    """
    user = await _user(session, "nav.bekor", 123456)
    oid = uuid.uuid4()
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B",
        object_type="attendance", object_id=oid,
    )
    await session.flush()

    n = await outbox_service.cancel_for_object(
        session, object_type="attendance", object_id=oid
    )
    await session.refresh(row)
    assert n == 1
    assert row.status == OutboxStatus.CANCELLED.value


async def test_yuborilgan_xabar_bekor_qilinmaydi(session: AsyncSession) -> None:
    """U allaqachon ketgan — holatini oʻzgartirish yolgʻon boʻlardi."""
    user = await _user(session, "nav.ketgan", 123456)
    oid = uuid.uuid4()
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B",
        object_type="attendance", object_id=oid,
    )
    assert row is not None
    outbox_service.mark_sent(row)
    await session.flush()

    n = await outbox_service.cancel_for_object(
        session, object_type="attendance", object_id=oid
    )
    assert n == 0
    assert row.status == OutboxStatus.SENT.value


# ───────────────────────── Qayta urinish ─────────────────────────


async def test_xatoda_vaqt_oldinga_suriladi(session: AsyncSession) -> None:
    user = await _user(session, "nav.backoff", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B"
    )
    assert row is not None
    avvalgi = row.send_after

    outbox_service.mark_failed(row, "tarmoq")
    assert row.attempts == 1
    assert row.status == OutboxStatus.PENDING.value
    assert row.send_after > avvalgi
    assert row.last_error == "tarmoq"


async def test_uch_urinishdan_keyin_yiqiladi(session: AsyncSession) -> None:
    user = await _user(session, "nav.yiqildi", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B"
    )
    assert row is not None
    for _ in range(outbox_service.MAX_ATTEMPTS):
        outbox_service.mark_failed(row, "tarmoq")
    assert row.status == OutboxStatus.FAILED.value
    assert row.attempts == outbox_service.MAX_ATTEMPTS


async def test_yiqilgan_xabar_ochirilmaydi(session: AsyncSession) -> None:
    """BOT-06: administrator uni koʻrishi va qayta yuborishi kerak."""
    user = await _user(session, "nav.saqlanadi", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B"
    )
    assert row is not None
    for _ in range(outbox_service.MAX_ATTEMPTS):
        outbox_service.mark_failed(row, "tarmoq")
    await session.flush()

    bor = await session.scalar(
        select(NotificationOutbox).where(NotificationOutbox.id == row.id)
    )
    assert bor is not None
    assert bor.status == OutboxStatus.FAILED.value


async def test_qayta_yuborish_sanogni_nolga_qaytaradi(session: AsyncSession) -> None:
    """Bu yangi qaror, avtomatik urinishning davomi emas."""
    user = await _user(session, "nav.qayta", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B"
    )
    assert row is not None
    for _ in range(outbox_service.MAX_ATTEMPTS):
        outbox_service.mark_failed(row, "tarmoq")
    await session.flush()

    assert await outbox_service.retry(session, row.id) is True
    assert row.status == OutboxStatus.PENDING.value
    assert row.attempts == 0
    assert row.last_error is None


async def test_navbatdagi_xabarni_qayta_yuborib_bolmaydi(session: AsyncSession) -> None:
    """U allaqachon navbatda — «qayta yuborish» maʼnosiz."""
    user = await _user(session, "nav.navbatda", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B"
    )
    assert row is not None
    await session.flush()
    assert await outbox_service.retry(session, row.id) is False


# ───────────────────────── Worker toʻplami ─────────────────────────


async def test_vaqti_kelmagan_xabar_olinmaydi(session: AsyncSession) -> None:
    """Kechiktirilgan xabar (kunlik xulosa) vaqtidan oldin ketmasin."""
    user = await _user(session, "nav.kelajak", 123456)
    from datetime import timedelta

    await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_daily", title="A", body="B",
        send_after=utcnow() + timedelta(hours=2),
    )
    await session.flush()

    toplam = await outbox_service.claim_batch(session)
    assert all(r.user_id != user.id for r in toplam)


async def test_vaqti_kelgan_xabar_olinadi(session: AsyncSession) -> None:
    user = await _user(session, "nav.tayyor", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B"
    )
    assert row is not None
    await session.flush()

    toplam = await outbox_service.claim_batch(session)
    assert any(r.id == row.id for r in toplam)


@pytest.mark.parametrize("holat", [OutboxStatus.SENT, OutboxStatus.CANCELLED, OutboxStatus.FAILED])
async def test_faqat_navbatdagilar_olinadi(session: AsyncSession, holat: OutboxStatus) -> None:
    user = await _user(session, f"nav.holat{holat.value[:4]}", 123456)
    row = await outbox_service.enqueue(
        session, user_id=user.id, kind="attendance_absent", title="A", body="B"
    )
    assert row is not None
    row.status = holat.value
    await session.flush()

    toplam = await outbox_service.claim_batch(session)
    assert all(r.id != row.id for r in toplam)
