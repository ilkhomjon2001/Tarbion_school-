"""Huquq tekshiruvi (T-003).

Rol va huquq alohida narsa:

    ROL     — qaysi kabinetni ochadi, nima KOʻRADI
    HUQUQ   — nima QILA OLADI

Ikkalasi ajratilgan, chunki maktabda ikkita administrator bir xil
kabinetda ishlab, biri hisob ocha oladi, ikkinchisi yoʻq. Loyiha egasi
talabi: "user yarata olish huquqini olgan admin yarata oladi".

Superadministrator istisno: unga huquq berilmaydi, u hammasiga ega.
Aks holda superadmin oʻzidan huquqni olib qoʻyib, tizimni qulflab
qoʻyishi mumkin edi.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedError
from app.models import Permission, RoleName, UserPermission
from app.services.access import CurrentUser


def is_superadmin(user: CurrentUser) -> bool:
    return user.has(RoleName.SUPERADMIN.value)


async def granted_permissions(session: AsyncSession, user_id: uuid.UUID) -> set[str]:
    """Foydalanuvchiga berilgan (bekor qilinmagan) huquqlar."""
    rows = await session.execute(
        select(UserPermission.permission).where(
            UserPermission.user_id == user_id,
            UserPermission.is_archived.is_(False),
        )
    )
    return set(rows.scalars())


async def has_permission(session: AsyncSession, user: CurrentUser, permission: Permission) -> bool:
    """Shu huquq bormi.

    Superadministrator har doim `True` — u tizimning egasi.
    """
    if is_superadmin(user):
        return True
    return permission.value in await granted_permissions(session, user.id)


async def assert_permission(
    session: AsyncSession, user: CurrentUser, permission: Permission
) -> None:
    """Huquq yoʻq boʻlsa `403`.

    Xabar umumiy: qaysi huquq yetishmayotgani aytilmaydi, aks holda
    tizimning ichki tuzilishi oshkor boʻladi (X-3).
    """
    if not await has_permission(session, user, permission):
        raise PermissionDeniedError("Bu amal uchun ruxsatingiz yoʻq.")


async def grant(
    session: AsyncSession,
    *,
    target_user_id: uuid.UUID,
    permission: Permission,
    granted_by: CurrentUser,
) -> UserPermission | None:
    """Huquq beradi. Allaqachon berilgan boʻlsa `None` qaytaradi.

    Chaqiruvchining oʻzida `permissions.grant` boʻlishi tekshiriladi —
    bu tekshiruv chaqiruvchi qatlamda, chunki bu yerda audit yozuvi ham
    kerak (user_service ga qara).
    """
    mavjud = await granted_permissions(session, target_user_id)
    if permission.value in mavjud:
        return None

    row = UserPermission(
        user_id=target_user_id,
        permission=permission.value,
        granted_by_id=granted_by.id,
    )
    session.add(row)
    return row


async def revoke(
    session: AsyncSession, *, target_user_id: uuid.UUID, permission: Permission
) -> bool:
    """Huquqni bekor qiladi. Yozuv oʻchirilmaydi, arxivlanadi.

    Shunda "kim qachon huquq bergan va qachon olib qoʻygan" tarixi qoladi
    (CLAUDE.md 1-qoida).
    """
    from app.core.timeutil import utcnow

    rows = await session.execute(
        select(UserPermission).where(
            UserPermission.user_id == target_user_id,
            UserPermission.permission == permission.value,
            UserPermission.is_archived.is_(False),
        )
    )
    topildi = False
    for row in rows.scalars():
        row.is_archived = True
        row.archived_at = utcnow()
        topildi = True
    return topildi
