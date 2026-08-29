"""Vaqt bilan ishlash.

CLAUDE.md 3-qoida: bazada har doim UTC (TIMESTAMPTZ), ko'rsatishda
Asia/Tashkent. "Bugungi davomat" hisoblanganda MAHALLIY kun chegarasi
olinadi, UTC kuni emas — aks holda soat 05:00 gacha bo'lgan darslar
kechagi kunga tushib qoladi.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings

DISPLAY_TZ = ZoneInfo(settings.display_timezone)


def utcnow() -> datetime:
    """Timezone-aware UTC hozirgi vaqt."""
    return datetime.now(UTC)


def local_today() -> date:
    """Asia/Tashkent bo'yicha bugungi sana."""
    return utcnow().astimezone(DISPLAY_TZ).date()


def local_day_bounds(day: date) -> tuple[datetime, datetime]:
    """Mahalliy kunning [boshi, oxiri) chegarasi, UTC da qaytadi.

    Bazadagi TIMESTAMPTZ ustunlar bilan solishtirish uchun ishlatiladi.
    """
    start_local = datetime.combine(day, time.min, tzinfo=DISPLAY_TZ)
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(UTC), end_local.astimezone(UTC)


def combine_local(day: date, moment: time) -> datetime:
    """Mahalliy sana + vaqtni UTC datetime ga aylantiradi.

    Dars boshlanish/tugash vaqtini hisoblashda ishlatiladi: jadvalda vaqt
    mahalliy (08:30), lekin taqqoslash UTC da bo'lishi kerak.
    """
    return datetime.combine(day, moment, tzinfo=DISPLAY_TZ).astimezone(UTC)


def to_display(moment: datetime) -> datetime:
    """UTC vaqtni ko'rsatish uchun Asia/Tashkent ga o'giradi."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(DISPLAY_TZ)
