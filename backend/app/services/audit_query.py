"""Audit jurnalini oʻqish (T-021). TZ: NFR-10, DAV-07, JUR-07.

`audit_service.py` YOZADI, bu modul OʻQIYDI. Ikkalasi alohida:
yozish har bir servisdan chaqiriladi va yengil boʻlishi kerak,
oʻqish esa faqat administrator ekranida va murakkab filtrga ega.

Ikki qoida:

1. **Faqat butun maktabni koʻradiganlarga.** Audit yozuvlarida
   oʻquvchi ismi, bahosi va toʻlovi bor — bu ochiq roʻyxat emas.
   Ustoz oʻz izini koʻrishi ham kerak emas: u nima qilganini
   biladi, kimdir uni tekshirsa — bu administratorning ishi.

2. **Yozish endpointi YOʻQ.** Bu modulda faqat `select`. Bazada
   ham `UPDATE`/`DELETE` trigger bilan toʻsilgan (T-021 migratsiyasi)
   — ikki qatlam, chunki jurnalning butunligi shu tizimning eng
   oxirgi dalili.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import Text, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedError
from app.core.timeutil import local_day_bounds
from app.models import AuditLog, User
from app.services.access import CurrentUser

#: Bir soʻrovda eng koʻpi. Audit jadvali tez oʻsadi — cheklovsiz
#: soʻrov bir necha yildan keyin butun jadvalni tortib olardi.
MAX_LIMIT = 200


@dataclass(frozen=True, slots=True)
class AuditRow:
    id: uuid.UUID
    created_at: datetime
    object_type: str
    object_id: uuid.UUID | None
    action: str
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    actor_id: uuid.UUID | None
    #: Kim qilgani — `null` boʻlsa tizim (masalan generatsiya).
    actor_name: str | None
    ip_address: str | None


@dataclass(frozen=True, slots=True)
class AuditPage:
    rows: list[AuditRow]
    total: int
    #: Keyingi sahifa bormi — `offset + limit < total`.
    has_more: bool


def _assert_can_read(user: CurrentUser) -> None:
    """1-qoida: faqat butun maktabni koʻradiganlarga.

    `is_staff_wide` — administrator, direktor, oʻquv boʻlimi va super
    administrator. Ustoz va ota-onaga jurnal berilmaydi.
    """
    if not user.is_staff_wide:
        raise PermissionDeniedError("Audit jurnalini koʻrishga ruxsatingiz yoʻq.")


async def list_entries(
    session: AsyncSession,
    user: CurrentUser,
    *,
    object_type: str | None = None,
    action: str | None = None,
    actor_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AuditPage:
    """Filtrlangan sahifa.

    Sana filtri MAHALLIY kun chegarasi boʻyicha (CLAUDE.md 3-qoida):
    `created_at` UTC da saqlanadi va Toshkentda 01:00 da yozilgan
    yozuv UTC da hali kechagi kun boʻladi. Xom UTC sana bilan
    filtrlansa administrator «kechagi oʻzgarish» deb izlaganini
    topolmasdi.
    """
    _assert_can_read(user)
    limit = max(1, min(limit, MAX_LIMIT))

    aktor = User.__table__.alias("aktor")
    shartlar = []

    if object_type:
        shartlar.append(AuditLog.object_type == object_type)
    if action:
        shartlar.append(AuditLog.action == action)
    if actor_id is not None:
        shartlar.append(AuditLog.actor_id == actor_id)
    if date_from is not None:
        shartlar.append(AuditLog.created_at >= local_day_bounds(date_from)[0])
    if date_to is not None:
        shartlar.append(AuditLog.created_at < local_day_bounds(date_to)[1])
    if query:
        naqsh = f"%{query.strip()}%"
        shartlar.append(
            or_(
                AuditLog.object_type.ilike(naqsh),
                AuditLog.action.ilike(naqsh),
                aktor.c.last_name.ilike(naqsh),
                aktor.c.first_name.ilike(naqsh),
                # JSONB ni matnga oʻgirib qidiramiz: administrator
                # koʻpincha «5000000» yoki «Aliyev» deb izlaydi va u
                # eski/yangi qiymat ichida boʻladi.
                func.cast(AuditLog.new_value, Text).ilike(naqsh),
            )
        )

    asos = (
        select(AuditLog, aktor.c.last_name, aktor.c.first_name)
        .join(aktor, aktor.c.id == AuditLog.actor_id, isouter=True)
        .where(*shartlar)
    )

    total = await session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .join(aktor, aktor.c.id == AuditLog.actor_id, isouter=True)
        .where(*shartlar)
    )

    rows = (
        await session.execute(
            asos.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    return AuditPage(
        rows=[
            AuditRow(
                id=a.id,
                created_at=a.created_at,
                object_type=a.object_type,
                object_id=a.object_id,
                action=a.action,
                old_value=a.old_value,
                new_value=a.new_value,
                actor_id=a.actor_id,
                actor_name=f"{last} {first}" if last else None,
                # `INET` ustuni `IPv4Address` obyekti qaytaradi, matn
                # emas — Pydantic uni qabul qilmaydi.
                ip_address=str(a.ip_address) if a.ip_address else None,
            )
            for a, last, first in rows
        ],
        total=total or 0,
        has_more=(offset + limit) < (total or 0),
    )


async def filter_options(session: AsyncSession, user: CurrentUser) -> tuple[list[str], list[str]]:
    """Jurnalda HAQIQATAN uchraydigan obyekt turlari va amallar.

    Qatʼiy roʻyxat yozib qoʻyish notoʻgʻri boʻlardi: yangi modul
    qoʻshilganda filtr roʻyxati eskirib qolardi va administrator
    yangi turdagi yozuvni filtrlab koʻra olmasdi.
    """
    _assert_can_read(user)

    turlar = (
        await session.execute(
            select(AuditLog.object_type).distinct().order_by(AuditLog.object_type)
        )
    ).scalars()
    amallar = (
        await session.execute(select(AuditLog.action).distinct().order_by(AuditLog.action))
    ).scalars()
    return list(turlar), list(amallar)
