"""Chorak uchun jadvaldan konkret darslarni yaratadi (T-012).

Interfeysda bu tugma bor (`/admin/baza` → Kalendar), lekin oʻquv yili
boshida uni bosadigan hisob hali sozlanmagan boʻlishi mumkin. Shu sabab
xuddi shu amalning buyruq koʻrinishi.

Ishlatish:

    uv run python -m app.generate_lessons --actor super.admin --term 1
    uv run python -m app.generate_lessons --actor super.admin --all

Idempotent: mavjud dars qayta yaratilmaydi. Jadval keyin oʻzgarsa ham
oʻtgan darslardagi davomat buzilmaydi.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import SessionFactory, engine
from app.models import RoleName, Term, User
from app.services import academic_service, lesson_service
from app.services.access import CurrentUser


async def actor_ol(session: AsyncSession, login: str) -> CurrentUser:
    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.login == login)
    )
    if user is None:
        raise SystemExit(f"`{login}` hisobi topilmadi.")
    if RoleName.SUPERADMIN.value not in user.role_names:
        raise SystemExit(f"`{login}` superadministrator emas.")
    return CurrentUser.from_model(user)


async def main() -> None:
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Chorak darslarini yaratadi")
    parser.add_argument("--actor", required=True)
    parser.add_argument("--term", type=int, help="chorak tartibi: 1, 2, 3, 4")
    parser.add_argument("--all", action="store_true", help="joriy yilning hamma choragi")
    args = parser.parse_args()

    if not args.term and not args.all:
        raise SystemExit("--term yoki --all koʻrsating.")

    async with SessionFactory() as session:
        actor = await actor_ol(session, args.actor)
        year = await academic_service.current_year(session)
        if year is None:
            raise SystemExit("Joriy oʻquv yili belgilanmagan.")

        stmt = select(Term).where(
            Term.academic_year_id == year.id, Term.is_archived.is_(False)
        )
        if args.term:
            stmt = stmt.where(Term.index == args.term)
        choraklar = list((await session.execute(stmt.order_by(Term.index))).scalars())
        if not choraklar:
            raise SystemExit("Chorak topilmadi.")

        for term in choraklar:
            natija = await lesson_service.generate_term(
                session, actor=actor, term_id=term.id
            )
            print(
                f"{term.name} ({term.starts_on} → {term.ends_on}): "
                f"{natija.created} yangi, {natija.skipped_existing} bor edi, "
                f"{natija.skipped_holidays} taʼtil kuni"
            )
            if natija.missing_bells:
                print(
                    "  ⚠ qoʻngʻiroqlar jadvalida yoʻq para: "
                    + ", ".join(str(x) for x in natija.missing_bells)
                    + " — bu paralardagi darslar yaratilmadi"
                )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
