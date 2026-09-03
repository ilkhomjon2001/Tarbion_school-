"""Playwright oqimi uchun deterministik maʼlumot (T-023).

    uv run python -m app.e2e_seed

Nima yaratiladi: bitta sinf, bitta fan, bitta ustoz, bitta oʻquvchi va
uning vasiysi, hamda **BUGUNGI** dars. Shu qadar — E2E oqimi tekshiradigan
zanjir aynan shu: ustoz davomat belgilaydi → ota-ona koʻradi.

Idempotent: qayta ishga tushirilsa mavjud yozuvlarni topib ishlatadi.
Playwright har safar toza bazani kutmaydi.

**Bu skript ishlab chiqarishda ishlamaydi.** `APP_ENV=production` boʻlsa
darhol toʻxtaydi: u qatʼiy login va qatʼiy parol bilan hisob ochadi va
real bazada bunday hisob turishi — ochiq eshik.

Loginlar qatʼiy (`e2e.ustoz`, `e2e.otaona`), parol `E2E_PASSWORD` dan.
"""

import argparse
import asyncio
import os
import sys
from datetime import date, time

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import SessionFactory
from app.core.security import hash_password
from app.core.timeutil import combine_local, local_today
from app.models import (
    AcademicYear,
    AttendanceRecord,
    BellSchedule,
    ClassSubject,
    Guardian,
    Lesson,
    Role,
    RoleName,
    ScheduleEntry,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
    User,
)

USTOZ_LOGIN = "e2e.ustoz"
OTAONA_LOGIN = "e2e.otaona"
SINF_NOMI = "E2E-1"
FAN_NOMI = "E2E matematika"
PARA = 1
BOSHLANISH = time(8, 30)
TUGASH = time(9, 15)


async def _rol(session: AsyncSession, nom: str) -> Role:
    rol = await session.scalar(select(Role).where(Role.name == nom))
    if rol is None:
        raise SystemExit(f"«{nom}» roli yoʻq — avval `alembic upgrade head` qiling.")
    return rol


async def _hisob(
    session: AsyncSession, *, login: str, last: str, first: str, rol: str, parol: str
) -> User:
    user = await session.scalar(select(User).where(User.login == login))
    if user is None:
        user = User(login=login, last_name=last, first_name=first)
        session.add(user)
    # Parol HAR SAFAR qayta qoʻyiladi: `E2E_PASSWORD` oʻzgargan boʻlishi
    # mumkin va eski xesh bilan test jimgina yiqilardi.
    user.password_hash = hash_password(parol)
    user.must_change_password = False
    user.is_archived = False
    user.roles = [await _rol(session, rol)]
    await session.flush()
    return user


async def run(parol: str) -> None:
    async with SessionFactory() as session:
        bugun = local_today()

        # ── Oʻquv yili: mavjudi olinadi, yoʻq boʻlsa yaratiladi ──
        yil = await session.scalar(select(AcademicYear).where(AcademicYear.is_current.is_(True)))
        if yil is None:
            yil = AcademicYear(
                name=f"{bugun.year}-{bugun.year + 1}",
                starts_on=date(bugun.year, 9, 1),
                ends_on=date(bugun.year + 1, 5, 25),
                is_current=True,
            )
            session.add(yil)
            await session.flush()

        qongiroq = await session.scalar(
            select(BellSchedule).where(
                BellSchedule.academic_year_id == yil.id, BellSchedule.period == PARA
            )
        )
        if qongiroq is None:
            session.add(
                BellSchedule(
                    academic_year_id=yil.id,
                    period=PARA,
                    starts_at=BOSHLANISH,
                    ends_at=TUGASH,
                )
            )
            await session.flush()

        # ── Ustoz, fan, sinf ──
        ustoz = await _hisob(
            session,
            login=USTOZ_LOGIN,
            last="Sinovov",
            first="Ustoz",
            rol=RoleName.TEACHER.value,
            parol=parol,
        )

        fan = await session.scalar(select(Subject).where(Subject.name == FAN_NOMI))
        if fan is None:
            fan = Subject(name=FAN_NOMI, short_name="E2E")
            session.add(fan)
            await session.flush()

        if not await session.scalar(
            select(TeacherSubject.id).where(
                TeacherSubject.teacher_id == ustoz.id, TeacherSubject.subject_id == fan.id
            )
        ):
            session.add(TeacherSubject(teacher_id=ustoz.id, subject_id=fan.id))

        sinf = await session.scalar(select(SchoolClass).where(SchoolClass.name == SINF_NOMI))
        if sinf is None:
            sinf = SchoolClass(academic_year_id=yil.id, name=SINF_NOMI)
            session.add(sinf)
            await session.flush()
        sinf.homeroom_teacher_id = ustoz.id

        if not await session.scalar(
            select(ClassSubject.id).where(
                ClassSubject.class_id == sinf.id, ClassSubject.subject_id == fan.id
            )
        ):
            session.add(ClassSubject(class_id=sinf.id, subject_id=fan.id, weekly_hours=1))

        # ── Oʻquvchi va vasiy ──
        oquvchi = await session.scalar(
            select(Student).where(
                Student.last_name == "Sinovov", Student.first_name == "Oʻquvchi"
            )
        )
        if oquvchi is None:
            oquvchi = Student(class_id=sinf.id, last_name="Sinovov", first_name="Oʻquvchi")
            session.add(oquvchi)
            await session.flush()
        oquvchi.class_id = sinf.id
        oquvchi.is_archived = False

        otaona = await _hisob(
            session,
            login=OTAONA_LOGIN,
            last="Sinovov",
            first="Otasi",
            rol=RoleName.PARENT.value,
            parol=parol,
        )
        if not await session.scalar(
            select(Guardian.id).where(
                Guardian.student_id == oquvchi.id, Guardian.user_id == otaona.id
            )
        ):
            session.add(
                Guardian(
                    student_id=oquvchi.id,
                    user_id=otaona.id,
                    relation="father",
                    is_primary=True,
                )
            )

        # ── Jadval va BUGUNGI dars ──
        #
        # Dars aynan bugunga: DAV-03 oynasi (24 soat) ochiq boʻlishi
        # kerak, aks holda ustoz davomat belgilay olmasdi va test
        # sababini tushunib boʻlmaydigan tarzda yiqilardi.
        slot = await session.scalar(
            select(ScheduleEntry).where(
                ScheduleEntry.academic_year_id == yil.id,
                ScheduleEntry.class_id == sinf.id,
                ScheduleEntry.period == PARA,
                ScheduleEntry.weekday == bugun.isoweekday(),
            )
        )
        if slot is None:
            slot = ScheduleEntry(
                academic_year_id=yil.id,
                class_id=sinf.id,
                subject_id=fan.id,
                teacher_id=ustoz.id,
                weekday=bugun.isoweekday(),
                period=PARA,
            )
            session.add(slot)
            await session.flush()
        slot.teacher_id = ustoz.id
        slot.subject_id = fan.id
        slot.is_archived = False

        dars = await session.scalar(
            select(Lesson).where(
                Lesson.class_id == sinf.id,
                Lesson.lesson_date == bugun,
                Lesson.period == PARA,
            )
        )
        if dars is None:
            dars = Lesson(
                schedule_entry_id=slot.id,
                class_id=sinf.id,
                subject_id=fan.id,
                teacher_id=ustoz.id,
                lesson_date=bugun,
                period=PARA,
                starts_at=combine_local(bugun, BOSHLANISH),
                ends_at=combine_local(bugun, TUGASH),
            )
            session.add(dars)
        else:
            dars.teacher_id = ustoz.id
            dars.is_archived = False
        # `dars.id` pastdagi tozalash uchun kerak — yangi yozuv boʻlsa
        # flush'gacha u `None` boʻlardi va DELETE hech narsani
        # tozalamasdan jimgina oʻtib ketardi.
        await session.flush()

        # ── Davomatni TOZALASH ──
        #
        # E2E oqimi «ustoz belgilaydi → saqlaydi → ota-ona koʻradi»
        # zanjirini tekshiradi. Yozuv oldingi yugurishdan qolgan boʻlsa
        # katak allaqachon «Kelmadi» boʻlib turadi, «Saqlash» tugmasi
        # oʻchiq boʻladi va test SAQLASH yoʻlini umuman bosib
        # oʻtmasdan «oʻtdi» deb chiqadi. Bir marta shunday boʻlgan.
        #
        # Bu yerda haqiqiy DELETE — 1-domen qoidasiga zid emas: bu
        # domen maʼlumoti emas, test iskalasi, va skript
        # `APP_ENV=production` da umuman ishlamaydi.
        await session.execute(
            delete(AttendanceRecord).where(AttendanceRecord.lesson_id == dars.id)
        )
        dars.attendance_marked_at = None

        await session.commit()

    print(f"E2E maʼlumot tayyor: {USTOZ_LOGIN}, {OTAONA_LOGIN}, sinf {SINF_NOMI}, {bugun}")


def main() -> None:
    parser = argparse.ArgumentParser(description="E2E oqimi uchun maʼlumot")
    parser.parse_args()

    if settings.is_production:
        sys.exit("APP_ENV=production — E2E maʼlumoti real bazaga yozilmaydi.")

    parol = os.environ.get("E2E_PASSWORD", "")
    if len(parol) < 8:
        sys.exit("E2E_PASSWORD kerak (kamida 8 belgi).")

    asyncio.run(run(parol))


if __name__ == "__main__":
    main()
