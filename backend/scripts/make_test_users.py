"""Har bir rol uchun sinov hisoblari (faqat DEMO bazada).

Ishlatish:
    uv run python scripts/make_test_users.py

Nima qiladi:
  · har rol uchun bitta hisob ochadi, login va parol oson va bir xil
  · `must_change_password` ni OʻCHIRADI — sinovda 5 xonali parolni
    almashtirish bosqichi ortiqcha
  · ota-onani haqiqiy oʻquvchiga bogʻlaydi, aks holda u boʻsh ekran
    koʻrardi
  · ustozga jadval va fan biriktiradi, aks holda darslari boʻlmasdi
  · sinf rahbariga sinf biriktiradi

Qayta ishga tushirish xavfsiz: mavjud hisob qayta yaratilmaydi, faqat
paroli tiklanadi.

OGOHLANTIRISH
-------------
Bu skript **demo maʼlumot** uchun. Barcha hisoblarda bir xil, ommaga
maʼlum parol qoʻyiladi — haqiqiy oʻquvchilar maʼlumoti turgan bazada
ishlatilmaydi. Shu sababli u ishga tushishdan oldin bazada demo
belgisini qidiradi.
"""

import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.db import SessionFactory  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    Guardian,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    User,
    UserRole,
)

# Windows konsoli cp1251 da ishlaydi va oʻzbekcha apostrof (U+02BB)
# ni chiqara olmaydi.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]

#: Barcha sinov hisoblari uchun bitta parol.
#: Talab: kamida 8 belgi va faqat raqamdan iborat boʻlmasin.
PAROL = "Tarbion2026"  # noqa: S105


@dataclass(frozen=True, slots=True)
class SinovHisob:
    login: str
    last_name: str
    first_name: str
    roles: list[str]
    izoh: str


HISOBLAR = [
    SinovHisob(
        "admin.test", "Admin", "Test", [RoleName.ADMIN.value],
        "Maʼlumotnoma, qabul, toʻlov, xodimlar, huquqlar",
    ),
    SinovHisob(
        "rahbar.test", "Rahbar", "Test", [RoleName.DIRECTOR.value],
        "Faqat hisobot va analitika",
    ),
    SinovHisob(
        "oquvbolim.test", "Oquvbolim", "Test", [RoleName.ACADEMIC.value],
        "Jadval, imtihon, sifat nazorati",
    ),
    SinovHisob(
        "ustoz.test", "Ustoz", "Test", [RoleName.TEACHER.value],
        "Davomat, baho, uy vazifasi, testlar",
    ),
    SinovHisob(
        "sinfrahbar.test", "Sinfrahbar", "Test",
        [RoleName.TEACHER.value, RoleName.HOMEROOM_TEACHER.value],
        "Ustoz + oʻz sinfi boʻyicha kengaytirilgan huquq",
    ),
    SinovHisob(
        "otaona.test", "Otaona", "Test", [RoleName.PARENT.value],
        "Faqat oʻz farzandi",
    ),
]


async def _demo_bazami(session: AsyncSession) -> bool:
    """Bazada demo maʼlumot borligini taxminan aniqlaydi.

    Aniq belgi yoʻq, shuning uchun seed qoldirgan iz qidiriladi:
    demo oʻquvchilar `Abdullayev`, `Aliyev` kabi takrorlanuvchi
    familiyalar bilan yaratiladi va ularning soni 300 dan oshadi.
    Bu kafolat emas — oxirgi qaror odamda (`--force`).
    """
    soni = await session.scalar(select(func.count()).select_from(Student))
    return (soni or 0) >= 100


async def _rol(session: AsyncSession, nom: str) -> Role:
    rol = await session.scalar(select(Role).where(Role.name == nom))
    if rol is None:
        raise SystemExit(f"'{nom}' roli topilmadi — migratsiyani tekshiring.")
    return rol


async def _hisob_yarat(session: AsyncSession, h: SinovHisob) -> tuple[User, bool]:
    user = await session.scalar(select(User).where(User.login == h.login))
    yangi = user is None

    if user is None:
        user = User(
            login=h.login,
            password_hash=hash_password(PAROL),
            last_name=h.last_name,
            first_name=h.first_name,
        )
        session.add(user)
        await session.flush()
        for nom in h.roles:
            session.add(UserRole(user_id=user.id, role_id=(await _rol(session, nom)).id))
    else:
        user.password_hash = hash_password(PAROL)

    # Sinovda 5 xonali parolni almashtirish bosqichi ortiqcha.
    user.must_change_password = False
    user.is_active = True
    user.is_archived = False
    await session.flush()
    return user, yangi


async def _ustozga_dars(session: AsyncSession, ustoz: User) -> str:
    """Jadvalda boʻsh joy topib dars biriktiradi.

    Jadvalsiz ustozning kabineti boʻsh koʻrinadi: bugungi darslar ham,
    jurnal ham, uy vazifasi ham jadvalga tayanadi.
    """
    bor = await session.scalar(
        select(func.count())
        .select_from(ScheduleEntry)
        .where(ScheduleEntry.teacher_id == ustoz.id, ScheduleEntry.is_archived.is_(False))
    )
    if bor:
        return f"jadvalda {bor} ta dars bor"

    fan = await session.scalar(select(Subject).where(Subject.is_archived.is_(False)))
    sinf = await session.scalar(
        select(SchoolClass).where(SchoolClass.is_archived.is_(False)).order_by(SchoolClass.name)
    )
    if fan is None or sinf is None:
        return "fan yoki sinf yoʻq"

    if not await session.scalar(
        select(TeacherSubject).where(
            TeacherSubject.teacher_id == ustoz.id, TeacherSubject.subject_id == fan.id
        )
    ):
        session.add(TeacherSubject(teacher_id=ustoz.id, subject_id=fan.id))

    band = {
        (w, p)
        for w, p in (
            await session.execute(
                select(ScheduleEntry.weekday, ScheduleEntry.period).where(
                    ScheduleEntry.academic_year_id == sinf.academic_year_id,
                    ScheduleEntry.is_archived.is_(False),
                    ScheduleEntry.class_id == sinf.id,
                )
            )
        ).all()
    }

    qoshildi = 0
    for weekday in range(1, 6):
        for period in (7, 8):
            if (weekday, period) in band or qoshildi >= 4:
                continue
            session.add(
                ScheduleEntry(
                    academic_year_id=sinf.academic_year_id,
                    class_id=sinf.id,
                    subject_id=fan.id,
                    teacher_id=ustoz.id,
                    weekday=weekday,
                    period=period,
                    room="T1",
                )
            )
            qoshildi += 1

    await session.flush()
    return f"{sinf.name} · {fan.name} · {qoshildi} ta dars sloti"


async def _sinf_rahbari(session: AsyncSession, ustoz: User) -> str:
    """Rahbarsiz sinf topib biriktiradi.

    Mavjud rahbarni almashtirmaymiz: demo maʼlumotdagi bogʻlanishlar
    buzilmasin.
    """
    sinf = await session.scalar(
        select(SchoolClass)
        .where(
            SchoolClass.is_archived.is_(False),
            SchoolClass.homeroom_teacher_id.is_(None),
        )
        .order_by(SchoolClass.name)
    )
    if sinf is not None:
        sinf.homeroom_teacher_id = ustoz.id
        await session.flush()
        return sinf.name

    mavjud = await session.scalar(
        select(SchoolClass).where(SchoolClass.homeroom_teacher_id == ustoz.id)
    )
    if mavjud is not None:
        return f"{mavjud.name} (avvaldan)"

    # Demo seedda hamma sinfning rahbari bor. Yangi boʻsh sinf ochish
    # foydasiz — oʻquvchisiz sinfda koʻriladigan narsa yoʻq. Shuning
    # uchun mavjud sinfning rahbarini almashtiramiz: siljigan ustoz
    # oʻz fanini oʻqitishda davom etadi, faqat rahbarlik oʻtadi.
    band = await session.scalar(
        select(SchoolClass)
        .where(SchoolClass.is_archived.is_(False))
        .order_by(SchoolClass.name.desc())
    )
    if band is None:
        return "sinf topilmadi"
    band.homeroom_teacher_id = ustoz.id
    await session.flush()
    return f"{band.name} (rahbarlik oʻtkazildi)"


async def _otaonaga_farzand(session: AsyncSession, ota: User) -> str:
    """Vasiylikni biriktiradi.

    Farzandsiz ota-ona kabinetida hech narsa koʻrinmaydi — X-1
    boʻyicha u faqat `guardians` orqali bogʻlangan oʻquvchini koʻradi.
    """
    bor = await session.scalar(
        select(Guardian).where(Guardian.user_id == ota.id, Guardian.is_archived.is_(False))
    )
    if bor:
        student = await session.get(Student, bor.student_id)
        return f"{student.full_name} (avvaldan)" if student else "bogʻlangan"

    # Baholari va davomati bor oʻquvchi tanlanadi — boʻsh kartochka
    # sinov uchun foydasiz.
    student = await session.scalar(
        select(Student)
        .where(Student.is_archived.is_(False), Student.class_id.is_not(None))
        .order_by(Student.last_name)
    )
    if student is None:
        return "oʻquvchi topilmadi"

    session.add(Guardian(student_id=student.id, user_id=ota.id, relation="father", is_primary=True))
    await session.flush()
    return student.full_name


async def main() -> int:
    force = "--force" in sys.argv

    async with SessionFactory() as session:
        if not await _demo_bazami(session) and not force:
            print("Bazada demo maʼlumot koʻrinmadi.")
            print("Bu skript barcha hisoblarga BIR XIL, ommaga maʼlum parol qoʻyadi.")
            print("Haqiqiy maʼlumot turgan bazada ishlatmang. Ishonchingiz komil boʻlsa: --force")
            return 1

        print(f"Sinov hisoblari · parol: {PAROL}\n")
        kenglik = max(len(h.login) for h in HISOBLAR)

        for h in HISOBLAR:
            user, yangi = await _hisob_yarat(session, h)
            qoshimcha = ""

            if RoleName.HOMEROOM_TEACHER.value in h.roles:
                sinf = await _sinf_rahbari(session, user)
                dars = await _ustozga_dars(session, user)
                qoshimcha = f"sinf: {sinf} · {dars}"
            elif RoleName.TEACHER.value in h.roles:
                qoshimcha = await _ustozga_dars(session, user)
            elif RoleName.PARENT.value in h.roles:
                qoshimcha = f"farzand: {await _otaonaga_farzand(session, user)}"

            belgi = "yangi" if yangi else "yangilandi"
            print(f"  {h.login:<{kenglik}}  {belgi:<10} {h.izoh}")
            if qoshimcha:
                print(f"  {'':<{kenglik}}  {'':<10} {qoshimcha}")

        await session.commit()

    if settings.require_two_factor:
        print("\nEslatma: admin va rahbar rollarida 2FA MAJBURIY (X-14).")
        print("Ular birinchi kirishda /ikki-bosqich sahifasiga tushadi.")
        print("Sinov uchun oʻchirish: .env da REQUIRE_TWO_FACTOR=false")
    else:
        print("\n2FA majburiyligi OʻCHIRILGAN (REQUIRE_TWO_FACTOR=false).")
        print("Hamma rol faqat login va parol bilan kiradi.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
