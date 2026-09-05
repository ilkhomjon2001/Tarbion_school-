"""Huquqlar markazi — super administrator uchun (T-005).

Super administrator RAHBAR EMAS. Rahbariyat hisobotlarni oʻqiydi;
super administrator esa tizimni sozlaydi: **kim nimani koʻradi** va
**kim nima qila oladi**.

Ikkalasi alohida tushuncha:

    BOʻLIM (`core/sections.py`)   — nimani KOʻRADI. Menyudagi punkt.
    HUQUQ  (`Permission`)         — nima QILA OLADI. Aniq amal.

Masalan ikkita administrator bir xil boʻlimlarni koʻrishi, lekin biri
hisob ocha olishi, ikkinchisi yoʻqligi mumkin.

Faqat super administrator oʻzgartira oladi. `permissions.grant` huquqi
bor odam ham boshqalarga huquq bera oladi — lekin oʻzidan yuqorisini
emas (quyidagi tekshiruvlarga qara).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.sections import (
    cabinet_of,
    effective_sections,
    role_default_sections,
    unknown_sections,
)
from app.core.security import (
    generate_readable_password,
    hash_password,
    validate_new_password,
)
from app.core.timeutil import utcnow
from app.models import AuditAction, Permission, RoleName, User
from app.services import audit_service, permissions, user_service
from app.services.access import CurrentUser


@dataclass(frozen=True, slots=True)
class UserAccess:
    """Foydalanuvchining toʻliq kirish holati."""

    user: User
    roles: list[str]
    cabinet: str
    sections: list[str]
    #: Rol standarti — interfeys "oʻzgartirilgan" ni koʻrsatishi uchun.
    default_sections: list[str]
    customized: bool
    permissions: list[str]


async def _load_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    if user is None:
        # X-3: mavjud emas ham, ruxsat yoʻq ham bir xil koʻrinadi.
        raise NotFoundError("Foydalanuvchi topilmadi.")
    return user


async def _assert_can_manage(session: AsyncSession, actor: CurrentUser) -> None:
    """Huquqlarni faqat super administrator yoki `permissions.grant` bori."""
    if permissions.is_superadmin(actor):
        return
    await permissions.assert_permission(session, actor, Permission.PERMISSIONS_GRANT)


async def get_access(session: AsyncSession, user_id: uuid.UUID) -> UserAccess:
    user = await _load_user(session, user_id)
    roles = set(user.role_names)
    berilgan = await permissions.granted_permissions(session, user.id)

    return UserAccess(
        user=user,
        roles=sorted(roles),
        cabinet=cabinet_of(roles),
        sections=effective_sections(roles, user.section_overrides),
        default_sections=role_default_sections(roles),
        customized=user.section_overrides is not None,
        # Superadminda huquq yozuvlari yoʻq — u hammasiga ega.
        permissions=(
            sorted(p.value for p in Permission)
            if RoleName.SUPERADMIN.value in roles
            else sorted(berilgan)
        ),
    )


async def set_sections(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    sections: list[str] | None,
    ip: str | None = None,
) -> UserAccess:
    """Foydalanuvchi koʻradigan boʻlimlarni belgilaydi.

    `sections=None` — istisnoni bekor qilib, rol standartiga qaytaradi.

    Super administratorning boʻlimlarini cheklab boʻlmaydi: u tizimni
    sozlaydi va oʻzini qulflab qoʻyishi mumkin emas.
    """
    await _assert_can_manage(session, actor)
    user = await _load_user(session, user_id)

    if RoleName.SUPERADMIN.value in set(user.role_names):
        raise ValidationError(
            "Super administratorning boʻlimlarini cheklab boʻlmaydi — u tizimni sozlaydi."
        )

    if sections is not None:
        nomalum = unknown_sections(sections)
        if nomalum:
            raise ValidationError(f"Nomaʼlum boʻlim: {', '.join(nomalum)}")

    eski = user.section_overrides
    if eski == sections:
        return await get_access(session, user_id)

    user.section_overrides = sections
    audit_service.record(
        session,
        object_type="user_access",
        object_id=user.id,
        action=AuditAction.UPDATE,
        old={"sections": eski},
        new={"sections": sections},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return await get_access(session, user_id)


async def set_permissions(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    wanted: list[str],
    ip: str | None = None,
) -> UserAccess:
    """Foydalanuvchining huquqlarini toʻliq almashtiradi.

    Toʻliq roʻyxat beriladi (qoʻshish/olib tashlash emas) — interfeysda
    katakchalar boʻladi va "qaysi biri yoqilgan" holati bitta soʻrovda
    saqlanadi.

    Ikki qatʼiy chegara:
      · super administratorga huquq berilmaydi — u allaqachon hammasiga
        ega, yozuv qoʻshish faqat chalgʻitardi;
      · `permissions.grant` ni faqat super administrator bera oladi,
        aks holda huquqi bor odam oʻziga teng odam yaratib, cheklovni
        butunlay aylanib oʻtardi.
    """
    await _assert_can_manage(session, actor)
    user = await _load_user(session, user_id)

    if RoleName.SUPERADMIN.value in set(user.role_names):
        raise ValidationError("Super administratorga huquq berilmaydi — u hammasiga ega.")

    barcha = {p.value for p in Permission}
    nomalum = set(wanted) - barcha
    if nomalum:
        raise ValidationError(f"Nomaʼlum huquq: {', '.join(sorted(nomalum))}")

    if Permission.PERMISSIONS_GRANT.value in wanted and not permissions.is_superadmin(actor):
        raise PermissionDeniedError("Huquq berish imkonini faqat super administrator bera oladi.")

    hozirgi = await permissions.granted_permissions(session, user.id)
    kerakli = set(wanted)

    qoshiladi = kerakli - hozirgi
    olinadi = hozirgi - kerakli
    if not qoshiladi and not olinadi:
        return await get_access(session, user_id)

    for nom in qoshiladi:
        await permissions.grant(
            session, target_user_id=user.id, permission=Permission(nom), granted_by=actor
        )
    for nom in olinadi:
        await permissions.revoke(session, target_user_id=user.id, permission=Permission(nom))

    audit_service.record(
        session,
        object_type="user_access",
        object_id=user.id,
        action=AuditAction.UPDATE,
        old={"permissions": sorted(hozirgi)},
        new={"permissions": sorted(kerakli)},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return await get_access(session, user_id)


def _assert_superadmin(actor: CurrentUser) -> None:
    """Parol va arxiv — KUCHLI amallar, faqat super administrator uchun.

    `_assert_can_manage` dan ataylab foydalanilmaydi: u `permissions.grant`
    huquqi bor administratorga ham yoʻl qoʻyadi. Boshqaning parolini
    almashtira oladigan odam esa istalgan hisobni (superadminnikidan
    tashqari) egallab oladi — bunday kuch huquq orqali berilmaydi.
    """
    if not permissions.is_superadmin(actor):
        raise PermissionDeniedError("Bu amal uchun ruxsatingiz yoʻq.")


async def set_password(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    new_password: str | None = None,
    ip: str | None = None,
) -> tuple[str, str]:
    """Super administrator foydalanuvchiga yangi parol oʻrnatadi.

    Qaytaradi: `(login, yangi parol)`. Parol FAQAT shu javobda bir marta
    koʻrinadi — hech qayerda saqlanmaydi, auditga ham tushmaydi (X-10).

    `new_password=None` — server oʻzi 10 belgili oʻqishga oson parol
    yasaydi. `must_change_password` ga TEGILMAYDI — u loyihada
    oʻchirilgan (DECISIONS.md, 2026-09-02).
    """
    _assert_superadmin(actor)
    user = await _load_user(session, user_id)

    if new_password is not None:
        validate_new_password(new_password)
        parol = new_password
    else:
        parol = generate_readable_password()

    user.password_hash = hash_password(parol)

    # AUT-08 ruhida: parol oʻzgardi — barcha qurilmalardagi sessiya oʻladi.
    # Hisob egallangan boʻlsa oʻgʻrining refresh tokeni ishlamasin.
    await user_service.revoke_all_sessions(session, user.id, reason="password_set_by_admin")

    # Auditga faqat FAKT yoziladi — eski/yangi qiymatsiz (X-10).
    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UPDATE,
        new={"password_set_by_superadmin": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return user.login, parol


async def archive_user(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    ip: str | None = None,
) -> UserAccess:
    """Hisobni arxivlaydi. Oʻchirish yoʻq (CLAUDE.md 1-qoida).

    Arxivlangan odam login qila olmaydi (`auth_service.authenticate`
    tekshiradi) va faol sessiyalari shu yerning oʻzida bekor qilinadi —
    aks holda 30 kunlik refresh token bilan ishlashda davom etardi.
    """
    _assert_superadmin(actor)

    if user_id == actor.id:
        # Superadmin oʻzini arxivlab, tizimni egasiz qoldirmasin.
        raise ConflictError("Oʻz hisobingizni arxivlab boʻlmaysiz.")

    user = await _load_user(session, user_id)

    if RoleName.SUPERADMIN.value in set(user.role_names):
        raise ConflictError("Boshqa super administratorni arxivlab boʻlmaydi.")

    if user.is_archived:
        return await get_access(session, user_id)

    user.is_archived = True
    user.archived_at = utcnow()
    user.is_active = False

    await user_service.revoke_all_sessions(session, user.id, reason="archived")

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
    await session.commit()
    return await get_access(session, user_id)


async def unarchive_user(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    user_id: uuid.UUID,
    ip: str | None = None,
) -> UserAccess:
    """Hisobni arxivdan chiqaradi — odam yana kira oladi.

    Parol oʻzgarmaydi: arxivlash sessiyalarni bekor qilgan, shuning
    uchun odam eski paroli bilan qaytadan kiradi.
    """
    _assert_superadmin(actor)
    user = await _load_user(session, user_id)

    if not user.is_archived:
        return await get_access(session, user_id)

    user.is_archived = False
    user.archived_at = None
    user.is_active = True

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.UNARCHIVE,
        old={"is_archived": True},
        new={"is_archived": False},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return await get_access(session, user_id)


async def list_users(
    session: AsyncSession, *, actor: CurrentUser, query: str | None = None, limit: int = 100
) -> list[UserAccess]:
    """Huquq berish uchun foydalanuvchilar roʻyxati.

    Bu ADMINISTRATIV roʻyxat: telefon va pochta ham koʻrinadi, chunki
    super administrator toʻgʻri odamni tanlayotganini bilishi kerak
    (X-6 roʻyxatlarga tegishli, bu esa huquq boshqaruvi ekrani).
    Arxivlangan hisoblar ham koʻrsatiladi — huquqi qolib ketmasin.
    """
    await _assert_can_manage(session, actor)

    stmt = select(User).options(selectinload(User.roles)).order_by(User.last_name, User.first_name)
    if query:
        naqsh = f"%{query.strip().lower()}%"
        stmt = stmt.where(
            User.login.ilike(naqsh) | User.last_name.ilike(naqsh) | User.first_name.ilike(naqsh)
        )
    rows = (await session.execute(stmt.limit(limit))).scalars().all()

    natija = []
    for user in rows:
        roles = set(user.role_names)
        berilgan = await permissions.granted_permissions(session, user.id)
        natija.append(
            UserAccess(
                user=user,
                roles=sorted(roles),
                cabinet=cabinet_of(roles),
                sections=effective_sections(roles, user.section_overrides),
                default_sections=role_default_sections(roles),
                customized=user.section_overrides is not None,
                permissions=(
                    sorted(p.value for p in Permission)
                    if RoleName.SUPERADMIN.value in roles
                    else sorted(berilgan)
                ),
            )
        )
    return natija
