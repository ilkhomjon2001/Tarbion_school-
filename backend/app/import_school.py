"""Maktabning haqiqiy maʼlumotini Excel'dan yuklaydi.

Bu `seed.py` EMAS: seed demo yasaydi, bu esa maktab bergan roʻyxatni
oʻzgartirmasdan kiritadi. Ishlab chiqarishda ham ishlaydi — chunki hech
narsani oʻchirmaydi, faqat qoʻshadi.

Ishlatish:

    uv run python -m app.import_school --actor karimov.ikrom \\
        --teachers "../maxfiy/Oʻqituvchilar.xlsx" \\
        --students "../maxfiy/Oʻquvchilar.xlsx"

`--actor` — superadministrator login'i. Hamma yozuv oʻsha hisob nomidan
`audit_log` ga tushadi: keyin «bu oʻquvchini kim kiritgan» degan savolga
javob boʻladi (CLAUDE.md 4-qoida).

TAKROR ISHGA TUSHIRISH XAVFSIZ. Har bosqich avval bazani tekshiradi:
mavjud sinf, ustoz yoki oʻquvchi ustidan ikkinchi marta yozilmaydi.
Shu sabab roʻyxat toʻldirilsa, faylni yangilab qayta yugurtirish yetadi.

Yangi ochilgan hisoblarning boshlangʻich paroli ekranga BIR MARTA
chiqadi — bazada faqat argon2 xeshi qoladi.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
import uuid
import zipfile
from dataclasses import dataclass
from datetime import time
from pathlib import Path
from xml.etree import ElementTree as ET

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db import SessionFactory, engine
from app.models import (
    AcademicYear,
    BellSchedule,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    User,
)
from app.services import academic_service, reference_service, school_service
from app.services.access import CurrentUser

# ───────────────────────── Maktab hujjatidan ─────────────────────────
#
# Quyidagilar «Tarbion» xususiy maktabining 2026-2027 oʻquv yili dars
# jadvali varagʻidan olingan. Excel'da yoʻq, shu sabab shu yerda turadi.

YEAR_NAME = "2026-2027"
YEAR_STARTS = "2026-09-02"
YEAR_ENDS = "2027-05-25"

#: Para vaqtlari. 4-para jadval varagʻida `10³⁵-11⁴⁰` deb yozilgan —
#: qolgan paralar 45 daqiqadan boʻlgani uchun bu gumonli, lekin
#: hujjatdagidek olindi. Tekshirib, kerak boʻlsa `/admin/baza` →
#: Kalendar boʻlimida tuzatiladi.
BELLS: list[tuple[int, str, str]] = [
    (1, "08:00", "08:45"),
    (2, "08:50", "09:35"),
    (3, "09:40", "10:25"),
    (4, "10:35", "11:40"),
    (5, "11:45", "12:30"),
    (6, "13:30", "14:15"),
    (7, "14:20", "15:05"),
    (8, "15:10", "15:55"),
]

#: Sinf belgisi → maktab bergan atama. Sinf rahbari bu yerda EMAS —
#: u ustozlar faylidagi «Sinfi» ustunidan olinadi, ikki manba
#: bir-biriga zid boʻlib qolmasin.
CLASS_TITLES: dict[str, str] = {
    "0-SINF": "Mirzo Ulugʻbek",
    "1-A": "Al-Xorazmiy",
    "1-B": "Al-Buxoriy",
    "2-A": "Al-Beruniy",
    "2-B": "Abu Ali Ibn Sino",
    "3-A": "Al-Fargʻoniy",
    "3-B": "Alisher Navoiy",
    "4-A": "Al-Farobiy",
}


# ───────────────────────── Matnni tozalash ─────────────────────────

#: Kirill harflari lotinchaga oʻxshab koʻrinadi va faylga sezdirmasdan
#: kirib qoladi («Xolmаhammatov» dagi `а` — U+0430). Bunday nom
#: qidiruvda topilmaydi, shuning uchun almashtiriladi.
_KIRIL_KOʻRINISH = {
    "а": "a", "е": "e", "о": "o", "р": "r", "с": "s", "х": "x", "у": "y",
    "А": "A", "Е": "E", "О": "O", "Р": "R", "С": "S", "Х": "X", "У": "Y",
    "і": "i", "ѕ": "s",
}


def toza(matn: str) -> str:
    """Apostrofni va yashirin kirill harflarini toʻgʻrilaydi.

    Oʻzbek lotinchasida ikki xil belgi bor va ular boshqa-boshqa:
    `oʻ`/`gʻ` da — U+02BB (toʻntarilgan vergul), tutuq belgisida
    (`sanʼat`, `eʼzoz`) — U+02BC. Faylda ikkalasi ham oddiy `'` boʻlib
    keladi; farqni oldingi harfdan bilib olamiz.

    Nega muhim: `o'qish` va `oʻqish` — brauzer uchun ikki xil soʻz.
    Aralashsa qidiruv ishlamaydi (CLAUDE.md 8-qoida).
    """
    natija = "".join(_KIRIL_KOʻRINISH.get(ch, ch) for ch in matn.strip())
    natija = re.sub(r"[Oo]['’‘`]", lambda m: m.group(0)[0] + "ʻ", natija)
    natija = re.sub(r"[Gg]['’‘`]", lambda m: m.group(0)[0] + "ʻ", natija)
    natija = re.sub(r"['’‘`]", "ʼ", natija)
    return re.sub(r"\s+", " ", natija)


def ism_boʻl(fish: str) -> tuple[str, str, str | None]:
    """`Familiya Ism [otasining ismi]` → uch qism.

    Uchinchi soʻzdan keyingisi otasining ismiga qoʻshiladi:
    «Sobirjonov Yahyobek Saydullo oʻgʻli» → (Sobirjonov, Yahyobek,
    «Saydullo oʻgʻli»).
    """
    qism = toza(fish).split()
    if len(qism) < 2:
        raise ValueError(f"Ism-familiya toʻliq emas: {fish!r}")
    return qism[0], qism[1], " ".join(qism[2:]) or None


# ───────────────────────── xlsx oʻqish ─────────────────────────
#
# `openpyxl` qoʻshilmadi: bu yerda kerak boʻlgani — matn kataklarini
# oʻqish, u esa 40 qatorga sigʻadi. Yangi bogʻliqlik `docs/DECISIONS.md`
# ga yozilishi va jamoada kelishilishi kerak boʻlardi.

# S314: `defusedxml` qoʻshilmadi. Bu server endpointi emas — qoʻlda
# ishga tushiriladigan buyruq va fayl maktab qoʻlidan keladi. Yangi
# bogʻliqlik esa jamoada kelishuvni talab qilardi (CLAUDE.md).
_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _ustun(ref: str) -> int:
    harflar = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in harflar:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def varaqlar(path: Path) -> list[tuple[str, list[list[str]]]]:
    """xlsx → [(varaq nomi, qatorlar)]. Faqat matn qiymatlari."""
    z = zipfile.ZipFile(path)

    umumiy: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))  # noqa: S314
        for si in root.findall(f"{_NS}si"):
            umumiy.append("".join(t.text or "" for t in si.iter(f"{_NS}t")))

    wb = ET.fromstring(z.read("xl/workbook.xml"))  # noqa: S314
    nomlar = [sh.get("name") for sh in wb.iter(f"{_NS}sheet")]

    natija = []
    for i, nom in enumerate(nomlar, start=1):
        fayl = f"xl/worksheets/sheet{i}.xml"
        if fayl not in z.namelist():
            continue
        qatorlar = []
        sheet = ET.fromstring(z.read(fayl))  # noqa: S314
        for r in sheet.iter(f"{_NS}row"):
            kataklar: dict[int, str] = {}
            for c in r.findall(f"{_NS}c"):
                t, v = c.get("t"), c.find(f"{_NS}v")
                if t == "inlineStr":
                    isn = c.find(f"{_NS}is")
                    qiymat = (
                        "".join(x.text or "" for x in isn.iter(f"{_NS}t"))
                        if isn is not None
                        else ""
                    )
                elif v is None:
                    continue
                elif t == "s":
                    qiymat = umumiy[int(v.text)]
                else:
                    qiymat = v.text or ""
                if qiymat.strip():
                    kataklar[_ustun(c.get("r"))] = qiymat.strip()
            if kataklar:
                qatorlar.append([kataklar.get(j, "") for j in range(max(kataklar) + 1)])
        natija.append((nom, qatorlar))
    return natija


# ───────────────────────── Fayllardan oʻqish ─────────────────────────


@dataclass(frozen=True, slots=True)
class UstozQator:
    last: str
    first: str
    middle: str | None
    subject: str
    #: «1-A sinf» → «1-A». Sinf rahbari boʻlmasa `None`.
    class_name: str | None


@dataclass(frozen=True, slots=True)
class OquvchiQator:
    last: str
    first: str
    middle: str | None
    class_name: str


def sinf_belgisi(matn: str) -> str:
    """«1-A sinf», «0-sinf» → «1-A», «0-SINF».

    Sinf nomini server katta harfga oʻgiradi, shu sabab bu yerda ham
    shunday qaytariladi — solishtirish bir xil boʻlsin.
    """
    t = toza(matn).upper().replace(" SINF", "").replace("-SINF", "-SINF").strip()
    if t in {"0", "0-SINF"}:
        return "0-SINF"
    return t


def ustozlarni_oqi(path: Path) -> list[UstozQator]:
    _, qatorlar = varaqlar(path)[0]
    natija = []
    for r in qatorlar:
        # Sarlavha qatorlarini oʻtkazamiz: 2-ustunda FISH, 3-da fan.
        if len(r) < 3 or not r[1] or not r[2] or r[1].startswith("O"):
            if len(r) < 3 or "FISH" in r[1].upper():
                continue
        if len(r) < 3 or not r[1] or not r[2]:
            continue
        last, first, middle = ism_boʻl(r[1])
        sinf = sinf_belgisi(r[3]) if len(r) > 3 and r[3] else None
        natija.append(UstozQator(last, first, middle, toza(r[2]), sinf))
    return natija


def oquvchilarni_oqi(path: Path) -> list[OquvchiQator]:
    natija = []
    for varaq, qatorlar in varaqlar(path):
        sinf = sinf_belgisi(varaq)
        for r in qatorlar[2:]:
            if len(r) < 2 or not r[1]:
                continue
            last, first, middle = ism_boʻl(r[1])
            natija.append(OquvchiQator(last, first, middle, sinf))
    return natija


# ───────────────────────── Yuklash bosqichlari ─────────────────────────


async def actor_ol(session: AsyncSession, login: str) -> CurrentUser:
    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.login == login)
    )
    if user is None:
        raise SystemExit(f"`{login}` hisobi topilmadi.")
    if RoleName.SUPERADMIN.value not in user.role_names:
        raise SystemExit(
            f"`{login}` superadministrator emas. Import barcha huquqni talab qiladi — "
            "avval `uv run python -m app.create_superadmin` bilan hisob oching."
        )
    return CurrentUser.from_model(user)


async def yil_taminla(session: AsyncSession, actor: CurrentUser) -> AcademicYear:
    joriy = await academic_service.current_year(session)
    if joriy is not None:
        print(f"  oʻquv yili: {joriy.name} (mavjud)")
        return joriy
    from datetime import date

    yil = await academic_service.create_year(
        session,
        actor=actor,
        name=YEAR_NAME,
        starts_on=date.fromisoformat(YEAR_STARTS),
        ends_on=date.fromisoformat(YEAR_ENDS),
        make_current=True,
    )
    print(f"  oʻquv yili: {yil.name} (yaratildi)")
    return yil


async def qongiroq_taminla(session: AsyncSession, year: AcademicYear) -> None:
    bor = await session.scalar(
        select(BellSchedule).where(
            BellSchedule.academic_year_id == year.id, BellSchedule.is_archived.is_(False)
        )
    )
    if bor is not None:
        print("  qoʻngʻiroqlar: mavjud, tegilmadi")
        return
    for period, boshi, oxiri in BELLS:
        session.add(
            BellSchedule(
                academic_year_id=year.id,
                period=period,
                starts_at=time.fromisoformat(boshi),
                ends_at=time.fromisoformat(oxiri),
            )
        )
    await session.commit()
    print(f"  qoʻngʻiroqlar: {len(BELLS)} para yaratildi")


async def fanlar_taminla(
    session: AsyncSession, actor: CurrentUser, nomlar: set[str]
) -> dict[str, uuid.UUID]:
    mavjud = {
        s.name: s.id
        for s in (await session.execute(select(Subject))).scalars()
    }
    yangi = 0
    for nom in sorted(nomlar):
        if nom in mavjud:
            continue
        fan = await reference_service.create_subject(session, actor=actor, name=nom)
        mavjud[nom] = fan.id
        yangi += 1
    print(f"  fanlar: {yangi} yangi, jami {len(mavjud)}")
    return mavjud


async def ustozlar_yukla(
    session: AsyncSession,
    actor: CurrentUser,
    qatorlar: list[UstozQator],
    fanlar: dict[str, uuid.UUID],
) -> tuple[dict[str, uuid.UUID], list[tuple[str, str, str]]]:
    """Ustozlarni ochadi. Qaytaradi: {«Familiya Ism»: user_id} va yangi hisoblar."""
    mavjud: dict[str, uuid.UUID] = {}
    for u in (await session.execute(select(User))).scalars():
        mavjud[f"{u.last_name} {u.first_name}"] = u.id

    yangilar: list[tuple[str, str, str]] = []
    natija: dict[str, uuid.UUID] = {}

    for q in qatorlar:
        kalit = f"{q.last} {q.first}"
        if kalit in mavjud:
            natija[kalit] = mavjud[kalit]
            continue
        yaratildi = await school_service.create_staff(
            session,
            actor=actor,
            last_name=q.last,
            first_name=q.first,
            middle_name=q.middle,
            roles=[RoleName.TEACHER.value],
            subject_ids=[fanlar[q.subject]] if q.subject in fanlar else [],
        )
        natija[kalit] = yaratildi.user.id
        mavjud[kalit] = yaratildi.user.id
        yangilar.append((kalit, yaratildi.user.login, yaratildi.initial_password))

    print(f"  ustozlar: {len(yangilar)} yangi, jami {len(natija)}")
    return natija, yangilar


async def sinflar_yukla(
    session: AsyncSession,
    actor: CurrentUser,
    year: AcademicYear,
    rahbarlar: dict[str, str],
    ustozlar: dict[str, uuid.UUID],
) -> dict[str, uuid.UUID]:
    """Sinflarni ochadi. `rahbarlar` — {sinf belgisi: «Familiya Ism»}."""
    mavjud = {
        c.name: c.id
        for c in (
            await session.execute(
                select(SchoolClass).where(SchoolClass.academic_year_id == year.id)
            )
        ).scalars()
    }
    yangi = 0
    for belgi, atama in CLASS_TITLES.items():
        if belgi in mavjud:
            continue
        rahbar = rahbarlar.get(belgi)
        cls = await reference_service.create_class(
            session,
            actor=actor,
            name=belgi,
            title=atama,
            homeroom_teacher_id=ustozlar.get(rahbar) if rahbar else None,
        )
        mavjud[belgi] = cls.id
        yangi += 1
    print(f"  sinflar: {yangi} yangi, jami {len(mavjud)}")
    return mavjud


async def oquvchilar_yukla(
    session: AsyncSession,
    actor: CurrentUser,
    qatorlar: list[OquvchiQator],
    sinflar: dict[str, uuid.UUID],
) -> None:
    mavjud = {
        f"{s.last_name} {s.first_name}"
        for s in (await session.execute(select(Student))).scalars()
    }
    yangi = 0
    notopilgan: set[str] = set()
    for q in qatorlar:
        if f"{q.last} {q.first}" in mavjud:
            continue
        class_id = sinflar.get(q.class_name)
        if class_id is None:
            notopilgan.add(q.class_name)
            continue
        await school_service.create_student(
            session,
            actor=actor,
            last_name=q.last,
            first_name=q.first,
            middle_name=q.middle,
            class_id=class_id,
        )
        yangi += 1
    print(f"  oʻquvchilar: {yangi} yangi, jami {len(mavjud) + yangi}")
    if notopilgan:
        print(f"  ⚠ sinfi topilmadi, oʻtkazib yuborildi: {sorted(notopilgan)}")


# ───────────────────────── Boshqaruv ─────────────────────────


async def main() -> None:
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Maktab maʼlumotini Excel'dan yuklaydi")
    parser.add_argument("--actor", required=True, help="superadministrator login'i")
    parser.add_argument("--teachers", required=True, type=Path)
    parser.add_argument("--students", required=True, type=Path)
    args = parser.parse_args()

    for p in (args.teachers, args.students):
        if not p.exists():
            raise SystemExit(f"{p} topilmadi.")

    ustoz_qatorlar = ustozlarni_oqi(args.teachers)
    oquvchi_qatorlar = oquvchilarni_oqi(args.students)
    print(f"Fayllardan oʻqildi: {len(ustoz_qatorlar)} ustoz, {len(oquvchi_qatorlar)} oʻquvchi\n")

    rahbarlar = {q.class_name: f"{q.last} {q.first}" for q in ustoz_qatorlar if q.class_name}

    async with SessionFactory() as session:
        actor = await actor_ol(session, args.actor)
        print(f"Kiritayotgan: {actor.full_name} ({actor.login})\n")

        year = await yil_taminla(session, actor)
        await qongiroq_taminla(session, year)
        fanlar = await fanlar_taminla(session, actor, {q.subject for q in ustoz_qatorlar})
        ustozlar, yangi_hisoblar = await ustozlar_yukla(
            session, actor, ustoz_qatorlar, fanlar
        )
        sinflar = await sinflar_yukla(session, actor, year, rahbarlar, ustozlar)
        await oquvchilar_yukla(session, actor, oquvchi_qatorlar, sinflar)

    await engine.dispose()

    if yangi_hisoblar:
        print("\n" + "═" * 62)
        print("YANGI HISOBLAR — parol FAQAT SHU YERDA koʻrinadi")
        print("═" * 62)
        for ism, login, parol in yangi_hisoblar:
            print(f"  {ism:28} {login:24} {parol}")
        print("═" * 62)
        print("Roʻyxatni egalariga yetkazing va bu chiqishni saqlab qoʻymang.")

    print("\nTayyor.")


if __name__ == "__main__":
    asyncio.run(main())
