"""Kirish nazorati (T-005). TZ: NFR-08 va CLAUDE.md 6-, 7-qoidalar.

Bu modul butun tizimdagi eng muhim xavfsizlik nuqtasi. Qoida:

    Oʻquvchi maʼlumotini qaytaradigan HAR BIR soʻrov shu yerdagi
    `accessible_student_ids()` yoki `assert_*` funksiyalaridan oʻtadi.

Frontendda yashirish himoya emas — tekshiruv query darajasida boʻladi
(`WHERE student_id IN (...)`), shunda URL'ni qoʻlda oʻzgartirib boshqa
oilaning maʼlumotiga kirib boʻlmaydi.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models import (
    Guardian,
    Homework,
    Lesson,
    RoleName,
    SchoolClass,
    Student,
    User,
)


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """So'rov davomidagi foydalanuvchi — model emas, oddiy qiymat obyekti."""

    id: uuid.UUID
    full_name: str
    short_name: str
    roles: frozenset[str]

    @classmethod
    def from_model(cls, user: User) -> "CurrentUser":
        return cls(
            id=user.id,
            full_name=user.full_name,
            short_name=user.short_name,
            roles=frozenset(user.role_names),
        )

    def has(self, *roles: str) -> bool:
        return bool(self.roles.intersection(roles))

    @property
    def is_staff_wide(self) -> bool:
        """Butun maktab kesimida koʻra oladigan rollar.

        Oʻquv boʻlimi (`academic`) ham shu yerda: u imtihon, dars rejasi va
        ustozlar faoliyatini BARCHA sinflar kesimida koʻradi. Lekin bu faqat
        oʻquvchi va sinf koʻrinishi — moliya endpointlari paydo boʻlganda
        ular ALOHIDA tekshiruv qoʻyishi kerak, `is_staff_wide` ga tayanmasin:
        oʻquv boʻlimi toʻlov va qarzdorlikni koʻrmaydi.
        """
        return self.has(
            RoleName.ADMIN.value,
            RoleName.DIRECTOR.value,
            RoleName.SUPERADMIN.value,
            RoleName.ACADEMIC.value,
        )

    @property
    def is_teacher(self) -> bool:
        return self.has(RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value)


async def homeroom_class_ids(session: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Foydalanuvchi sinf rahbari boʻlgan sinflar."""
    rows = await session.execute(
        select(SchoolClass.id).where(
            SchoolClass.homeroom_teacher_id == user_id,
            SchoolClass.is_archived.is_(False),
        )
    )
    return set(rows.scalars())


async def taught_class_ids(session: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Ustoz haqiqatda dars beradigan sinflar.

    Manba — `lessons`, `schedule_entries` emas: ADM-10 boʻyicha ustoz
    vaqtincha almashtirilgan boʻlishi mumkin, va oʻsha darsning davomatini
    almashtirgan ustoz belgilaydi.
    """
    rows = await session.execute(
        select(Lesson.class_id)
        .where(Lesson.teacher_id == user_id, Lesson.is_archived.is_(False))
        .distinct()
    )
    return set(rows.scalars())


async def accessible_class_ids(session: AsyncSession, user: CurrentUser) -> set[uuid.UUID] | None:
    """Foydalanuvchi koʻra oladigan sinflar. `None` = cheklov yoʻq (hammasi)."""
    if user.is_staff_wide:
        return None
    ids: set[uuid.UUID] = set()
    if user.is_teacher:
        ids |= await taught_class_ids(session, user.id)
        ids |= await homeroom_class_ids(session, user.id)
    return ids


async def accessible_student_ids(session: AsyncSession, user: CurrentUser) -> set[uuid.UUID] | None:
    """Foydalanuvchi koʻra oladigan oʻquvchilar. `None` = hammasi.

    - admin / direktor / superadmin → hammasi
    - ustoz → oʻzi dars beradigan va sinf rahbari boʻlgan sinflar
    - ota-ona → FAQAT oʻz farzandlari (6-domen qoidasi)
    - oʻquvchi → faqat oʻzi
    """
    if user.is_staff_wide:
        return None

    ids: set[uuid.UUID] = set()

    if user.is_teacher:
        class_ids = await accessible_class_ids(session, user)
        if class_ids:
            rows = await session.execute(
                select(Student.id).where(
                    Student.class_id.in_(class_ids), Student.is_archived.is_(False)
                )
            )
            ids |= set(rows.scalars())

    if user.has(RoleName.PARENT.value):
        rows = await session.execute(
            select(Guardian.student_id).where(
                Guardian.user_id == user.id, Guardian.is_archived.is_(False)
            )
        )
        ids |= set(rows.scalars())

    if user.has(RoleName.STUDENT.value):
        rows = await session.execute(
            select(Student.id).where(Student.user_id == user.id, Student.is_archived.is_(False))
        )
        ids |= set(rows.scalars())

    return ids


async def assert_can_view_student(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> None:
    allowed = await accessible_student_ids(session, user)
    if allowed is None or student_id in allowed:
        return
    # Ataylab 403, 404 emas: mavjudligini oshkor qilmaslik uchun xabar umumiy.
    raise PermissionDeniedError("Bu oʻquvchi maʼlumotini koʻrishga ruxsatingiz yoʻq.")


async def load_lesson_for_teacher(
    session: AsyncSession, user: CurrentUser, lesson_id: uuid.UUID
) -> Lesson:
    """Darsni yuklaydi va ustoz unga tegishli ekanini tekshiradi.

    Admin har qanday darsni ocha oladi (DAV-03: muddat oʻtgach faqat u
    oʻzgartira oladi). Sinf rahbari oʻz sinfining har qanday darsini koʻradi
    (DAV-02).
    """
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None or lesson.is_archived:
        raise NotFoundError("Dars topilmadi.")

    if user.is_staff_wide or lesson.teacher_id == user.id:
        return lesson

    if user.has(RoleName.HOMEROOM_TEACHER.value):
        if lesson.class_id in await homeroom_class_ids(session, user.id):
            return lesson

    raise PermissionDeniedError("Bu dars sizga biriktirilmagan.")


async def load_homework_for_teacher(
    session: AsyncSession, user: CurrentUser, homework_id: uuid.UUID
) -> Homework:
    homework = await session.get(Homework, homework_id)
    if homework is None or homework.is_archived:
        raise NotFoundError("Uy vazifasi topilmadi.")
    if user.is_staff_wide or homework.teacher_id == user.id:
        return homework
    raise PermissionDeniedError("Bu uy vazifasi sizga tegishli emas.")
