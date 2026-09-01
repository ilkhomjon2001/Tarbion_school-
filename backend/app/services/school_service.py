"""Maʼlumotnoma: sinf, fan, oʻquvchi, vasiy, xodim (T-008, T-009).

TZ: ADM-02…ADM-06, ADM-11, AUT-03.

Uchta qoida modulni belgilaydi:

1. **Hech narsa oʻchirilmaydi** (CLAUDE.md 1-qoida). Maktabdan chiqqan
   oʻquvchi arxivlanadi — uning oʻtgan yilgi davomati va toʻlovi
   hisobotda qolishi kerak.

2. **Roʻyxatda shaxsiy maʼlumot boʻlmaydi** (X-6). Tugʻilgan sana,
   telefon va vasiy maʼlumoti faqat bitta oʻquvchi kartochkasida.

3. **Yozish huquq talab qiladi** (T-005). Rolning oʻzi yetarli emas:
   `students.manage` huquqi bor administrator qabul qiladi, boshqasi
   faqat koʻradi.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.timeutil import utcnow
from app.models import (
    AcademicYear,
    AuditAction,
    ClassSubject,
    Guardian,
    Permission,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    User,
)
from app.services import audit_service, user_service
from app.services.access import CurrentUser, accessible_student_ids
from app.services.permissions import assert_permission


@dataclass(frozen=True, slots=True)
class ClassRow:
    id: uuid.UUID
    name: str
    academic_year: str
    homeroom_teacher: str | None
    # Ism koʻrsatish uchun, id esa tanlash uchun: interfeysda rahbar
    # roʻyxatdan tanlanadi va tanlangani belgilangan boʻlishi kerak.
    homeroom_teacher_id: uuid.UUID | None
    student_count: int


@dataclass(frozen=True, slots=True)
class GuardianRow:
    user_id: uuid.UUID
    full_name: str
    relation: str
    phone: str | None


@dataclass(frozen=True, slots=True)
class StudentCard:
    """Bitta oʻquvchi kartochkasi — shaxsiy maʼlumot SHU YERDA."""

    student: Student
    class_name: str | None
    guardians: list[GuardianRow]


# ─────────────────────────── Fanlar ───────────────────────────


async def list_subjects(session: AsyncSession) -> list[Subject]:
    rows = await session.execute(
        select(Subject).where(Subject.is_archived.is_(False)).order_by(Subject.name)
    )
    return list(rows.scalars())


# ─────────────────────────── Sinflar ───────────────────────────


async def current_year(session: AsyncSession) -> AcademicYear | None:
    return await session.scalar(
        select(AcademicYear).where(
            AcademicYear.is_current.is_(True), AcademicYear.is_archived.is_(False)
        )
    )


async def list_classes(session: AsyncSession) -> list[ClassRow]:
    """Joriy oʻquv yilidagi sinflar va ularda nechta oʻquvchi borligi.

    Sanoq bitta soʻrovda: har sinf uchun alohida soʻralsa 16 ta sinfda
    16 marta bazaga borilardi (N+1).
    """
    teacher = User.__table__.alias("homeroom")
    stmt = (
        select(
            SchoolClass,
            AcademicYear.name,
            teacher.c.last_name,
            teacher.c.first_name,
            func.count(Student.id),
        )
        .join(AcademicYear, AcademicYear.id == SchoolClass.academic_year_id)
        .join(teacher, teacher.c.id == SchoolClass.homeroom_teacher_id, isouter=True)
        .join(
            Student,
            (Student.class_id == SchoolClass.id) & Student.is_archived.is_(False),
            isouter=True,
        )
        .where(SchoolClass.is_archived.is_(False), AcademicYear.is_current.is_(True))
        .group_by(SchoolClass.id, AcademicYear.name, teacher.c.last_name, teacher.c.first_name)
        .order_by(SchoolClass.name)
    )

    natija = []
    for cls, year, last, first, count in (await session.execute(stmt)).all():
        natija.append(
            ClassRow(
                id=cls.id,
                name=cls.name,
                academic_year=year,
                homeroom_teacher=f"{last} {first}" if last else None,
                homeroom_teacher_id=cls.homeroom_teacher_id,
                student_count=count,
            )
        )
    return natija


async def class_subjects(session: AsyncSession, class_id: uuid.UUID) -> list[tuple[Subject, int]]:
    """Sinfda oʻqitiladigan fanlar va haftalik soati (ADM-03)."""
    rows = await session.execute(
        select(Subject, ClassSubject.weekly_hours)
        .join(ClassSubject, ClassSubject.subject_id == Subject.id)
        .where(ClassSubject.class_id == class_id, ClassSubject.is_archived.is_(False))
        .order_by(Subject.name)
    )
    return [(s, h) for s, h in rows.all()]


# ─────────────────────────── Oʻquvchilar ───────────────────────────


def _scope(stmt: Select, allowed: set[uuid.UUID] | None) -> Select:
    """Kirish nazorati SOʻROV darajasida (X-1).

    `None` — cheklov yoʻq (admin, direktor). Boʻsh toʻplam — hech narsa;
    filtrni tushirib qoldirish ruxsatsiz odamga butun maktabni berardi.
    """
    if allowed is None:
        return stmt
    return stmt.where(Student.id.in_(allowed))


async def list_students(
    session: AsyncSession,
    user: CurrentUser,
    *,
    class_id: uuid.UUID | None = None,
    query: str | None = None,
    archived: bool = False,
    limit: int = 200,
) -> list[tuple[Student, str | None]]:
    """Oʻquvchilar roʻyxati (ADM-05).

    Tugʻilgan sana, telefon va vasiy maʼlumoti QAYTMAYDI (X-6) — ular
    faqat kartochkada. Roʻyxat koʻproq odamga ochiq va eksport qilinadi.
    """
    allowed = await accessible_student_ids(session, user)

    stmt = (
        select(Student, SchoolClass.name)
        .join(SchoolClass, SchoolClass.id == Student.class_id, isouter=True)
        .where(Student.is_archived.is_(archived))
        .order_by(Student.last_name, Student.first_name)
    )
    stmt = _scope(stmt, allowed)

    if class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
    if query:
        naqsh = f"%{query.strip()}%"
        stmt = stmt.where(or_(Student.last_name.ilike(naqsh), Student.first_name.ilike(naqsh)))

    rows = await session.execute(stmt.limit(limit))
    return [(s, name) for s, name in rows.all()]


async def student_card(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> StudentCard:
    """Bitta oʻquvchi — vasiylari bilan.

    Shaxsiy maʼlumot faqat shu yerda va faqat huquqi borga: `access.py`
    tekshiradi (X-1, X-6).
    """
    from app.services.access import assert_can_view_student

    await assert_can_view_student(session, user, student_id)

    student = await session.get(Student, student_id)
    if student is None:
        raise NotFoundError("Oʻquvchi topilmadi.")

    class_name = None
    if student.class_id:
        cls = await session.get(SchoolClass, student.class_id)
        class_name = cls.name if cls else None

    rows = await session.execute(
        select(User, Guardian.relation)
        .join(Guardian, Guardian.user_id == User.id)
        .where(Guardian.student_id == student_id, Guardian.is_archived.is_(False))
        .order_by(User.last_name)
    )
    guardians = [
        GuardianRow(
            user_id=u.id,
            full_name=u.full_name,
            relation=relation,
            phone=u.phone,
        )
        for u, relation in rows.all()
    ]

    return StudentCard(student=student, class_name=class_name, guardians=guardians)


async def create_student(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    last_name: str,
    first_name: str,
    middle_name: str | None = None,
    birth_date: date | None = None,
    class_id: uuid.UUID | None = None,
    ip: str | None = None,
) -> Student:
    """Yangi oʻquvchi (ADM-05).

    Huquq: `students.manage`. Administrator ROLI yolgʻiz yetarli emas —
    super administrator uni alohida beradi (T-005).
    """
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    if not last_name.strip() or not first_name.strip():
        raise ValidationError("Familiya va ism boʻsh boʻlmasin.")

    if class_id is not None:
        cls = await session.get(SchoolClass, class_id)
        if cls is None or cls.is_archived:
            raise NotFoundError("Sinf topilmadi.")

    # Takroriy qabulni ushlaymiz: bir xil ism-familiya va tugʻilgan sana.
    if birth_date is not None:
        mavjud = await session.scalar(
            select(Student).where(
                Student.last_name == last_name.strip(),
                Student.first_name == first_name.strip(),
                Student.birth_date == birth_date,
                Student.is_archived.is_(False),
            )
        )
        if mavjud is not None:
            raise ConflictError("Bu ism, familiya va tugʻilgan sana bilan oʻquvchi allaqachon bor.")

    student = Student(
        last_name=last_name.strip(),
        first_name=first_name.strip(),
        middle_name=(middle_name or "").strip() or None,
        birth_date=birth_date,
        class_id=class_id,
    )
    session.add(student)
    await session.flush()

    audit_service.record(
        session,
        object_type="student",
        object_id=student.id,
        action=AuditAction.CREATE,
        new={"full_name": student.full_name, "class_id": class_id},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return student


async def move_student(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    class_id: uuid.UUID | None,
    ip: str | None = None,
) -> Student:
    """Oʻquvchini boshqa sinfga koʻchiradi (ADM-06)."""
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    student = await session.get(Student, student_id)
    if student is None or student.is_archived:
        raise NotFoundError("Oʻquvchi topilmadi.")

    if class_id is not None:
        cls = await session.get(SchoolClass, class_id)
        if cls is None or cls.is_archived:
            raise NotFoundError("Sinf topilmadi.")

    eski = student.class_id
    if eski == class_id:
        return student

    student.class_id = class_id
    audit_service.record(
        session,
        object_type="student",
        object_id=student.id,
        action=AuditAction.UPDATE,
        old={"class_id": eski},
        new={"class_id": class_id},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return student


async def archive_student(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    reason: str,
    ip: str | None = None,
) -> Student:
    """Oʻquvchini arxivlaydi. Oʻchirish YOʻQ (CLAUDE.md 1-qoida).

    Sabab majburiy: kadrlar aylanmasi va "nega ketdi" hisoboti shundan
    chiqadi.
    """
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    if not reason.strip():
        raise ValidationError("Arxivlash sababi koʻrsatilishi kerak.")

    student = await session.get(Student, student_id)
    if student is None:
        raise NotFoundError("Oʻquvchi topilmadi.")
    if student.is_archived:
        return student

    student.is_archived = True
    student.archived_at = utcnow()

    audit_service.record(
        session,
        object_type="student",
        object_id=student.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False},
        new={"is_archived": True, "reason": reason.strip()},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return student


async def restore_student(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    ip: str | None = None,
) -> Student:
    """Arxivdan qaytaradi — xato bilan arxivlangan boʻlsa."""
    await assert_permission(session, actor, Permission.STUDENTS_MANAGE)

    student = await session.get(Student, student_id)
    if student is None:
        raise NotFoundError("Oʻquvchi topilmadi.")
    if not student.is_archived:
        return student

    student.is_archived = False
    student.archived_at = None

    audit_service.record(
        session,
        object_type="student",
        object_id=student.id,
        action=AuditAction.UPDATE,
        old={"is_archived": True},
        new={"is_archived": False},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return student


# ─────────────────────────── Xodimlar ───────────────────────────


@dataclass(frozen=True, slots=True)
class StaffRow:
    user_id: uuid.UUID
    login: str
    full_name: str
    roles: list[str]
    subjects: list[str]
    subject_ids: list[uuid.UUID]
    is_active: bool


async def list_staff(session: AsyncSession, user: CurrentUser) -> list[StaffRow]:
    """Xodimlar — ustoz, administrator, rahbariyat (ADM-04).

    Oʻquvchi va ota-ona rollari chiqarilmaydi: bu xodimlar roʻyxati.

    Faqat xodimlar koʻradi: roʻyxatda `login` bor — oʻquvchi/ota-onaga
    berilsa, bu brute-force uchun tayyor nishonlar roʻyxati boʻlardi
    (X-6). Oʻquvchiga ustozlar kerak boʻlsa — alohida, loginsiz endpoint.
    """
    if not (user.is_staff_wide or user.is_teacher):
        raise PermissionDeniedError("Bu roʻyxat faqat xodimlar uchun.")
    xodim_rollari = {
        RoleName.TEACHER.value,
        RoleName.HOMEROOM_TEACHER.value,
        RoleName.ACADEMIC.value,
        RoleName.ADMIN.value,
        RoleName.DIRECTOR.value,
        RoleName.SUPERADMIN.value,
    }

    rows = await session.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.is_archived.is_(False))
        .order_by(User.last_name, User.first_name)
    )
    users = [u for u in rows.scalars() if xodim_rollari & set(u.role_names)]

    # Fanlar bitta soʻrovda — har xodim uchun alohida soʻralsa N+1.
    fan_rows = await session.execute(
        select(TeacherSubject.teacher_id, Subject.id, Subject.name)
        .join(Subject, Subject.id == TeacherSubject.subject_id)
        .where(TeacherSubject.is_archived.is_(False))
    )
    fanlar: dict[uuid.UUID, list[str]] = {}
    fan_idlari: dict[uuid.UUID, list[uuid.UUID]] = {}
    for tid, sid, name in fan_rows.all():
        fanlar.setdefault(tid, []).append(name)
        fan_idlari.setdefault(tid, []).append(sid)

    return [
        StaffRow(
            user_id=u.id,
            login=u.login,
            full_name=u.full_name,
            roles=sorted(u.role_names),
            subjects=sorted(fanlar.get(u.id, [])),
            subject_ids=fan_idlari.get(u.id, []),
            is_active=u.is_active,
        )
        for u in users
    ]


async def create_staff(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    last_name: str,
    first_name: str,
    middle_name: str | None = None,
    roles: list[str],
    phone: str | None = None,
    email: str | None = None,
    subject_ids: list[uuid.UUID] | None = None,
    ip: str | None = None,
) -> user_service.CreatedUser:
    """Yangi xodim hisobi + fanlarini biriktirish (ADM-04).

    Login administrator tanlamaydi — `familiya.ism` shaklida tizim
    yasaydi. Boshlangʻich parol javobda BIR MARTA qaytadi va bazada
    faqat xeshi qoladi; administrator uni oʻsha zahoti egasiga
    yetkazadi.

    Huquq tekshiruvi `user_service.create_user` ichida (`users.create`).
    """
    xodim_rollari = {
        RoleName.TEACHER.value,
        RoleName.HOMEROOM_TEACHER.value,
        RoleName.ACADEMIC.value,
        RoleName.ADMIN.value,
        RoleName.DIRECTOR.value,
        RoleName.SUPERADMIN.value,
    }
    notogri = set(roles) - xodim_rollari
    if notogri:
        raise ValidationError(
            f"Bu roʻyxat xodimlar uchun. Mos kelmaydigan rol: {', '.join(sorted(notogri))}"
        )

    yaratildi = await user_service.create_user(
        session,
        actor=actor,
        last_name=last_name,
        first_name=first_name,
        middle_name=middle_name,
        roles=roles,
        phone=phone,
        email=email,
        ip=ip,
    )

    if subject_ids:
        await _apply_subjects(
            session, actor=actor, teacher_id=yaratildi.user.id, subject_ids=subject_ids, ip=ip
        )

    await session.commit()
    return yaratildi


async def _apply_subjects(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    teacher_id: uuid.UUID,
    subject_ids: list[uuid.UUID],
    ip: str | None,
) -> None:
    """Fanlarni YAXLIT yozadi — commit chaqiruvchida.

    Roʻyxatdan chiqqan biriktirish arxivlanadi, oʻchirilmaydi: oʻtgan
    yilgi baho va davomat oʻsha ustoz-fan juftiga bogʻlangan
    (CLAUDE.md 1-qoida).
    """
    kelgan = set(subject_ids)

    if kelgan:
        mavjud_fanlar = set(
            (
                await session.execute(
                    select(Subject.id).where(Subject.id.in_(kelgan), Subject.is_archived.is_(False))
                )
            ).scalars()
        )
        if mavjud_fanlar != kelgan:
            raise NotFoundError("Fan topilmadi.")

    rows = await session.execute(
        select(TeacherSubject).where(TeacherSubject.teacher_id == teacher_id)
    )
    mavjud = {r.subject_id: r for r in rows.scalars()}

    for subject_id in kelgan:
        row = mavjud.get(subject_id)
        if row is None:
            session.add(TeacherSubject(teacher_id=teacher_id, subject_id=subject_id))
        elif row.is_archived:
            row.is_archived = False
            row.archived_at = None

    for subject_id, row in mavjud.items():
        if subject_id in kelgan or row.is_archived:
            continue
        row.is_archived = True
        row.archived_at = utcnow()

    audit_service.record(
        session,
        object_type="teacher_subjects",
        object_id=teacher_id,
        action=AuditAction.UPDATE,
        old={"subject_ids": sorted(str(s) for s, r in mavjud.items() if not r.is_archived)},
        new={"subject_ids": sorted(str(s) for s in kelgan)},
        actor_id=actor.id,
        ip=ip,
    )


async def set_teacher_subjects(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    teacher_id: uuid.UUID,
    subject_ids: list[uuid.UUID],
    ip: str | None = None,
) -> None:
    """Ustozga fan biriktiradi (ADM-04). Huquq: `users.manage`."""
    await assert_permission(session, actor, Permission.USERS_MANAGE)

    teacher = await session.get(User, teacher_id)
    if teacher is None or teacher.is_archived:
        raise NotFoundError("Xodim topilmadi.")

    await _apply_subjects(
        session, actor=actor, teacher_id=teacher_id, subject_ids=subject_ids, ip=ip
    )
    await session.commit()


@dataclass(frozen=True, slots=True)
class StudentTeacherRow:
    """Oʻquvchiga dars beradigan ustoz — LOGINSIZ (X-6)."""

    teacher_id: uuid.UUID
    full_name: str
    subjects: list[str]
    is_homeroom: bool


async def student_teachers(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> list[StudentTeacherRow]:
    """Oʻquvchi sinfida dars beradigan ustozlar — jadvaldan.

    Oʻquvchi va ota-ona uchun: ism va fan yetarli, login/telefon YOʻQ
    (X-6). Manba — joriy jadval (`schedule_entries`).
    """
    from app.services.access import assert_can_view_student

    await assert_can_view_student(session, user, student_id)

    student = await session.get(Student, student_id)
    if student is None or student.class_id is None:
        return []

    from app.models import ScheduleEntry
    from app.models import Subject as Subj

    rows = (
        await session.execute(
            select(User, Subj.name)
            .join(ScheduleEntry, ScheduleEntry.teacher_id == User.id)
            .join(Subj, Subj.id == ScheduleEntry.subject_id)
            .where(
                ScheduleEntry.class_id == student.class_id,
                ScheduleEntry.is_archived.is_(False),
                User.is_archived.is_(False),
            )
        )
    ).all()

    cls = await session.get(SchoolClass, student.class_id)
    homeroom_id = cls.homeroom_teacher_id if cls else None

    fanlar: dict[uuid.UUID, set[str]] = {}
    ismlar: dict[uuid.UUID, str] = {}
    for u, fan in rows:
        ismlar[u.id] = u.full_name
        fanlar.setdefault(u.id, set()).add(fan)

    # Sinf rahbari jadvalda dars bermasa ham roʻyxatda boʻlsin.
    if homeroom_id is not None and homeroom_id not in ismlar:
        rahbar = await session.get(User, homeroom_id)
        if rahbar is not None and not rahbar.is_archived:
            ismlar[homeroom_id] = rahbar.full_name
            fanlar[homeroom_id] = set()

    natija = [
        StudentTeacherRow(
            teacher_id=tid,
            full_name=ismlar[tid],
            subjects=sorted(fanlar.get(tid, set())),
            is_homeroom=tid == homeroom_id,
        )
        for tid in ismlar
    ]
    natija.sort(key=lambda r: (not r.is_homeroom, r.full_name))
    return natija


# ─────────────────────────── Oshxona menyusi ───────────────────────────


async def cafeteria_menu(session: AsyncSession) -> dict[int, list[str]]:
    """Haftalik menyu: hafta kuni → taomlar roʻyxati (OTA-08).

    Ochiq maʼlumot — istalgan tizimga kirgan foydalanuvchi koʻradi.
    """
    from app.models import CafeteriaMenuItem

    rows = (
        await session.execute(
            select(CafeteriaMenuItem)
            .where(CafeteriaMenuItem.is_archived.is_(False))
            .order_by(CafeteriaMenuItem.weekday, CafeteriaMenuItem.position)
        )
    ).scalars()
    natija: dict[int, list[str]] = {}
    for item in rows:
        natija.setdefault(item.weekday, []).append(item.dish)
    return natija


async def set_cafeteria_menu(
    session: AsyncSession,
    user: CurrentUser,
    *,
    days: dict[int, list[str]],
    ip: str | None = None,
) -> dict[int, list[str]]:
    """Haftalik menyuni YAXLIT yozadi (choraklar naqshidagi kabi).

    Eski qatorlar arxivlanadi, oʻchirilmaydi (1-qoida). Har oʻzgarish
    auditga tushadi.
    """
    from app.models import CafeteriaMenuItem

    await assert_permission(session, user, Permission.STUDENTS_MANAGE)

    for weekday, dishes in days.items():
        if weekday < 1 or weekday > 7:
            raise ValidationError("Hafta kuni 1–7 oraligʻida boʻlsin.")
        if len(dishes) > 20:
            raise ValidationError("Bir kunga 20 tadan ortiq taom yozilmaydi.")

    eski = list(
        (
            await session.execute(
                select(CafeteriaMenuItem).where(CafeteriaMenuItem.is_archived.is_(False))
            )
        ).scalars()
    )
    for item in eski:
        item.is_archived = True
        item.archived_at = utcnow()

    for weekday, dishes in days.items():
        for i, dish in enumerate(dishes):
            toza = dish.strip()
            if not toza:
                continue
            session.add(CafeteriaMenuItem(weekday=weekday, position=i, dish=toza[:120]))

    audit_service.record(
        session,
        object_type="cafeteria_menu",
        object_id=None,
        action=AuditAction.UPDATE,
        old={"days": len({e.weekday for e in eski})},
        new={"days": len([d for d, v in days.items() if any(x.strip() for x in v)])},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    return await cafeteria_menu(session)


# ─────────────────────────── Maktab rekvizitlari ───────────────────────────


@dataclass(frozen=True, slots=True)
class SchoolInfo:
    name: str
    address: str
    phone: str
    director_name: str


_DEFAULT_SCHOOL = SchoolInfo(
    name="«Tarbion» xususiy maktabi", address="", phone="", director_name=""
)


async def school_settings(session: AsyncSession, user: CurrentUser) -> SchoolInfo:
    """Maktab rekvizitlari — faqat xodimlarga (kvitansiya, hujjatlar)."""
    if not (user.is_staff_wide or user.is_teacher):
        raise PermissionDeniedError("Bu maʼlumot faqat xodimlar uchun.")

    from app.models import SchoolSettings

    row = await session.scalar(
        select(SchoolSettings)
        .where(SchoolSettings.is_archived.is_(False))
        .order_by(SchoolSettings.created_at.desc())
        .limit(1)
    )
    if row is None:
        return _DEFAULT_SCHOOL
    return SchoolInfo(
        name=row.name,
        address=row.address,
        phone=row.phone,
        director_name=row.director_name,
    )


async def set_school_settings(
    session: AsyncSession,
    user: CurrentUser,
    *,
    name: str,
    address: str,
    phone: str,
    director_name: str,
    ip: str | None = None,
) -> SchoolInfo:
    """Rekvizitlarni yangilaydi — eski qator arxivlanadi (tarix qoladi)."""
    from app.models import SchoolSettings

    await assert_permission(session, user, Permission.USERS_MANAGE)

    toza_nom = name.strip()
    if not toza_nom:
        raise ValidationError("Maktab nomi boʻsh boʻlmasin.")

    eski = list(
        (
            await session.execute(
                select(SchoolSettings).where(SchoolSettings.is_archived.is_(False))
            )
        ).scalars()
    )
    for e in eski:
        e.is_archived = True
        e.archived_at = utcnow()

    row = SchoolSettings(
        name=toza_nom[:160],
        address=address.strip()[:200],
        phone=phone.strip()[:40],
        director_name=director_name.strip()[:120],
    )
    session.add(row)
    await session.flush()

    audit_service.record(
        session,
        object_type="school_settings",
        object_id=row.id,
        action=AuditAction.UPDATE,
        old={"name": eski[0].name} if eski else None,
        new={"name": row.name, "director_name": row.director_name},
        actor_id=user.id,
        ip=ip,
    )
    await session.commit()
    return SchoolInfo(
        name=row.name,
        address=row.address,
        phone=row.phone,
        director_name=row.director_name,
    )
