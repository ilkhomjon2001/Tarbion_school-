"""Demo maʼlumot yuklash.

Manba — `seed-data.json`, uni frontend chiqaradi (`pnpm export:seed`).
Nega shunday: ustozlar, sinflar, dars yuklamasi va oʻquvchilar allaqachon
frontendda oʻzaro mos. Ularni bu yerda QAYTA yozish ikkinchi haqiqat
manbasini yaratardi va rahbariyatdagi raqamlar mock bilan farq qilardi.

Davomat foizi ham frontenddan keladi: har bir oʻquvchining
`attendanceMonth` qiymati bor va davomat yozuvlari SHU foizga qarab
generatsiya qilinadi. Shu sabab `/rahbar` dagi «oylik davomat 88%»
bazadan hisoblanganda ham 88% chiqadi.

Ishlatish:
    uv run python -m app.seed            # boʻsh bazaga yuklaydi
    uv run python -m app.seed --reset    # avval tozalab, keyin yuklaydi

`--reset` FAQAT development uchun. U domen jadvallarini TRUNCATE qiladi —
CLAUDE.md 1-qoidasi (hech narsa oʻchirilmaydi) ilovaga tegishli, bu esa
ishlab chiqish asbobi. Shu sabab `APP_ENV=production` da ishlamaydi.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date, time, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import SessionFactory
from app.core.naming import build_login, login_variant
from app.core.security import hash_password
from app.core.timeutil import combine_local
from app.models import (
    AcademicYear,
    AttendanceRecord,
    AttendanceStatus,
    BellSchedule,
    ClassSubject,
    Grade,
    GradeKind,
    Guardian,
    Holiday,
    Lesson,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    Term,
    User,
)

SEED_FILE = Path(__file__).resolve().parents[1] / "seed-data.json"

# Demo hisoblar uchun umumiy parol. Repo ochiq — bu HAQIQIY sekret emas
# va ishlab chiqarishda seed umuman ishlamaydi.
DEMO_PASSWORD = "Tarbion2026!"  # noqa: S105

# Dars kunlari: dushanba–shanba (1..6). Yakshanba dam.
SCHOOL_WEEKDAYS = [1, 2, 3, 4, 5, 6]

# Davomat va baho shu kungacha generatsiya qilinadi (frontenddagi «bugun»).
DEMO_TODAY = date(2026, 9, 20)


def hash_text(value: str) -> int:
    """FNV-1a, frontenddagi bilan AYNAN bir xil.

    `>>> 0` ekvivalenti: 32 bitga qisqartirish. Frontendda `>>` ishlatilsa
    manfiy son chiqadi va indeks buziladi — shu sabab u yerda ham `>>>`.
    """
    h = 2166136261
    for ch in value:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def pick(seed: int, low: int, high: int) -> int:
    return low + (seed % (high - low + 1))


# ───────────────────────── Tozalash ─────────────────────────

# Bogʻliqlik tartibida — bola jadvallar oldin.
TRUNCATE_ORDER = [
    "audit_log",
    "grades",
    "attendance_records",
    "homework_submissions",
    "homework",
    "lessons",
    "schedule_entries",
    "guardians",
    "students",
    "class_subjects",
    "teacher_subjects",
    "classes",
    "subjects",
    "bell_schedule",
    "holidays",
    "terms",
    "academic_years",
    "login_log",
    "login_attempts",
    "refresh_tokens",
    "user_roles",
    "users",
]


async def reset(session: AsyncSession) -> None:
    if settings.is_production:
        raise SystemExit("--reset ishlab chiqarishda ishlamaydi")
    await session.execute(
        text("TRUNCATE " + ", ".join(TRUNCATE_ORDER) + " RESTART IDENTITY CASCADE")
    )
    await session.commit()
    print("  tozalandi: " + str(len(TRUNCATE_ORDER)) + " ta jadval")


# ───────────────────────── Yuklash ─────────────────────────


def _unique_login(band: set[str], last_name: str, first_name: str) -> str:
    """Seed uchun takrorlanmas login.

    `user_service.next_free_login` bazaga soʻrov yuboradi — seedda minglab
    qator boʻlgani uchun bu sekin. Bu yerda band loginlar toʻplamda
    saqlanadi va bitta ham soʻrov ketmaydi.
    """
    base = build_login(last_name, first_name)
    i = 1
    while True:
        nomzod = login_variant(base, i)
        if nomzod not in band:
            band.add(nomzod)
            return nomzod
        i += 1


async def ensure_roles(session: AsyncSession) -> dict[str, Role]:
    existing = {r.name: r for r in (await session.execute(select(Role))).scalars()}
    for name in RoleName:
        if name.value not in existing:
            role = Role(name=name.value, description="")
            session.add(role)
            existing[name.value] = role
    await session.flush()
    return existing


async def seed(session: AsyncSession, data: dict[str, Any]) -> None:
    roles = await ensure_roles(session)
    print(f"  rollar: {len(roles)}")

    # ── Oʻquv yili, choraklar, taʼtillar, qoʻngʻiroqlar ──
    ay = AcademicYear(
        name=data["academicYear"]["name"],
        starts_on=date.fromisoformat(data["academicYear"]["startsOn"]),
        ends_on=date.fromisoformat(data["academicYear"]["endsOn"]),
        is_current=True,
    )
    session.add(ay)
    await session.flush()

    for t in data["terms"]:
        session.add(
            Term(
                academic_year_id=ay.id,
                index=t["index"],
                name=t["name"],
                starts_on=date.fromisoformat(t["startsOn"]),
                ends_on=date.fromisoformat(t["endsOn"]),
            )
        )

    holiday_days: set[date] = set()
    for b in data["breaks"]:
        day = date.fromisoformat(b["startsOn"])
        last = date.fromisoformat(b["endsOn"])
        while day <= last:
            session.add(Holiday(academic_year_id=ay.id, day=day, title=b["name"]))
            holiday_days.add(day)
            day += timedelta(days=1)

    bells: dict[int, tuple[time, time]] = {}
    for b in data["bellSchedule"]:
        starts = time.fromisoformat(b["startsAt"])
        ends = time.fromisoformat(b["endsAt"])
        bells[b["period"]] = (starts, ends)
        session.add(
            BellSchedule(academic_year_id=ay.id, period=b["period"], starts_at=starts, ends_at=ends)
        )
    await session.flush()
    print(
        f"  oʻquv yili {ay.name}: {len(data['terms'])} chorak, "
        f"{len(holiday_days)} taʼtil kuni, {len(bells)} para"
    )

    # ── Fanlar ──
    subjects: dict[str, Subject] = {}
    for name in data["subjects"]:
        s = Subject(name=name, short_name=name[:12])
        session.add(s)
        subjects[name] = s
    await session.flush()
    print(f"  fanlar: {len(subjects)}")

    # ── Xodimlar ──
    staff: dict[str, User] = {}
    band: set[str] = set()
    pwd = hash_password(DEMO_PASSWORD)
    for person in data["staff"]:
        u = User(
            login=_unique_login(band, person["lastName"], person["firstName"]),
            phone=person["phone"],
            password_hash=pwd,
            last_name=person["lastName"],
            first_name=person["firstName"],
            middle_name=person["middleName"],
            email=person["email"],
            must_change_password=True,
        )
        u.roles = [roles[r] for r in person["roles"] if r in roles]
        session.add(u)
        staff[person["ref"]] = u
    await session.flush()

    for person in data["staff"]:
        for subject_name in person["subjects"]:
            if subject_name in subjects:
                session.add(
                    TeacherSubject(
                        teacher_id=staff[person["ref"]].id,
                        subject_id=subjects[subject_name].id,
                    )
                )
    await session.flush()
    print(f"  xodimlar: {len(staff)}")

    # ── Sinflar ──
    classes: dict[str, SchoolClass] = {}
    for c in data["classes"]:
        homeroom = staff.get(c["homeroomRef"]) if c["homeroomRef"] else None
        sc = SchoolClass(
            academic_year_id=ay.id,
            name=c["name"],
            homeroom_teacher_id=homeroom.id if homeroom else None,
        )
        session.add(sc)
        classes[c["name"]] = sc
    await session.flush()
    print(f"  sinflar: {len(classes)}")

    # ── Sinf × fan va dars jadvali ──
    # Toʻqnashuv bazada qatʼiy taqiqlangan (qisman-unique indekslar), shu
    # sabab joylashtirish ochkoʻz algoritm bilan: sinf ham, ustoz ham boʻsh
    # boʻlgan birinchi katak olinadi.
    class_busy: set[tuple[str, int, int]] = set()
    teacher_busy: set[tuple[str, int, int]] = set()
    periods = sorted(bells)
    placed = 0
    unplaced: list[str] = []

    for a in data["assignments"]:
        cls = classes[a["className"]]
        subject = subjects[a["subject"]]
        teacher = staff[a["teacherRef"]]
        session.add(
            ClassSubject(class_id=cls.id, subject_id=subject.id, weekly_hours=a["hoursPerWeek"])
        )

        for _ in range(a["hoursPerWeek"]):
            slot = None
            for weekday in SCHOOL_WEEKDAYS:
                for period in periods:
                    if (a["className"], weekday, period) in class_busy:
                        continue
                    if (a["teacherRef"], weekday, period) in teacher_busy:
                        continue
                    slot = (weekday, period)
                    break
                if slot:
                    break
            if not slot:
                unplaced.append(f"{a['className']}·{a['subject']}")
                continue
            weekday, period = slot
            class_busy.add((a["className"], weekday, period))
            teacher_busy.add((a["teacherRef"], weekday, period))
            session.add(
                ScheduleEntry(
                    academic_year_id=ay.id,
                    class_id=cls.id,
                    subject_id=subject.id,
                    teacher_id=teacher.id,
                    weekday=weekday,
                    period=period,
                    # Har sinfning oʻz xonasi — shunda xona toʻqnashuvi
                    # sinf toʻqnashuvidan kelib chiqadi, alohida emas.
                    room=a["className"],
                )
            )
            placed += 1
    await session.flush()
    print(
        f"  jadval: {placed} ta dars sloti"
        + (f" · joylashmadi {len(unplaced)}" if unplaced else "")
    )

    # ── Oʻquvchilar va vasiylar ──
    students: dict[str, Student] = {}
    attendance_pct: dict[str, int] = {}
    guardian_rows = 0

    for s in data["students"]:
        cls = classes.get(s["className"])
        if cls is None:
            continue
        seed_val = hash_text(f"stu-{s['ref']}")
        st = Student(
            class_id=cls.id,
            last_name=s["lastName"],
            first_name=s["firstName"],
            birth_date=date(
                2026 - pick(seed_val, 11, 17),
                pick(seed_val >> 5, 1, 12),
                pick(seed_val >> 9, 1, 28),
            ),
        )
        session.add(st)
        students[s["ref"]] = st
        attendance_pct[s["ref"]] = s["attendanceMonth"]
    await session.flush()

    # Har bir oʻquvchiga bitta vasiy hisobi (AUT-03). Telefon raqami
    # takrorlanmasligi kerak — `users.phone` unique.
    for i, s in enumerate(data["students"]):
        if s["ref"] not in students:
            continue
        phone = f"9989{i:08d}"
        parent = User(
            login=_unique_login(band, s["lastName"], "ota"),
            phone=phone,
            password_hash=pwd,
            last_name=s["lastName"],
            first_name="Ota-ona",
            middle_name=None,
            must_change_password=True,
        )
        parent.roles = [roles[RoleName.PARENT.value]]
        session.add(parent)
        await session.flush()
        session.add(
            Guardian(
                student_id=students[s["ref"]].id,
                user_id=parent.id,
                relation="father",
                is_primary=True,
            )
        )
        guardian_rows += 1
    await session.flush()
    print(f"  oʻquvchilar: {len(students)} · vasiylar: {guardian_rows}")

    # ── Darslar ──
    entries = (
        (
            await session.execute(
                select(ScheduleEntry).where(ScheduleEntry.academic_year_id == ay.id)
            )
        )
        .scalars()
        .all()
    )
    by_weekday: dict[int, list[ScheduleEntry]] = {}
    for e in entries:
        by_weekday.setdefault(e.weekday, []).append(e)

    students_by_class: dict[Any, list[Student]] = {}
    ref_by_student_id: dict[Any, str] = {}
    for ref, st in students.items():
        students_by_class.setdefault(st.class_id, []).append(st)
        ref_by_student_id[st.id] = ref

    lesson_rows = 0
    attendance_rows = 0
    grade_rows = 0

    day = ay.starts_on
    while day <= DEMO_TODAY:
        weekday = day.isoweekday()
        if weekday in by_weekday and day not in holiday_days:
            for e in by_weekday[weekday]:
                starts, ends = bells[e.period]
                lesson = Lesson(
                    schedule_entry_id=e.id,
                    class_id=e.class_id,
                    subject_id=e.subject_id,
                    teacher_id=e.teacher_id,
                    lesson_date=day,
                    period=e.period,
                    room=e.room,
                    starts_at=combine_local(day, starts),
                    ends_at=combine_local(day, ends),
                    attendance_marked_at=combine_local(day, ends),
                )
                session.add(lesson)
                await session.flush()
                lesson_rows += 1

                for st in students_by_class.get(e.class_id, []):
                    ref = ref_by_student_id[st.id]
                    pct = attendance_pct.get(ref, 90)
                    # Frontenddagi `attendanceDaysOf()` bilan bir xil maʼno:
                    # `attendanceMonth` — KELGAN darslar ulushi, kechikkan
                    # ham kelgan hisoblanadi. Qolgan qismning uchdan biri
                    # sababli. Aks holda bazadagi foiz mock'dan yuqori
                    # chiqadi — birinchi urinishda aynan shunday boʻldi.
                    roll = hash_text(f"att-{ref}-{day.isoformat()}-{e.period}") % 100
                    sub = hash_text(f"sub-{ref}-{day.isoformat()}-{e.period}")
                    if roll < pct:
                        status = (
                            AttendanceStatus.LATE.value
                            if sub % 11 == 0
                            else AttendanceStatus.PRESENT.value
                        )
                    else:
                        status = (
                            AttendanceStatus.EXCUSED.value
                            if sub % 3 == 0
                            else AttendanceStatus.ABSENT.value
                        )

                    session.add(
                        AttendanceRecord(
                            lesson_id=lesson.id,
                            student_id=st.id,
                            status=status,
                            marked_by_id=e.teacher_id,
                            marked_at=combine_local(day, ends),
                        )
                    )
                    attendance_rows += 1

                    # Darsda boʻlganlarning ~20% iga baho qoʻyiladi.
                    if status == AttendanceStatus.PRESENT.value:
                        g = hash_text(f"gr-{ref}-{day.isoformat()}-{e.period}")
                        if g % 5 == 0:
                            session.add(
                                Grade(
                                    student_id=st.id,
                                    subject_id=e.subject_id,
                                    lesson_id=lesson.id,
                                    teacher_id=e.teacher_id,
                                    kind=GradeKind.CURRENT.value,
                                    value=pick(g >> 3, 3, 5),
                                    max_value=5,
                                    weight=1,
                                )
                            )
                            grade_rows += 1
            await session.commit()
        day += timedelta(days=1)

    await session.commit()
    print(f"  darslar: {lesson_rows} · davomat: {attendance_rows} · baholar: {grade_rows}")


async def main() -> None:
    # Windows konsoli sukut boʻyicha cp1251 — `ʻ` (U+02BB) chiqarilganda
    # butun skript UnicodeEncodeError bilan yiqiladi. Chiqishni UTF-8 ga
    # oʻtkazamiz, imkonsiz belgilarni esa almashtiramiz.
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Tarbion demo maʼlumotini yuklaydi")
    parser.add_argument("--reset", action="store_true", help="avval jadvallarni tozalash")
    args = parser.parse_args()

    if not SEED_FILE.exists():
        raise SystemExit(
            f"{SEED_FILE} topilmadi. Avval frontendda `pnpm export:seed` ishga tushiring."
        )

    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))

    async with SessionFactory() as session:
        if args.reset:
            await reset(session)

        count = (await session.execute(select(func.count()).select_from(User))).scalar_one()
        if count:
            print(f"Bazada allaqachon {count} ta foydalanuvchi bor. --reset bilan qayta yuklang.")
            sys.exit(1)

        print("Yuklanmoqda…")
        await seed(session, data)
        print("Tayyor.")


if __name__ == "__main__":
    asyncio.run(main())
