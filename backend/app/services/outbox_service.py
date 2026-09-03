"""Tashqi xabarlar navbati (T-018, BOT-02, BOT-06).

Kod xabarni **hech qachon toʻgʻridan-toʻgʻri yubormaydi** — shu servis
orqali navbatga qoʻyadi. Yuborishni alohida worker bajaradi
(`app/workers/outbox.py`).

Nega shunday: Telegram soʻrovi sekin va ishonchsiz. Agar davomat saqlash
tranzaksiyasi ichida yuborilsa, Telegram javob bermaganda butun davomat
yiqilardi — ustoz esa buning sababini tushunmasdi. Navbat bu ikkisini
ajratadi: davomat saqlanadi, xabar esa kechroq boʻlsa ham yetadi.

Tizim ichidagi bildirishnoma bu yerdan OʻTMAYDI: u `notifications`
jadvalida, darhol yoziladi va yetkazishni talab qilmaydi
(`notifications_service`).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timeutil import utcnow
from app.models import (
    AuditAction,
    NotificationOutbox,
    NotificationPreference,
    OutboxChannel,
    OutboxStatus,
    Permission,
    User,
)
from app.services import audit_service, permissions
from app.services.access import CurrentUser

#: Nechta urinishdan keyin xabar `failed` deb belgilanadi.
#:
#: Uch marta — TASKS.md talabi. Undan koʻpi foyda bermaydi: Telegram
#: uzoq tushib qolsa administrator baribir qoʻlda qayta yuboradi
#: (BOT-06), avtomatik urinish esa navbatni band qilib turardi.
MAX_ATTEMPTS = 3

#: Urinishlar orasidagi kutish. Har xatodan keyin keyingisiga oʻtiladi.
#: Birinchisi qisqa — tarmoqdagi bir lahzalik uzilish darhol tuzaladi;
#: keyingilari uzunroq, chunki uzoq davom etayotgan nosozlikni tez-tez
#: soʻrash bilan hal qilib boʻlmaydi.
BACKOFF = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30))

#: Foydalanuvchi OʻCHIRA OLMAYDIGAN turlar (Ilova B — «majburiylaridan
#: tashqari»). Hisob maʼlumotlari va parolni tiklash kodini olmaslikni
#: tanlash mumkin emas: usiz odam tizimga umuman kira olmaydi.
MAJBURIY_TURLAR = frozenset({"account_created", "password_reset"})


async def _yoqilganmi(session: AsyncSession, user_id: uuid.UUID, kind: str) -> bool:
    """Foydalanuvchi shu turni olishni xohlaydimi.

    Qator faqat OʻCHIRILGAN turlar uchun yaratiladi — yozuv boʻlmasa
    tur yoqiq. Shunda yangi tur qoʻshilganda hech kimga qator yozish
    kerak emas.
    """
    if kind in MAJBURIY_TURLAR:
        return True
    holat = await session.scalar(
        select(NotificationPreference.enabled).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.kind == kind,
            NotificationPreference.is_archived.is_(False),
        )
    )
    return True if holat is None else holat


async def enqueue(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str,
    channel: str = OutboxChannel.TELEGRAM.value,
    object_type: str | None = None,
    object_id: uuid.UUID | None = None,
    send_after: datetime | None = None,
) -> NotificationOutbox | None:
    """Xabarni navbatga qoʻyadi. `None` — qoʻyilmadi.

    Uch holatda qoʻyilmaydi:
      · foydalanuvchi shu turni oʻchirgan;
      · Telegram'i ulanmagan (`telegram_id` boʻsh) — yuboradigan joy
        yoʻq, navbatni behuda toʻldirmaymiz;
      · xuddi shu obyekt boʻyicha shu turdagi xabar allaqachon navbatda
        turibdi (takror yuborilmasin).

    `commit` QILINMAYDI: chaqiruvchi tranzaksiyasi ichida qoladi, ya'ni
    davomat saqlanmasa xabar ham navbatga tushmaydi.
    """
    if not await _yoqilganmi(session, user_id, kind):
        return None

    if channel == OutboxChannel.TELEGRAM.value:
        telegram_id = await session.scalar(select(User.telegram_id).where(User.id == user_id))
        if telegram_id is None:
            return None

    if object_id is not None:
        takror = await session.scalar(
            select(NotificationOutbox.id).where(
                NotificationOutbox.user_id == user_id,
                NotificationOutbox.kind == kind,
                NotificationOutbox.object_id == object_id,
                NotificationOutbox.status == OutboxStatus.PENDING.value,
            )
        )
        if takror is not None:
            return None

    qator = NotificationOutbox(
        user_id=user_id,
        kind=kind,
        channel=channel,
        title=title[:160],
        body=body[:1000],
        status=OutboxStatus.PENDING.value,
        # `attempts` ni ATAYLAB shu yerda belgilaymiz: ustundagi
        # `default=0` faqat INSERT paytida qoʻllanadi, obyekt esa
        # flush'gacha `None` boʻlib qolardi va `+= 1` yiqilardi.
        attempts=0,
        send_after=send_after or utcnow(),
        object_type=object_type,
        object_id=object_id,
    )
    session.add(qator)
    return qator


async def cancel_for_object(
    session: AsyncSession, *, object_type: str, object_id: uuid.UUID, kind: str | None = None
) -> int:
    """Sabab yoʻqolgan xabarlarni bekor qiladi. Qaytaradi: nechtasi.

    Misol: ustoz davomatni «kelmadi» dan «keldi» ga tuzatdi. Xabar hali
    navbatda boʻlsa uni yuborish notoʻgʻri — ota-ona bolasi kelganidan
    keyin «kelmadi» degan xabar olardi.

    Yuborilgan xabar bekor qilinmaydi: u allaqachon ketgan.
    """
    stmt = (
        update(NotificationOutbox)
        .where(
            NotificationOutbox.object_type == object_type,
            NotificationOutbox.object_id == object_id,
            NotificationOutbox.status == OutboxStatus.PENDING.value,
        )
        .values(status=OutboxStatus.CANCELLED.value)
    )
    if kind is not None:
        stmt = stmt.where(NotificationOutbox.kind == kind)
    natija = await session.execute(stmt)
    return natija.rowcount or 0


async def claim_batch(session: AsyncSession, limit: int = 50) -> list[NotificationOutbox]:
    """Worker uchun vaqti kelgan xabarlarni oladi.

    `WITH ... FOR UPDATE SKIP LOCKED` — ikkita worker bir vaqtda
    ishlasa ham bitta xabar ikki marta yuborilmaydi: birinchisi qulflab
    oladi, ikkinchisi uni oʻtkazib yuboradi.
    """
    rows = await session.execute(
        select(NotificationOutbox)
        .where(
            NotificationOutbox.status == OutboxStatus.PENDING.value,
            NotificationOutbox.send_after <= utcnow(),
            NotificationOutbox.is_archived.is_(False),
        )
        .order_by(NotificationOutbox.send_after, NotificationOutbox.id)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    return list(rows.scalars())


def mark_sent(row: NotificationOutbox) -> None:
    row.status = OutboxStatus.SENT.value
    row.sent_at = utcnow()
    row.attempts += 1
    row.last_error = None


def mark_failed(row: NotificationOutbox, error: str) -> None:
    """Xatoni qayd etadi va keyingi urinish vaqtini belgilaydi.

    Urinishlar tugagach `failed` — lekin qator OʻCHIRILMAYDI. U
    administrator ekranida koʻrinadi va qoʻlda qayta yuborilishi mumkin
    (BOT-06).
    """
    row.attempts += 1
    row.last_error = error[:300]
    if row.attempts >= MAX_ATTEMPTS:
        row.status = OutboxStatus.FAILED.value
        return
    row.send_after = utcnow() + BACKOFF[min(row.attempts - 1, len(BACKOFF) - 1)]


async def retry(session: AsyncSession, outbox_id: uuid.UUID) -> bool:
    """Yiqilgan xabarni navbatga qaytaradi (BOT-06). Administrator amali.

    Urinishlar sanogʻi nolga qaytadi — bu yangi qaror, avtomatik
    urinishning davomi emas.
    """
    row = await session.get(NotificationOutbox, outbox_id)
    if row is None or row.status != OutboxStatus.FAILED.value:
        return False
    row.status = OutboxStatus.PENDING.value
    row.attempts = 0
    row.last_error = None
    row.send_after = utcnow()
    return True


async def set_preference(
    session: AsyncSession, *, user_id: uuid.UUID, kind: str, enabled: bool
) -> None:
    """Foydalanuvchi turni yoqadi yoki oʻchiradi.

    Majburiy turni oʻchirishga urinish jimgina eʼtiborsiz qoldiriladi —
    interfeys bunday turni umuman koʻrsatmaydi.
    """
    if kind in MAJBURIY_TURLAR:
        return
    qator = await session.scalar(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.kind == kind,
        )
    )
    if qator is None:
        session.add(
            NotificationPreference(user_id=user_id, kind=kind, enabled=enabled)
        )
        return
    qator.enabled = enabled
    qator.is_archived = False
    qator.archived_at = None


# ─────────────────── BOT-06: administrator jurnali ───────────────────

#: Matni administratorga KOʻRSATILMAYDIGAN turlar.
#:
#: Parolni tiklash xabarida bir martalik kod bor. Jurnal ekrani
#: yetkazish muammosini koʻrish uchun, xabar mazmunini oʻqish uchun
#: emas — kodni koʻrsatish esa uni oʻgʻirlashga yoʻl ochardi (X-10).
MAXFIY_TURLAR = frozenset({"password_reset"})

MASKA = "«matn koʻrsatilmaydi — maxfiy kod»"


@dataclass(frozen=True, slots=True)
class OutboxRow:
    """Jurnaldagi bitta xabar."""

    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    kind: str
    channel: str
    title: str
    body: str
    status: str
    attempts: int
    last_error: str | None
    send_after: datetime
    sent_at: datetime | None
    created_at: datetime


async def admin_list(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    status: str | None = None,
    limit: int = 100,
) -> list[OutboxRow]:
    """Xabar navbati — administrator uchun (BOT-06).

    Sukut boʻyicha YIQILGANLAR: ekranning maqsadi muammoni koʻrsatish.
    Muvaffaqiyatli yuborilgan minglab xabar orasida yiqilgan uchtasini
    topib boʻlmasdi.
    """
    await permissions.assert_permission(session, actor, Permission.ANNOUNCEMENTS_PUBLISH)

    stmt = (
        select(NotificationOutbox, User.last_name, User.first_name)
        .join(User, User.id == NotificationOutbox.user_id)
        .order_by(NotificationOutbox.created_at.desc())
        .limit(min(limit, 500))
    )
    if status:
        stmt = stmt.where(NotificationOutbox.status == status)

    rows = await session.execute(stmt)
    return [
        OutboxRow(
            id=r.id,
            user_id=r.user_id,
            user_name=f"{familiya} {ism}".strip(),
            kind=r.kind,
            channel=r.channel,
            title=r.title,
            body=MASKA if r.kind in MAXFIY_TURLAR else r.body,
            status=r.status,
            attempts=r.attempts,
            last_error=r.last_error,
            send_after=r.send_after,
            sent_at=r.sent_at,
            created_at=r.created_at,
        )
        for r, familiya, ism in rows.all()
    ]


async def admin_counts(session: AsyncSession, actor: CurrentUser) -> dict[str, int]:
    """Holatlar boʻyicha sanoq — ekran boshidagi qator."""
    await permissions.assert_permission(session, actor, Permission.ANNOUNCEMENTS_PUBLISH)
    rows = await session.execute(
        select(NotificationOutbox.status, func.count()).group_by(NotificationOutbox.status)
    )
    natija = {s.value: 0 for s in OutboxStatus}
    natija.update(dict(rows.all()))
    return natija


async def admin_retry(
    session: AsyncSession, actor: CurrentUser, outbox_id: uuid.UUID, *, ip: str | None = None
) -> bool:
    """Bitta xabarni qayta yuborish (BOT-06)."""
    await permissions.assert_permission(session, actor, Permission.ANNOUNCEMENTS_PUBLISH)
    ok = await retry(session, outbox_id)
    if ok:
        audit_service.record(
            session,
            object_type="notification_outbox",
            object_id=outbox_id,
            action=AuditAction.UPDATE,
            new={"retried": True},
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()
    return ok


async def admin_retry_failed(
    session: AsyncSession, actor: CurrentUser, *, ip: str | None = None
) -> int:
    """Barcha yiqilganlarni qayta navbatga qoʻyadi. Qaytaradi: nechta.

    Telegram bir necha soat tushib qolsa oʻnlab xabar yiqiladi —
    ularni bittalab bosib chiqish administratorni charchatardi va
    amalda hech kim qilmasdi.
    """
    await permissions.assert_permission(session, actor, Permission.ANNOUNCEMENTS_PUBLISH)
    rows = await session.execute(
        select(NotificationOutbox).where(
            NotificationOutbox.status == OutboxStatus.FAILED.value,
            NotificationOutbox.is_archived.is_(False),
        )
    )
    n = 0
    for row in rows.scalars():
        row.status = OutboxStatus.PENDING.value
        row.attempts = 0
        row.last_error = None
        row.send_after = utcnow()
        n += 1

    if n:
        audit_service.record(
            session,
            object_type="notification_outbox",
            object_id=None,
            action=AuditAction.UPDATE,
            new={"retried_all": n},
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()
    return n
