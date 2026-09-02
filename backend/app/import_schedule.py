"""Haftalik dars jadvalini yuklaydi (ADM-08).

Manba — maktabning 2026-2027 oʻquv yili «DARS JADVALI» varagʻi. Excel
yoʻq, faqat bosma jadval boʻlgani uchun katak qiymatlari shu yerda
turadi: 5 kun × 8 para × 8 sinf = 320 yozuv.

Ishlatish:

    uv run python -m app.import_schedule --actor tuxtarov.fazliddin

Takror ishga tushirish xavfsiz: mavjud yozuv qayta yozilmaydi.

Katak yozuvi:
    "Matematika"                 — fan, ustoz sinf rahbari, xona sinfniki
    "Matematika*Madaminov"       — ustoz qavs ichida koʻrsatilgan
    "Gimnastika/robototexnika@Zal/10"  — maxsus joy

Jadval varagʻida «Zal/10» deb yozilgan — bu bitta joy emas, «Zal yoki
10-xona» degani. Bir parada ikki sinf talab qilsa biri Zalga, ikkinchisi
10-xonaga tushadi: bazada bitta xonaga ayni vaqtda ikki sinf qoʻyilmaydi.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import SessionFactory, engine
from app.core.exceptions import ConflictError
from app.models import RoleName, ScheduleEntry, SchoolClass, Subject, User
from app.services import academic_service, reference_service, schedule_service
from app.services.access import CurrentUser

# ───────────────────────── Jadval varagʻidan ─────────────────────────

SINFLAR = ["0-SINF", "1-A", "1-B", "2-A", "2-B", "3-A", "3-B", "4-A"]

#: Sinfning doimiy xonasi — varaqning «Xona» ustuni.
XONA = {
    "0-SINF": "4-xona", "1-A": "6-xona", "1-B": "2-xona", "2-A": "1-xona",
    "2-B": "3-xona", "3-A": "7-xona", "3-B": "8-xona", "4-A": "9-xona",
}

#: «Zal/10» — ikki joy. Bir parada ikkinchi sinfga ikkinchisi beriladi.
ZAL = ["Zal", "10-xona"]
Z = "@Zal"

# Jadvalda eng koʻp takrorlanadigan ikki katak — qator sigʻsin.
G = "Gimnastika/robototexnika" + Z
K = "Kurash/robototexnika" + Z

#: Qavs ichidagi qisqa nom → bazadagi «Familiya Ism».
USTOZ_QISQA = {
    "Madaminov": "Madaminov Zaynobiddin",
    "Salimov": "Salimov Bekzod",
    "Fohita": "Madaminova Fohita",
    "Malika": "Xomidova Malika",
    "Xolida": "Mukarramova Xolida",
}

#: Qavsda ism boʻlmagan fanlar uchun mas'ul. Roʻyxat — toʻqnashuvni
#: aylanib oʻtish uchun: bir parada ikki sinfda boʻlsa keyingisi olinadi.
#: Bu yerda YOʻQ fan sinf rahbariga tushadi.
FAN_USTOZI = {
    "Shaxmat": ["Abdullayeva Munojat"],
    "Tarbiya": ["Abdurazzaqova Xurshida"],
    "Gimnastika/robototexnika": [
        "Iskandarov Jasurbek", "Gʻaniyeva Oltinoy", "Tojimaxammatov Ulugʻbek",
    ],
    "Kurash/robototexnika": [
        "Iskandarov Jasurbek", "Gʻaniyeva Oltinoy", "Tojimaxammatov Ulugʻbek",
    ],
}

# Ustunlar tartibi: 0-SINF, 1-A, 1-B, 2-A, 2-B, 3-A, 3-B, 4-A
JADVAL: dict[int, list[list[str]]] = {
    1: [  # ── Dushanba ──
        ["Yozuv", "Sinf soati", "Sinf soati", "Sinf soati",
         "Ingliz tili*Xolida", "Sinf soati", "Sinf soati", "Sinf soati"],
        ["Alifbe", "Matematika", "Matematika", "Matematika",
         "Matematika", "Ingliz tili*Xolida", "Matematika", "Matematika*Salimov"],
        ["Matematika", "Matematika*Madaminov", "Ona tili", "Ona tili",
         "Ona tili", "Tarbiya", "Ingliz tili*Fohita", "Matematika*Salimov"],
        ["Tarbiya", G, "Matematika*Madaminov", "Matematika*Salimov",
         "Oʻqish", "Matematika", "Ingliz tili*Fohita", "Ona tili"],
        ["Musiqa", G, "Informatika", "Uyga vazifa",
         "Matematika*Salimov", "Matematika*Madaminov", "Ona tili", "Ingliz tili*Fohita"],
        ["Matematika", "Informatika", "Uyga vazifa", "Musiqa",
         "Ingliz tili*Xolida", "Uyga vazifa", "Matematika*Madaminov", "Tarbiya"],
        ["Uyga vazifa", "Uyga vazifa", "Musiqa", "Ingliz tili*Xolida",
         "Rus tili", G, G, "Uyga vazifa"],
        ["Uyga vazifa", "Musiqa", "Uyga vazifa", "Ingliz tili*Xolida",
         "Uyga vazifa", G, G, "Uyga vazifa"],
    ],
    2: [  # ── Seshanba ──
        ["Ingliz tili*Malika", "Ona tili", "Ona tili", "Ona tili",
         "Ona tili", "Ona tili", "Ona tili", "Matematika*Salimov"],
        ["Yozuv", "Ingliz tili*Malika", "Matematika", K,
         K, "Matematika*Madaminov", "Matematika", "Matematika*Salimov"],
        ["Alifbe", "Matematika*Madaminov", "Ingliz tili*Malika", K,
         K, "Oʻqish", "Oʻqish", "Ingliz tili*Fohita"],
        ["Matematika", K, "Matematika*Madaminov", "Matematika*Salimov",
         "Matematika", "Matematika", "Ingliz tili*Fohita", "Oʻqish"],
        ["Tabiiy fan", K, "Tarbiya", "Matematika",
         "Matematika*Salimov", "Informatika", "Matematika*Madaminov", "Ingliz tili*Fohita"],
        ["Mental", "Matematika", "Oʻqish", "Ingliz tili*Xolida",
         "Oʻqish", "Uyga vazifa", "Tarbiya", "Shaxmat"],
        ["Mental", "Tasviriy sanʼat", "Uyga vazifa", "Tarbiya",
         "Ingliz tili*Xolida", "Shaxmat", "Uyga vazifa", K],
        ["Uyga vazifa", "Uyga vazifa", "Uyga vazifa", "Uyga vazifa",
         "Uyga vazifa", "Ingliz tili*Xolida", "Shaxmat", K],
    ],
    3: [  # ── Chorshanba ──
        ["Yozuv", "Oʻqish", "Ona tili", "Oʻqish",
         "Ingliz tili*Xolida", "Oʻqish", "Ona tili", "Ona tili"],
        ["Alifbe", "Matematika", "Matematika", "Matematika",
         "Ingliz tili*Xolida", "Matematika", "Tasviriy sanʼat", "Matematika*Salimov"],
        ["Matematika", "Ona tili", G, "Ingliz tili*Xolida",
         "Matematika", "Matematika*Madaminov", "Oʻqish", "Matematika*Salimov"],
        ["Ingliz tili*Malika", "Matematika*Madaminov", G,
         "Matematika*Salimov", "Ona tili", "Ona tili", "Matematika", "Ingliz tili*Fohita"],
        [G, "Tabiiy fan", "Matematika*Madaminov", "Ona tili",
         "Matematika*Salimov", "Tasviriy sanʼat", "Ingliz tili*Fohita", "Oʻqish"],
        ["Texnologiya", "Ingliz tili*Malika", "Tasviriy sanʼat", "Uyga vazifa",
         "Uyga vazifa", "Rus tili", "Matematika*Madaminov", "Informatika"],
        ["Uyga vazifa", "Uyga vazifa", "Ingliz tili*Malika", G,
         G, "Uyga vazifa", "Rus tili", "Uyga vazifa"],
        ["Uyga vazifa", "Uyga vazifa", "Uyga vazifa", G,
         G, "Ingliz tili*Xolida", "Uyga vazifa", "Rus tili"],
    ],
    4: [  # ── Payshanba ──
        ["Yozuv", "Ona tili", "Oʻqish", "Ona tili",
         "Ona tili", "Ingliz tili*Xolida", "Matematika", "Ona tili"],
        ["Alifbe", "Matematika*Madaminov", "Matematika", "Matematika",
         "Matematika", K, K, "Ingliz tili*Fohita"],
        ["Matematika", "Matematika", "Matematika*Madaminov", "Oʻqish",
         "Tasviriy sanʼat", K, K, "Ingliz tili*Fohita"],
        ["Ingliz tili*Malika", "Oʻqish", K, "Shaxmat",
         "Matematika*Salimov", "Matematika*Madaminov", "Ona tili", "Tabiiy fan"],
        ["Shaxmat", "Ingliz tili*Malika", K, "Matematika*Salimov",
         "Musiqa", "Matematika", "Matematika*Madaminov", "Uyga vazifa"],
        ["Uyga vazifa", "Tarbiya", "Ingliz tili*Malika", "Uyga vazifa",
         "Shaxmat", "Ona tili", "Musiqa", "Matematika*Salimov"],
        [K, "Shaxmat", "Uyga vazifa", "Ingliz tili*Xolida",
         "Tarbiya", "Musiqa", "Uyga vazifa", "Matematika*Salimov"],
        [K, "Uyga vazifa", "Shaxmat", "Ingliz tili*Xolida",
         "Uyga vazifa", "Uyga vazifa", "Uyga vazifa", "Musiqa"],
    ],
    5: [  # ── Juma ──
        ["Yozuv", "Matematika", "Ona tili", "Informatika",
         "Ingliz tili*Xolida", "Ona tili", "Matematika", "Ona tili"],
        ["Alifbe", "Oʻqish", "Matematika", "Matematika",
         "Informatika", "Matematika", "Ingliz tili*Fohita", "Matematika*Salimov"],
        ["Matematika", "Matematika*Madaminov", "Oʻqish", "Rus tili",
         "Matematika", "Tabiiy fan", "Ingliz tili*Fohita", "Matematika*Salimov"],
        ["Tasviriy sanʼat", "Ona tili", "Ingliz tili*Malika", "Matematika*Salimov",
         "Oʻqish", "Uyga vazifa", "Matematika*Madaminov", "Rus tili"],
        [G, "Ingliz tili*Malika", "Matematika*Madaminov", "Tabiiy fan",
         "Matematika*Salimov", "Rus tili", "Informatika", "Tasviriy sanʼat"],
        ["Ingliz tili*Malika", "Texnologiya", "Tabiiy fan", "Tasviriy sanʼat",
         "Tabiiy fan", "Matematika*Madaminov", "Rus tili", "Uyga vazifa"],
        ["Mental", "Uyga vazifa", "Texnologiya", "Uyga vazifa",
         "Rus tili", "Ingliz tili*Xolida", "Tabiiy fan", G],
        ["Mental", "Uyga vazifa", "Uyga vazifa", "Rus tili",
         "Uyga vazifa", "Ingliz tili*Xolida", "Uyga vazifa", G],
    ],
}

KUN_NOMI = {1: "Dushanba", 2: "Seshanba", 3: "Chorshanba", 4: "Payshanba", 5: "Juma"}


def katakni_ajrat(katak: str) -> tuple[str, str | None, bool]:
    """`"Fan*Ustoz@Zal"` → (fan, ustoz qisqa nomi, zaldami)."""
    zalda = katak.endswith(Z)
    asos = katak[: -len(Z)] if zalda else katak
    if "*" in asos:
        fan, qisqa = asos.split("*", 1)
        return fan, qisqa, zalda
    return asos, None, zalda


# ───────────────────────── Yuklash ─────────────────────────


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

    parser = argparse.ArgumentParser(description="Haftalik dars jadvalini yuklaydi")
    parser.add_argument("--actor", required=True)
    args = parser.parse_args()

    async with SessionFactory() as session:
        actor = await actor_ol(session, args.actor)
        year = await academic_service.current_year(session)
        if year is None:
            raise SystemExit("Joriy oʻquv yili belgilanmagan.")

        sinflar = {
            c.name: c
            for c in (
                await session.execute(
                    select(SchoolClass).where(SchoolClass.academic_year_id == year.id)
                )
            ).scalars()
        }
        yetishmaydi = [s for s in SINFLAR if s not in sinflar]
        if yetishmaydi:
            raise SystemExit(f"Sinf topilmadi: {', '.join(yetishmaydi)}")

        odamlar = {
            f"{u.last_name} {u.first_name}": u.id
            for u in (await session.execute(select(User))).scalars()
        }
        rahbar = {
            nom: sinflar[nom].homeroom_teacher_id for nom in SINFLAR
        }

        # ── Fanlar ──
        kerakli = {katakni_ajrat(k)[0] for kun in JADVAL.values() for q in kun for k in q}
        mavjud = {s.name: s.id for s in (await session.execute(select(Subject))).scalars()}
        yangi_fan = 0
        for nom in sorted(kerakli):
            if nom not in mavjud:
                fan = await reference_service.create_subject(session, actor=actor, name=nom)
                mavjud[nom] = fan.id
                yangi_fan += 1
        print(f"Fanlar: {yangi_fan} yangi, jami {len(mavjud)}")

        # ── Mavjud yozuvlar ──
        bor = {
            (e.class_id, e.weekday, e.period)
            for e in (
                await session.execute(
                    select(ScheduleEntry).where(
                        ScheduleEntry.academic_year_id == year.id,
                        ScheduleEntry.is_archived.is_(False),
                    )
                )
            ).scalars()
        }

        qoshildi, otkazildi, xatolar = 0, 0, []

        for weekday, paralar in JADVAL.items():
            for p_index, qator in enumerate(paralar):
                period = p_index + 1
                # Shu paradagi band ustozlar va zal navbati.
                band: set[uuid.UUID] = set()
                zal_navbat = 0

                for i, katak in enumerate(qator):
                    sinf_nomi = SINFLAR[i]
                    cls = sinflar[sinf_nomi]
                    if (cls.id, weekday, period) in bor:
                        otkazildi += 1
                        continue

                    fan, qisqa, zalda = katakni_ajrat(katak)

                    if zalda:
                        xona = ZAL[zal_navbat] if zal_navbat < len(ZAL) else None
                        zal_navbat += 1
                    else:
                        xona = XONA[sinf_nomi]

                    # ── Ustoz ──
                    teacher_id: uuid.UUID | None = None
                    if qisqa:
                        teacher_id = odamlar.get(USTOZ_QISQA[qisqa])
                    elif fan in FAN_USTOZI:
                        for nom in FAN_USTOZI[fan]:
                            nomzod = odamlar.get(nom)
                            if nomzod is not None and nomzod not in band:
                                teacher_id = nomzod
                                break
                    if teacher_id is None:
                        # Roʻyxatda yoʻq fan — sinf rahbariga.
                        teacher_id = rahbar[sinf_nomi]
                    if teacher_id is None:
                        xatolar.append(f"{KUN_NOMI[weekday]} {period} {sinf_nomi}: ustoz yoʻq")
                        continue
                    band.add(teacher_id)

                    try:
                        await schedule_service.add_entry(
                            session,
                            actor=actor,
                            class_id=cls.id,
                            subject_id=mavjud[fan],
                            teacher_id=teacher_id,
                            weekday=weekday,
                            period=period,
                            room=xona,
                        )
                        qoshildi += 1
                    except ConflictError as e:
                        xatolar.append(
                            f"{KUN_NOMI[weekday]} {period}-para {sinf_nomi} · {fan}: {e}"
                        )

        print(f"Jadval: {qoshildi} yangi, {otkazildi} allaqachon bor")
        if xatolar:
            print(f"\nToʻqnashuv ({len(xatolar)}):")
            for x in xatolar:
                print("  ", x)
        else:
            print("Toʻqnashuv yoʻq.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
