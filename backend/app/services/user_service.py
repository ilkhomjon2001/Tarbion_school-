"""Foydalanuvchi hisobi (T-003).

Loyihada **oʻz-oʻzidan roʻyxatdan oʻtish yoʻq**. Hisobni faqat huquqi bor
administrator yoki superadministrator ochadi. Sabab: maktabda kim
oʻqiyotgani va kim ishlayotgani ma'lum — begona odam hisob ocha olmasligi
kerak.

Login administrator tanlamaydi: `familiya.ism` shaklida tizim yasaydi
(`core/naming.py`). Boshlangʻich parol — 5 xonali raqam, hisob
`must_change_password=True` bilan yaratiladi.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.naming import build_login, login_variant
from app.core.security import (
    generate_initial_password,
    hash_password,
    validate_new_password,
    verify_password,
)
from app.core.timeutil import utcnow
from app.models import AuditAction, Permission, Role, RoleName, User, UserRole
from app.services import audit_service, permissions
from app.services.access import CurrentUser


@dataclass(frozen=True, slots=True)
class CreatedUser:
    """Yangi hisob va uning boshlangʻich paroli.

    Parol FAQAT shu javobda bir marta koʻrsatiladi — bazada xesh saqlanadi,
    tiklab boʻlmaydi. Administrator uni oʻsha zahoti egasiga yetkazadi.
    """

    user: User
    initial_password: str


async def next_free_login(session: AsyncSession, last_name: str, first_name: str) -> str:
    """Band boʻlmagan login topadi.

    Takrorlanish maktabda oddiy hol (bir sinfda ikkita `Rahimov Aziz`),
    shuning uchun raqam qoʻshiladi: `rahimov.aziz`, `rahimov.aziz2`.

    Yakuniy kafolat baza tomonidagi `unique` cheklovi: ikki administrator
    bir vaqtda hisob ochsa, ikkinchisi `IntegrityError` oladi va qayta
    urinadi. Bu yerdagi tekshiruv — qulaylik, kafolat emas.
    """
    base = build_login(last_name, first_name)

    band = set(
        (await session.execute(select(User.login).where(User.login.like(f"{base}%")))).scalars()
    )
    if not band:
        return base

    for i in range(1, len(band) + 2):
        nomzod = login_variant(base, i)
        if nomzod not in band:
            return nomzod

    raise ConflictError("Login yasab boʻlmadi — juda koʻp takrorlanish.")


async def _roles_by_name(session: AsyncSession, names: list[str]) -> list[Role]:
    if not names:
        raise ValidationError("Kamida bitta rol tanlanishi kerak.")

    nomalum = set(names) - {r.value for r in RoleName}
    if nomalum:
        raise ValidationError(f"Nomaʼlum rol: {', '.join(sorted(nomalum))}")

    rows = await session.execute(select(Role).where(Role.name.in_(names)))
    topilgan = list(rows.scalars())
    if len(topilgan) != len(set(names)):
        raise NotFoundError("Rol maʼlumotnomasi toʻliq emas. Migratsiyani tekshiring.")
    return topilgan


async def create_user(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    last_name: str,
    first_name: str,
    middle_name: str | None = None,
    roles: list[str],
    phone: str | None = None,
    email: str | None = None,
    ip: str | None = None,
) -> CreatedUser:
    """Yangi hisob ochadi.

    Huquq: `users.create` yoki superadministrator.

    Superadministrator rolini faqat superadministrator bera oladi — aks
    holda `users.create` huquqi bor administrator oʻziga teng hisob ochib,
    huquq cheklovini butunlay aylanib oʻtardi.
    """
    await permissions.assert_permission(session, actor, Permission.USERS_CREATE)

    if RoleName.SUPERADMIN.value in roles and not permissions.is_superadmin(actor):
        raise ValidationError("Super administrator rolini faqat super administrator bera oladi.")

    if not last_name.strip() or not first_name.strip():
        raise ValidationError("Familiya va ism boʻsh boʻlmasin.")

    role_rows = await _roles_by_name(session, roles)

    login = await next_free_login(session, last_name, first_name)
    parol = generate_initial_password()

    user = User(
        login=login,
        password_hash=hash_password(parol),
        last_name=last_name.strip(),
        first_name=first_name.strip(),
        middle_name=(middle_name or "").strip() or None,
        phone=(phone or "").strip() or None,
        email=(email or "").strip() or None,
        # Boshlangʻich parol 5 xonali — u faqat birinchi kirish uchun.
        must_change_password=True,
    )
    session.add(user)
    await session.flush()

    for role in role_rows:
        session.add(UserRole(user_id=user.id, role_id=role.id))

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.CREATE,
        new={
            "login": login,
            "full_name": user.full_name,
            "roles": sorted(r.name for r in role_rows),
        },
        actor_id=actor.id,
        ip=ip,
    )

    return CreatedUser(user=user, initial_password=parol)


async def change_own_password(
    session: AsyncSession,
    *,
    user: User,
    current_password: str,
    new_password: str,
    ip: str | None = None,
) -> None:
    """Foydalanuvchi oʻz parolini almashtiradi.

    Eski parol soʻraladi: ochiq qolgan sessiyani topgan odam parolni
    almashtirib, hisobni butunlay egallab olmasin.
    """
    if not verify_password(current_password, user.password_hash):
        raise ValidationError("Joriy parol notoʻgʻri.")

    validate_new_password(new_password)

    if verify_password(new_password, user.password_hash):
        raise ValidationError("Yangi parol eskisidan farq qilsin.")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False

    # Parolning oʻzi hech qayerda yozilmaydi — `audit_service` maxsus
    # maydonlarni ***`ga almashtiradi, lekin biz ularni umuman yubormaymiz.
    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"password_changed": True},
        actor_id=user.id,
        ip=ip,
    )


async def reset_password(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    ip: str | None = None,
) -> str:
    """Administrator parolni tiklaydi — yangi 5 xonali parol beriladi.

    Foydalanuvchi keyingi kirishda uni almashtirishga majbur boʻladi.
    """
    await permissions.assert_permission(session, actor, Permission.USERS_RESET_PASSWORD)

    user = await session.get(User, user_id)
    if user is None or user.is_archived:
        raise NotFoundError("Foydalanuvchi topilmadi.")

    parol = generate_initial_password()
    user.password_hash = hash_password(parol)
    user.must_change_password = True

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"password_reset": True},
        actor_id=actor.id,
        ip=ip,
    )
    return parol


async def archive_user(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    ip: str | None = None,
) -> User:
    """Hisobni arxivlaydi. Oʻchirish yoʻq (CLAUDE.md 1-qoida).

    Oʻzini arxivlash taqiqlanadi: superadministrator xato bilan oʻzini
    oʻchirib, tizimga kira olmay qolmasin.
    """
    await permissions.assert_permission(session, actor, Permission.USERS_MANAGE)

    if user_id == actor.id:
        raise ValidationError("Oʻz hisobingizni arxivlay olmaysiz.")

    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError("Foydalanuvchi topilmadi.")
    if user.is_archived:
        return user

    user.is_archived = True
    user.archived_at = utcnow()
    user.is_active = False

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    return user


async def count_users(session: AsyncSession) -> int:
    return await session.scalar(select(func.count()).select_from(User)) or 0
