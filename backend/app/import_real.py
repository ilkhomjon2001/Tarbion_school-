"""Real maʼlumotni Google Sheets eksportidan (xlsx) bazaga yuklash.

Ishlatish (bir martalik, CLI):

    # 1) xlsx → JSON (openpyxl bor muhitda, masalan lokal python):
    #    python scripts/xlsx_to_json.py real_data.xlsx real_data.json
    # 2) uv run python -m app.import_real /yol/real_data.json --wipe --creds /yol/parollar.csv

`--wipe` BUTUN bazani tozalaydi (alembic_version'dan tashqari) — faqat
demo maʼlumot turgan bazada ishlatiladi. Loyiha egasining 2026-09-02
dagi buyrugʻi bilan yozilgan (DECISIONS.md ga qarang).

Nima yaratiladi:
  · rollar, superadmin (tasodifiy parol), admin.test (barcha huquqlar,
    parol seed'dagidek — keyin almashtirish tavsiya etiladi)
  · 2026–2027 oʻquv yili, 4 chorak (taxminiy sanalar — Kalendar'da
    aniqlashtiriladi), qoʻngʻiroqlar jadvali (8 para)
  · fanlar, ustozlar (sinf rahbarlari biriktirilgan), sinflar
  · oʻquvchilar (har biriga hisob), vasiylar (telefon boʻyicha — bir xil
    telefonli aka-ukalar BITTA vasiyga bogʻlanadi)

Barcha yangi hisoblar 5 xonali boshlangʻich parol bilan ochiladi va
parollar FAQAT `--creds` fayliga yoziladi — stdout'ga chiqmaydi (X-10).
Oʻquvchi/vasiy birinchi kirishda parolni majburiy almashtiradi; USTOZGA
esa berilgan parol doimiy — almashtirish ixtiyoriy (egasining qarori,
2026-09-02).
"""

import argparse
import asyncio
import csv
import json
import re
import secrets
import sys
from datetime import date, time
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionFactory
from app.core.naming import build_login, login_variant
from app.core.security import generate_initial_password, hash_password
from app.models import (
    AcademicYear,
    BellSchedule,
    Guardian,
    Permission,
    Role,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    Term,
    User,
    UserPermission,
)

#: admin.test paroli ham TASODIFIY yaratiladi va faqat creds fayliga
#: yoziladi — repo ochiq, kodga yozilgan parol hammaga koʻrinadi (X-10).

#: Qoʻngʻiroqlar jadvali — 8 para (ADM-07 standart setka).
BELLS: list[tuple[int, str, str]] = [
    (1, "08:30", "09:15"),
    (2, "09:25", "10:10"),
    (3, "10:20", "11:05"),
    (4, "11:20", "12:05"),
    (5, "12:15", "13:00"),
    (6, "13:30", "14:15"),
    (7, "14:25", "15:10"),
    (8, "15:20", "16:05"),
]

#: Choraklar — TAXMINIY standart sanalar; admin Kalendar'da aniqlashtiradi.
TERMS: list[tuple[int, str, str, str]] = [
    (1, "1-chorak", "2026-09-01", "2026-10-26"),
    (2, "2-chorak", "2026-11-03", "2026-12-28"),
    (3, "3-chorak", "2027-01-11", "2027-03-20"),
    (4, "4-chorak", "2027-04-01", "2027-05-25"),
]


def toza_matn(s: str) -> str:
    """Oʻzbekcha apostrof normalizatsiyasi (CLAUDE.md 8-qoida).

    Jadvalda `'` (ASCII) ishlatilgan: o' → oʻ, g' → gʻ, qolgani → ʼ
    (tutuq belgisi, masalan Eʼzoza).
    """
    s = s.strip()
    s = re.sub(r"([oOgG])[''`‘’]", lambda m: m.group(1) + "ʻ", s)
    s = re.sub(r"[''`‘’]", "ʼ", s)
    return re.sub(r"\s+", " ", s)


def ism_bolaklari(full: str) -> tuple[str, str, str | None]:
    """"Familiya Ism [otasining ismi...]" → (last, first, middle|None)."""
    qismlar = toza_matn(full).split(" ")
    last = qismlar[0]
    first = qismlar[1] if len(qismlar) > 1 else ""
    middle = " ".join(qismlar[2:]) or None
    return last, first, middle


def telefon(raw: str) -> str | None:
    raqamlar = "".join(re.findall(r"\d", raw or ""))
    if len(raqamlar) == 9:
        return "+998" + raqamlar
    if len(raqamlar) == 12 and raqamlar.startswith("998"):
        return "+" + raqamlar
    return None


def sinf_nomi(tab: str) -> str:
    """"1-A sinf" → "1-A"; "0-sinf" → "0-sinf"."""
    return tab.replace(" sinf", "").strip()


def read_data(path: Path) -> tuple[list[dict], list[dict]]:
    """(ustozlar, oʻquvchilar) — `scripts/xlsx_to_json.py` chiqargan JSON."""
    data = json.loads(path.read_text(encoding="utf-8"))
    ustozlar = [
        {
            "full": u["full"],
            "subject": toza_matn(u["subject"]) if u.get("subject") else None,
            "class": sinf_nomi(u["class"]) if u.get("class") else None,
        }
        for u in data["teachers"]
    ]
    oquvchilar = [
        {"full": o["full"], "class": sinf_nomi(o["class"]), "phone": o.get("phone", "")}
        for o in data["students"]
    ]
    return ustozlar, oquvchilar


async def wipe(session: AsyncSession) -> int:
    """BARCHA jadvallarni tozalaydi (alembic_version'dan tashqari).

    `audit_log`/`login_log` triggerlar bilan oʻzgarmas (4-qoida) — bu
    DEMO maʼlumotni bir martalik toʻliq almashtirish, shuning uchun
    triggerlar vaqtincha oʻchirilib, tozalangach QAYTA yoqiladi.
    """
    rows = await session.execute(
        text(
            "select tablename from pg_tables "
            "where schemaname = 'public' and tablename <> 'alembic_version'"
        )
    )
    jadvallar = list(rows.scalars())
    await session.execute(text("ALTER TABLE audit_log DISABLE TRIGGER USER"))
    await session.execute(text("ALTER TABLE login_log DISABLE TRIGGER USER"))
    try:
        await session.execute(text("TRUNCATE " + ", ".join(jadvallar) + " CASCADE"))
    finally:
        await session.execute(text("ALTER TABLE audit_log ENABLE TRIGGER USER"))
        await session.execute(text("ALTER TABLE login_log ENABLE TRIGGER USER"))
    await session.commit()
    return len(jadvallar)


class Logins:
    def __init__(self) -> None:
        self.band: set[str] = set()

    def yangi(self, last: str, first: str) -> str:
        base = build_login(last, first)
        i = 1
        while True:
            nomzod = login_variant(base, i)
            if nomzod not in self.band:
                self.band.add(nomzod)
                return nomzod
            i += 1


async def run(xlsx: Path, creds_path: Path, do_wipe: bool) -> None:
    ustozlar, oquvchilar = read_data(xlsx)
    print(f"Jadvaldan oʻqildi: {len(ustozlar)} ustoz, {len(oquvchilar)} oʻquvchi")

    creds: list[dict] = []
    logins = Logins()

    async with SessionFactory() as session:
        if do_wipe:
            n = await wipe(session)
            print(f"Baza tozalandi: {n} jadval")

        # ── Rollar ──
        roles = {r.name: r for r in (await session.execute(select(Role))).scalars()}
        for name in RoleName:
            if name.value not in roles:
                role = Role(name=name.value, description="")
                session.add(role)
                roles[name.value] = role
        await session.flush()

        # ── Superadmin + admin.test ──
        sa_parol = secrets.token_urlsafe(12)
        sa = User(
            login="super.admin",
            password_hash=hash_password(sa_parol),
            last_name="Tizim",
            first_name="Egasi",
            must_change_password=False,
        )
        sa.roles = [roles[RoleName.SUPERADMIN.value]]
        session.add(sa)
        logins.band.add("super.admin")
        creds.append(
            {"rol": "superadmin", "sinf": "", "ism": "Tizim egasi",
             "login": "super.admin", "parol": sa_parol, "telefon": ""}
        )

        admin_parol = secrets.token_urlsafe(12)
        admin = User(
            login="admin.test",
            password_hash=hash_password(admin_parol),
            last_name="Adminov",
            first_name="Admin",
            must_change_password=False,
        )
        admin.roles = [roles[RoleName.ADMIN.value]]
        session.add(admin)
        logins.band.add("admin.test")
        await session.flush()
        # Admin'ga barcha amaliy huquqlar (huquq berishdan tashqari).
        for p in Permission:
            if p is Permission.PERMISSIONS_GRANT:
                continue
            session.add(
                UserPermission(user_id=admin.id, permission=p.value, granted_by_id=sa.id)
            )
        creds.append(
            {"rol": "admin", "sinf": "", "ism": "Adminov Admin",
             "login": "admin.test", "parol": admin_parol, "telefon": ""}
        )

        # ── Oʻquv yili, choraklar, qoʻngʻiroqlar ──
        ay = AcademicYear(
            name="2026-2027",
            starts_on=date(2026, 9, 1),
            ends_on=date(2027, 5, 25),
            is_current=True,
        )
        session.add(ay)
        await session.flush()
        for idx, nom, d1, d2 in TERMS:
            session.add(
                Term(
                    academic_year_id=ay.id,
                    index=idx,
                    name=nom,
                    starts_on=date.fromisoformat(d1),
                    ends_on=date.fromisoformat(d2),
                )
            )
        for para, t1, t2 in BELLS:
            session.add(
                BellSchedule(
                    academic_year_id=ay.id,
                    period=para,
                    starts_at=time.fromisoformat(t1),
                    ends_at=time.fromisoformat(t2),
                )
            )

        # ── Fanlar ──
        fan_nomlari = sorted({u["subject"] for u in ustozlar if u["subject"]})
        fanlar: dict[str, Subject] = {}
        for nom in fan_nomlari:
            f = Subject(name=nom, short_name=nom[:20])
            session.add(f)
            fanlar[nom] = f
        await session.flush()
        print(f"Fanlar: {len(fanlar)} — {', '.join(fan_nomlari)}")

        # ── Ustozlar ──
        rahbarlar: dict[str, User] = {}  # sinf nomi → ustoz
        for u in ustozlar:
            last, first, middle = ism_bolaklari(u["full"])
            parol = generate_initial_password()
            acc = User(
                login=logins.yangi(last, first),
                password_hash=hash_password(parol),
                last_name=last,
                first_name=first,
                middle_name=middle,
                # Egasining qarori (2026-09-02): ustozga berilgan parol
                # doimiy — almashtirish ixtiyoriy (/parol sahifasidan).
                must_change_password=False,
            )
            acc.roles = [roles[RoleName.TEACHER.value]]
            if u["class"]:
                acc.roles.append(roles[RoleName.HOMEROOM_TEACHER.value])
            session.add(acc)
            await session.flush()
            if u["subject"] and u["subject"] in fanlar:
                session.add(
                    TeacherSubject(teacher_id=acc.id, subject_id=fanlar[u["subject"]].id)
                )
            if u["class"]:
                rahbarlar[u["class"]] = acc
            creds.append(
                {"rol": "ustoz", "sinf": u["class"] or "", "ism": f"{last} {first}",
                 "login": acc.login, "parol": parol, "telefon": ""}
            )
        print(f"Ustozlar: {len(ustozlar)} (sinf rahbarlari: {len(rahbarlar)})")

        # ── Sinflar ──
        sinflar: dict[str, SchoolClass] = {}
        for nom in sorted({o["class"] for o in oquvchilar}):
            rahbar = rahbarlar.get(nom)
            sc = SchoolClass(
                academic_year_id=ay.id,
                name=nom,
                homeroom_teacher_id=rahbar.id if rahbar else None,
            )
            session.add(sc)
            sinflar[nom] = sc
        await session.flush()
        print(f"Sinflar: {len(sinflar)}")

        # ── Oʻquvchilar ──
        talabalar: list[tuple[dict, Student]] = []
        for o in oquvchilar:
            last, first, middle = ism_bolaklari(o["full"])
            parol = generate_initial_password()
            acc = User(
                login=logins.yangi(last, first),
                password_hash=hash_password(parol),
                last_name=last,
                first_name=first,
                middle_name=middle,
                must_change_password=True,
            )
            acc.roles = [roles[RoleName.STUDENT.value]]
            session.add(acc)
            await session.flush()
            st = Student(
                user_id=acc.id,
                class_id=sinflar[o["class"]].id,
                last_name=last,
                first_name=first,
                middle_name=middle,
            )
            session.add(st)
            talabalar.append((o, st))
            creds.append(
                {"rol": "oquvchi", "sinf": o["class"], "ism": f"{last} {first}",
                 "login": acc.login, "parol": parol, "telefon": ""}
            )
        await session.flush()
        print(f"Oʻquvchilar: {len(talabalar)}")

        # ── Vasiylar: telefon boʻyicha bitta oila ──
        oila: dict[str, User] = {}
        vasiy_soni = 0
        for o, st in talabalar:
            tel = telefon(o["phone"])
            kalit = tel or f"telsiz-{st.id}"
            parent = oila.get(kalit)
            if parent is None:
                parol = generate_initial_password()
                parent = User(
                    login=logins.yangi(st.last_name, "oilasi"),
                    phone=tel,
                    password_hash=hash_password(parol),
                    last_name=st.last_name,
                    first_name="oilasi",
                    must_change_password=True,
                )
                parent.roles = [roles[RoleName.PARENT.value]]
                session.add(parent)
                await session.flush()
                oila[kalit] = parent
                vasiy_soni += 1
                creds.append(
                    {"rol": "vasiy", "sinf": o["class"],
                     "ism": f"{st.last_name} oilasi ({st.first_name} uchun)",
                     "login": parent.login, "parol": parol, "telefon": tel or ""}
                )
            session.add(
                Guardian(
                    student_id=st.id,
                    user_id=parent.id,
                    relation="guardian",
                    is_primary=True,
                )
            )
        print(f"Vasiylar: {vasiy_soni} (aka-ukalar bitta hisobga bogʻlandi)")

        await session.commit()

    with creds_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["rol", "sinf", "ism", "login", "parol", "telefon"])
        w.writeheader()
        w.writerows(creds)
    print(f"\nLogin/parollar yozildi: {creds_path} ({len(creds)} qator)")
    print("Eslatma: choraklar sanasi taxminiy — Kalendar boʻlimida aniqlashtiring.")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("xlsx", type=Path, help="xlsx_to_json.py chiqargan JSON fayl")
    p.add_argument("--wipe", action="store_true", help="bazani tozalab yuklash")
    p.add_argument("--creds", type=Path, required=True, help="parollar CSV yoʻli")
    args = p.parse_args()
    if not args.xlsx.exists():
        sys.exit(f"Fayl topilmadi: {args.xlsx}")
    asyncio.run(run(args.xlsx, args.creds, args.wipe))


if __name__ == "__main__":
    main()
