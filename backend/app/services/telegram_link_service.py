"""Telegram hisobini bogʻlash (T-017, BOT-01).

TZ: «Vasiy telefon raqami va bir martalik kod orqali botga ulanadi.»

Ikkala shart ham kerak va har biri boshqa narsani isbotlaydi:

  · **telefon** — Telegram tomonidan tasdiqlangan (contact tugmasi).
    Bu odamda oʻsha SIM borligini koʻrsatadi, lekin maktabdagi hisob
    unga tegishli ekanini emas: raqam almashishi mumkin, eski egasi
    bazada qolib ketishi mumkin;
  · **kod** — foydalanuvchi oʻz kabinetidan oladi. Bu maktabdagi
    hisobning parolini bilishini isbotlaydi.

Faqat telefon boʻlsa: raqamni qayta olgan begona odam oilaning davomat
va baho xabarlarini ola boshlardi. Faqat kod boʻlsa: kod boshqa odamga
oʻtib ketsa, uni kim ishlatgani tekshirilmasdi.

──────────────────────────────────────────────────────────────────────
Bot bu yerdan tashqariga chiqmaydi (X-8)

Butun mantiq shu servisda; `app/bot/` faqat Telegram qobigʻi. Bot
foydalanuvchidan kelgan `student_id` ni hech qachon ishonchli deb
qabul qilmaydi — u faqat `telegram_id` ni biladi, qolganini
`access.py` hal qiladi.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.phone import normalize_phone
from app.core.security import (
    generate_numeric_code,
    hash_password,
    verify_password_constant_time,
)
from app.core.timeutil import utcnow
from app.models import (
    AuditAction,
    NotificationOutbox,
    OutboxStatus,
    TelegramLinkCode,
    User,
)
from app.services import audit_service

#: Kod uzunligi va umri. Parolni tiklashdan uzunroq muddat: odam
#: kabinetdan kodni olib, telefonini qoʻlga olib, botni topib, contact
#: yuborishi kerak — bularning hammasi 10 daqiqaga sigʻmasligi mumkin.
CODE_DIGITS = 6
CODE_TTL = timedelta(minutes=15)

#: Notoʻgʻri kod necha marta kiritilsa kod kuyadi.
MAX_ATTEMPTS = 5


class LinkError(Exception):
    """Bogʻlab boʻlmadi. Matni foydalanuvchiga koʻrsatiladi."""


async def issue_code(session: AsyncSession, user_id: uuid.UUID) -> str:
    """Foydalanuvchi uchun yangi bogʻlash kodi. Eskisi kuyadi.

    Kod XOM qaytariladi va faqat shu yerda koʻrinadi — bazada xeshi
    saqlanadi (X-10).
    """
    eski = await session.execute(
        select(TelegramLinkCode).where(
            TelegramLinkCode.user_id == user_id,
            TelegramLinkCode.used_at.is_(None),
            TelegramLinkCode.is_archived.is_(False),
        )
    )
    for row in eski.scalars():
        # Yangi kod soʻralganda eskisi ishlamasin: odam kodni birovga
        # koʻrsatib, keyin «boshqasini olaman» desa eskisi yopilsin.
        row.used_at = utcnow()

    kod = generate_numeric_code(CODE_DIGITS)
    session.add(
        TelegramLinkCode(
            user_id=user_id,
            code_hash=hash_password(kod),
            expires_at=utcnow() + CODE_TTL,
            attempts=0,
        )
    )
    await session.commit()
    return kod


async def link(
    session: AsyncSession, *, phone: str, code: str, telegram_id: int
) -> User:
    """Telefon + kod → `telegram_id` bogʻlanadi. Xatoda `LinkError`.

    Xabarlar ATAYLAB aniq: bu yerda oshkor qilish xavfi yoʻq —
    odam oʻz raqamini Telegram orqali tasdiqlab boʻlgan, va aniq
    boʻlmagan xabar uni maktabga qoʻngʻiroq qilishga majbur qilardi.
    """
    normal = normalize_phone(phone)
    if normal is None:
        raise LinkError("Raqamni tanib boʻlmadi. Maktab administratoriga murojaat qiling.")

    user = await session.scalar(
        select(User).where(User.phone == normal, User.is_archived.is_(False))
    )
    if user is None:
        raise LinkError(
            "Bu raqam maktab bazasida topilmadi.\n\n"
            "Raqamingiz oʻzgargan boʻlsa maktab administratoriga ayting — "
            "u yangilaydi va keyin qaytadan urinib koʻrasiz."
        )

    if user.telegram_id is not None and user.telegram_id != telegram_id:
        raise LinkError(
            "Bu raqamga boshqa Telegram hisobi ulangan.\n\n"
            "Avval oʻsha hisobdan /uzish yuboring yoki administratorga murojaat qiling."
        )

    band = await session.scalar(
        select(User).where(User.telegram_id == telegram_id, User.id != user.id)
    )
    if band is not None:
        # Bitta Telegram akkaunt bitta odamga (BOT-01).
        raise LinkError(
            "Bu Telegram hisobi boshqa foydalanuvchiga ulangan.\n\n"
            "Avval /uzish yuboring."
        )

    sorov = await session.scalar(
        select(TelegramLinkCode)
        .where(
            TelegramLinkCode.user_id == user.id,
            TelegramLinkCode.used_at.is_(None),
            TelegramLinkCode.is_archived.is_(False),
        )
        .order_by(TelegramLinkCode.created_at.desc())
        .limit(1)
    )
    xato = "Kod notoʻgʻri yoki muddati oʻtgan. Kabinetdan yangi kod oling."
    if sorov is None or sorov.code_hash is None:
        verify_password_constant_time(code, None)
        raise LinkError(xato)
    if sorov.expires_at is not None and sorov.expires_at < utcnow():
        raise LinkError(xato)
    if sorov.attempts >= MAX_ATTEMPTS:
        raise LinkError(xato)
    if not verify_password_constant_time(code.strip(), sorov.code_hash):
        sorov.attempts += 1
        await session.commit()
        raise LinkError(xato)

    sorov.used_at = utcnow()
    user.telegram_id = telegram_id

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"telegram_linked": True},
        actor_id=user.id,
    )
    await session.commit()
    return user


async def unlink(session: AsyncSession, telegram_id: int) -> bool:
    """`/uzish` — bogʻlanishni uzadi. Qaytaradi: uzildimi.

    Hisob oʻchirilmaydi, faqat `telegram_id` boʻshaydi. Navbatdagi
    yuborilmagan xabarlar bekor qilinadi: ular endi yetkazilmaydi va
    navbatda «yiqilgan» boʻlib turishi notoʻgʻri boʻlardi.
    """
    user = await session.scalar(select(User).where(User.telegram_id == telegram_id))
    if user is None:
        return False

    user.telegram_id = None

    # Navbatdagi yuborilmagan xabarlar bekor qilinadi: yuboradigan joy
    # qolmadi, ular esa uch marta urinib «yiqilgan» boʻlib qolardi va
    # administrator ekranini soxta xatolar bilan toʻldirardi.
    await session.execute(
        update(NotificationOutbox)
        .where(
            NotificationOutbox.user_id == user.id,
            NotificationOutbox.status == OutboxStatus.PENDING.value,
        )
        .values(status=OutboxStatus.CANCELLED.value)
    )

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"telegram_unlinked": True},
        actor_id=user.id,
    )
    await session.commit()
    return True


async def linked_user(session: AsyncSession, telegram_id: int) -> User | None:
    """Shu Telegram hisobiga bogʻlangan foydalanuvchi."""
    return await session.scalar(
        select(User).where(User.telegram_id == telegram_id, User.is_archived.is_(False))
    )


__all__ = [
    "CODE_DIGITS",
    "CODE_TTL",
    "LinkError",
    "MAX_ATTEMPTS",
    "issue_code",
    "link",
    "linked_user",
    "unlink",
]
