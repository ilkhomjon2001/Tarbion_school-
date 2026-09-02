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
    uv run python -m app.seed --empty    # tozalaydi, demo yuklamaydi

`--reset` FAQAT development uchun. U domen jadvallarini TRUNCATE qiladi —
CLAUDE.md 1-qoidasi (hech narsa oʻchirilmaydi) ilovaga tegishli, bu esa
ishlab chiqish asbobi. Shu sabab `APP_ENV=production` da ishlamaydi.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date, datetime, time, timedelta
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
    Appeal,
    AppealMessage,
    AppealNote,
    AppealStatus,
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
#
# Roʻyxat TOʻLIQ boʻlishi shart. `TRUNCATE ... CASCADE` bogʻlangan
# jadvallarni oʻzi ham tozalaydi, lekin bunga tayanib boʻlmaydi:
# `users` ga tashqi kalit bilan bogʻlanmagan yangi jadval sezdirmasdan
# tozalanmay qoladi va keyingi yuklashda eski qatorlar yangisi bilan
# aralashadi. `check_truncate_complete()` shu roʻyxat baza bilan mos
# ekanini tekshiradi — yangi jadval qoʻshsangiz shu yerga ham yozing.
#
# `roles` ATAYIN yoʻq: bu maʼlumot emas, tizim reyestri. Uni
# `ensure_roles()` qayta tiklaydi.
TRUNCATE_ORDER = [
    "audit_log",
    "appeal_notes",
    "appeal_messages",
    "appeals",
    # ── Baholash va testlar ──
    "test_answers",
    "test_attempts",
    "test_options",
    "test_questions",
    "tests",
    "exam_results",
    "exams",
    "lesson_plans",
    "grades",
    "attendance_records",
    "homework_submissions",
    "homework",
    "lessons",
    "schedule_entries",
    # ── Moliya ──
    "payment_intents",
    "payments",
    "tuition_credits",
    "tuition_charges",
    "tuition_discounts",
    "tuition_contracts",
    # ── Aloqa ──
    "notifications",
    "announcement_classes",
    "announcements",
    "survey_responses",
    "survey_scores",
    "survey_questions",
    "surveys",
    # ── CRM ──
    "lead_calls",
    "leads",
    # ── Oʻquvchi atrofidagi yozuvlar ──
    "wellbeing_notes",
    "document_requests",
    "guardians",
    "students",
    "class_subjects",
    "teacher_subjects",
    "classes",
    "subjects",
    "cafeteria_menu_items",
    "school_settings",
    "bell_schedule",
    "holidays",
    "terms",
    "academic_years",
    # ── Kadrlar ──
    "staff_leaves",
    "staff_profiles",
    # ── Hisob va kirish ──
    "two_factor_recovery_codes",
    "user_permissions",
    "login_log",
    "login_attempts",
    "refresh_tokens",
    "user_roles",
    "users",
]

#: Tozalashga TUSHMAYDIGAN jadvallar — maʼlumot emas, tizim tarkibi.
TRUNCATE_SKIP = {"alembic_version", "roles"}


async def check_truncate_complete(session: AsyncSession) -> None:
    """`TRUNCATE_ORDER` baza bilan mosligini tekshiradi.

    Yangi modul qoʻshilib, uning jadvali roʻyxatga yozilmasa —
    tozalashdan keyin eski qatorlar qolib ketadi va yangi maʼlumot
    ular bilan aralashadi. Buni sezish qiyin, shuning uchun tozalash
    boshlanishidan OLDIN toʻxtatamiz.
    """
    bazada = set(
        (
            await session.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
            )
        ).scalars()
    )
    yetishmaydi = sorted(bazada - set(TRUNCATE_ORDER) - TRUNCATE_SKIP)
    if yetishmaydi:
        raise SystemExit(
            "TRUNCATE_ORDER toʻliq emas. Bazada bor, roʻyxatda yoʻq: "
            + ", ".join(yetishmaydi)
            + ". Har birini `app/seed.py` dagi TRUNCATE_ORDER ga qoʻshing "
            "(yoki tizim reyestri boʻlsa TRUNCATE_SKIP ga)."
        )

    ortiqcha = sorted(set(TRUNCATE_ORDER) - bazada)
    if ortiqcha:
        raise SystemExit(
            "TRUNCATE_ORDER da bazada yoʻq jadval bor: " + ", ".join(ortiqcha)
        )


async def reset(session: AsyncSession) -> None:
    if settings.is_production:
        raise SystemExit("--reset ishlab chiqarishda ishlamaydi")
    await check_truncate_complete(session)
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
            # Seed hisoblariga kuchli parol beriladi (DEMO_PASSWORD), 5 xonali
            # vaqtinchalik parol emas. `must_change_password` aynan shu
            # vaqtinchalik parol uchun — shuning uchun bu yerda False.
            must_change_password=False,
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
        # Oʻquvchi kabineti (T-034) uchun har biriga hisob ochiladi —
        # parol boshqa seed hisoblarnikidek umumiy.
        account = User(
            login=_unique_login(band, s["lastName"], s["firstName"]),
            password_hash=pwd,
            last_name=s["lastName"],
            first_name=s["firstName"],
            middle_name=None,
            must_change_password=False,
        )
        account.roles = [roles[RoleName.STUDENT.value]]
        session.add(account)
        await session.flush()
        st = Student(
            user_id=account.id,
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
    parents: dict[str, User] = {}
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
            must_change_password=False,
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
        parents[s["ref"]] = parent
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

    # ── Murojaatlar (MUR-01…MUR-06) ──
    await seed_appeals(session, data, students, parents, staff, classes, subjects)


async def seed_appeals(
    session: AsyncSession,
    data: dict[str, Any],
    students: dict[str, Student],
    parents: dict[str, User],
    staff: dict[str, User],
    classes: dict[str, SchoolClass],
    subjects: dict[str, Subject],
) -> None:
    """Demo yozishmalar.

    Murojaat muallifi — oʻquvchining vasiy hisobi, "demo ota-ona" emas:
    shunda ota-ona kabinetiga kirgan foydalanuvchi oʻz murojaatini
    haqiqatan koʻradi va kirish nazorati demo maʼlumotda ham sinaladi.
    """
    appeals = data.get("appeals", [])
    if not appeals:
        return

    by_ref: dict[str, Appeal] = {}
    message_rows = 0

    for a in appeals:
        student = students.get(a["studentRef"])
        author = parents.get(a["studentRef"])
        if student is None or author is None:
            continue

        cls = classes.get(a["className"])
        if a["target"] == "homeroom":
            assignee_id = cls.homeroom_teacher_id if cls else None
        elif a["target"] == "subject_teacher":
            assignee = staff.get(a["assigneeRef"] or "")
            assignee_id = assignee.id if assignee else None
        else:
            # Rahbariyat: masʼul biriktirilmagan — administrator taqsimlaydi.
            assignee_id = None

        subject = subjects.get(a["subject"]) if a.get("subject") else None
        created = parse_moment(a["createdAt"])
        last = parse_moment(a["messages"][-1]["createdAt"]) if a["messages"] else created

        appeal = Appeal(
            student_id=student.id,
            author_id=author.id,
            target=a["target"],
            assignee_id=assignee_id,
            subject_id=subject.id if subject else None,
            title=a["title"],
            status=a["status"],
            created_at=created,
            due_at=combine_local(date.fromisoformat(a["dueAt"]), time(18, 0)),
            closed_at=last if a["status"] == AppealStatus.CLOSED.value else None,
            last_message_at=last,
        )
        session.add(appeal)
        await session.flush()
        by_ref[a["ref"]] = appeal

        for m in a["messages"]:
            if m["author"] == "parent":
                author_id = author.id
            else:
                writer = staff.get(m["staffRef"] or "")
                author_id = writer.id if writer else (assignee_id or author.id)
            session.add(
                AppealMessage(
                    appeal_id=appeal.id,
                    author_id=author_id,
                    body=m["text"],
                    created_at=parse_moment(m["createdAt"]),
                )
            )
            message_rows += 1

    # Ichki qaydlar — administrator nomidan. Ota-ona va ustoz koʻrmaydi.
    admin = staff.get("s-adm")
    note_rows = 0
    if admin is not None:
        for n in data.get("appealNotes", []):
            appeal = by_ref.get(n["appealRef"])
            if appeal is None:
                continue
            session.add(
                AppealNote(
                    appeal_id=appeal.id,
                    author_id=admin.id,
                    kind=n["kind"],
                    summary=n["summary"],
                    about_teacher_id=(
                        staff[n["aboutTeacherRef"]].id
                        if n.get("aboutTeacherRef") in staff
                        else None
                    ),
                    teacher_rating=n.get("teacherRating"),
                    teacher_comment=n.get("teacherComment"),
                )
            )
            note_rows += 1

    await session.commit()
    print(
        f"  murojaatlar: {len(by_ref)} · xabarlar: {message_rows} · ichki qayd: {note_rows}"
    )


def parse_moment(value: str) -> datetime:
    """"2026-08-27 09:20" yoki "2026-08-27" → UTC datetime.

    Mock'dagi vaqt MAHALLIY (Asia/Tashkent). To'g'ridan-to'g'ri UTC deb
    saqlansa yozishma besh soat oldinga surilib ketardi.
    """
    value = value.strip()
    if " " in value:
        day_part, time_part = value.split(" ", 1)
        hour, minute = (int(x) for x in time_part.split(":")[:2])
    else:
        day_part, hour, minute = value, 9, 0
    return combine_local(date.fromisoformat(day_part), time(hour, minute))



async def main() -> None:
    # Windows konsoli sukut boʻyicha cp1251 — `ʻ` (U+02BB) chiqarilganda
    # butun skript UnicodeEncodeError bilan yiqiladi. Chiqishni UTF-8 ga
    # oʻtkazamiz, imkonsiz belgilarni esa almashtiramiz.
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Tarbion demo maʼlumotini yuklaydi")
    parser.add_argument("--reset", action="store_true", help="avval jadvallarni tozalash")
    parser.add_argument(
        "--empty",
        action="store_true",
        help="tozalaydi va demo yuklamaydi — haqiqiy maktab uchun boʻsh baza",
    )
    args = parser.parse_args()

    # Boʻsh baza: demo qatorlar umuman tushmaydi. Faqat rollar qoladi —
    # ularsiz birinchi hisobni ham ochib boʻlmaydi.
    if args.empty:
        async with SessionFactory() as session:
            await reset(session)
            await ensure_roles(session)
            await session.commit()
        print("Baza boʻsh. Endi birinchi hisobni oching:")
        print("  uv run python -m app.create_superadmin --last Familiya --first Ism")
        return

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
