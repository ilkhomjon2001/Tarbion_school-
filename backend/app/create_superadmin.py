"""Birinchi super administratorni yaratadi.

Tizimda **oʻz-oʻzidan roʻyxatdan oʻtish yoʻq** — hisobni faqat huquqi bor
administrator ochadi. Demak birinchi hisob qandaydir yoʻl bilan paydo
boʻlishi kerak: shu buyruq oʻsha "tuxum va tovuq" masalasini yechadi.

Ishlatish:

    uv run python -m app.create_superadmin --last Karimov --first Ikrom

Parol koʻrsatilmasa kuchli tasodifiy parol yasaladi va EKRANGA BIR
MARTA chiqadi. Bazada faqat argon2 xeshi qoladi — parolni tiklab
boʻlmaydi, faqat qayta tayinlash mumkin.

Demo/sinov uchun parolni qoʻlda berish mumkin:

    uv run python -m app.create_superadmin --last Karimov --first Ikrom \
        --password 'Tarbion2026!'

Hisob allaqachon boʻlsa qayta yaratilmaydi — `--reset-password` bilan
faqat paroli yangilanadi.
"""

import argparse
import asyncio
import secrets
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import SessionFactory, engine
from app.core.naming import build_login
from app.core.security import hash_password
from app.models import AuditAction, Role, RoleName, User, UserRole
from app.services import audit_service


def strong_password() -> str:
    """20 belgili tasodifiy parol.

    Superadministrator butun bazani koʻradi — unga 5 xonali boshlangʻich
    parol berilmaydi (`docs/XAVFSIZLIK.md`, 2-boʻlim).
    """
    return secrets.token_urlsafe(15)


async def ensure_superadmin(
    session: AsyncSession, *, last: str, first: str, password: str, reset: bool
) -> tuple[User, str | None]:
    """Superadmin hisobini yaratadi yoki topadi.

    Qaytaradi: (foydalanuvchi, koʻrsatiladigan parol yoki None).
    """
    role = await session.scalar(select(Role).where(Role.name == RoleName.SUPERADMIN.value))
    if role is None:
        raise SystemExit(
            "`superadmin` roli topilmadi. Avval migratsiyani qoʻllang: uv run alembic upgrade head"
        )

    login = build_login(last, first)
    mavjud = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.login == login)
    )

    if mavjud is not None:
        if not reset:
            return mavjud, None
        mavjud.password_hash = hash_password(password)
        mavjud.must_change_password = False
        mavjud.is_active = True
        mavjud.is_archived = False
        audit_service.record(
            session,
            object_type="user",
            object_id=mavjud.id,
            action=AuditAction.UPDATE,
            new={"password_reset": True, "by": "create_superadmin"},
            actor_id=mavjud.id,
        )
        await session.commit()
        return mavjud, password

    user = User(
        login=login,
        password_hash=hash_password(password),
        last_name=last.strip(),
        first_name=first.strip(),
        # Parol shu yerda beriladi va bir marta koʻrsatiladi — 5 xonali
        # vaqtinchalik parol emas, shuning uchun majburiy almashtirish yoʻq.
        must_change_password=False,
    )
    session.add(user)
    await session.flush()
    session.add(UserRole(user_id=user.id, role_id=role.id))

    audit_service.record(
        session,
        object_type="user",
        object_id=user.id,
        action=AuditAction.CREATE,
        new={"login": login, "roles": [RoleName.SUPERADMIN.value], "by": "create_superadmin"},
        actor_id=user.id,
    )
    await session.commit()
    return user, password


async def main() -> None:
    # Windows konsoli sukut boʻyicha cp1251 — `ʻ` chiqarilganda skript
    # UnicodeEncodeError bilan yiqiladi.
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Super administrator hisobini yaratadi")
    parser.add_argument("--last", required=True, help="Familiya")
    parser.add_argument("--first", required=True, help="Ism")
    parser.add_argument("--password", help="Parol. Berilmasa tasodifiy yasaladi")
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="Hisob mavjud boʻlsa parolini yangilash",
    )
    args = parser.parse_args()

    parol = args.password or strong_password()

    async with SessionFactory() as session:
        user, korsatiladigan = await ensure_superadmin(
            session,
            last=args.last,
            first=args.first,
            password=parol,
            reset=args.reset_password,
        )

    print()
    if korsatiladigan is None:
        print(f"Hisob allaqachon mavjud: {user.login}")
        print("Parolni yangilash uchun: --reset-password")
    else:
        print("Super administrator tayyor.")
        print(f"  login:  {user.login}")
        print(f"  parol:  {korsatiladigan}")
        print()
        print("Parol bazada xesh sifatida saqlanadi — bu oxirgi marta koʻrinishi.")
        print("Yozib oling yoki hoziroq kirib almashtiring.")
    print()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
