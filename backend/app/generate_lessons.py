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
from app.core.timeutil import combine_local
from app.models import AuditAction, Lesson, RoleName, Term, User
from app.services import academic_service, audit_service, lesson_service
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


async def vaqtlarni_yangila(session: AsyncSession, actor: CurrentUser, year_id) -> None:
    """Dars boshlanish/tugash vaqtini qoʻngʻiroqlar jadvalidan qayta hisoblaydi.

    Qoʻngʻiroqlar jadvali oʻzgarsa mavjud darslar ESKI vaqtda qolib
    ketadi — `generate` idempotent boʻlgani uchun ularni qayta
    yaratmaydi. Bu esa sezilmaydi: jadvalda yangi vaqt, darsda eski.
    Davomat oynasi (DAV-03) dars TUGASHIDAN hisoblanadi, ya'ni farq
    ustozning tahrirlash muddatiga ham taʼsir qiladi.

    Dars oʻzgarmaydi — faqat vaqti toʻgʻrilanadi. Har oʻzgarish audit'ga
    tushadi.
    """
    qongiroq = {b.period: b for b in await academic_service.list_bells(session, year_id)}
    darslar = list(
        (
            await session.execute(
                select(Lesson).where(Lesson.is_archived.is_(False))
            )
        ).scalars()
    )

    ozgardi, parasiz = 0, set()
    for dars in darslar:
        bell = qongiroq.get(dars.period)
        if bell is None:
            parasiz.add(dars.period)
            continue
        boshi = combine_local(dars.lesson_date, bell.starts_at)
        oxiri = combine_local(dars.lesson_date, bell.ends_at)
        if dars.starts_at == boshi and dars.ends_at == oxiri:
            continue
        audit_service.record(
            session,
            object_type="lesson",
            object_id=dars.id,
            action=AuditAction.UPDATE,
            old={"starts_at": dars.starts_at.isoformat(), "ends_at": dars.ends_at.isoformat()},
            new={"starts_at": boshi.isoformat(), "ends_at": oxiri.isoformat()},
            actor_id=actor.id,
        )
        dars.starts_at = boshi
        dars.ends_at = oxiri
        ozgardi += 1

    await session.commit()
    print(f"Vaqti toʻgʻrilandi: {ozgardi} dars ({len(darslar)} tadan)")
    if parasiz:
        print(f"  ⚠ qoʻngʻiroqlar jadvalida yoʻq para: {sorted(parasiz)}")


async def main() -> None:
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Chorak darslarini yaratadi")
    parser.add_argument("--actor", required=True)
    parser.add_argument("--term", type=int, help="chorak tartibi: 1, 2, 3, 4")
    parser.add_argument("--all", action="store_true", help="joriy yilning hamma choragi")
    parser.add_argument(
        "--refresh-times",
        action="store_true",
        help="qoʻngʻiroqlar jadvali oʻzgargan boʻlsa dars vaqtlarini qayta hisoblaydi",
    )
    args = parser.parse_args()

    if not args.term and not args.all and not args.refresh_times:
        raise SystemExit("--term, --all yoki --refresh-times koʻrsating.")

    async with SessionFactory() as session:
        actor = await actor_ol(session, args.actor)
        year = await academic_service.current_year(session)
        if year is None:
            raise SystemExit("Joriy oʻquv yili belgilanmagan.")

        if args.refresh_times:
            await vaqtlarni_yangila(session, actor, year.id)
            if not args.term and not args.all:
                await engine.dispose()
                return

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
