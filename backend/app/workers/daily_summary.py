"""Kunlik davomat xulosasi (T-019, Ilova B).

    uv run python -m app.workers.daily_summary

Har kuni bir marta ishlaydi — `systemd` taymeri chaqiradi. Alohida
jarayon, chunki bu **vaqtga bogʻlangan** ish: hech kim tugmani
bosmaydi, kun tugaydi va xulosa ketadi.

TZ: «Har kuni, darslar tugagach». Amalda oxirgi dars tugash vaqti
sinfdan sinfga farq qiladi, shuning uchun taymer kechqurun ishlaydi va
skript oʻsha KUNGI barcha darslar tugaganini tekshiradi.

Idempotent: bir kun uchun ikki marta ishlatilsa ikkinchi xabar navbatga
tushmaydi. Tekshiruv SHU YERDA, `outbox_service.enqueue` da emas — u
faqat NAVBATDAGI takrorni koʻradi, xabar yuborilgandan keyin esa
koʻrmaydi. Bu davomat xabari uchun toʻgʻri (ustoz «keldi» ga tuzatib,
keyin yana «kelmadi» qilsa ikkinchi xabar ketishi kerak), kunlik xulosa
uchun esa notoʻgʻri boʻlardi: taymer ikki marta ishga tushsa ota-ona
bir xil xabarni ikki marta olardi.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import date, timedelta

from sqlalchemy import func, select

from app.core.db import SessionFactory, engine
from app.core.timeutil import local_today, utcnow
from app.models import (
    AttendanceRecord,
    AttendanceStatus,
    Guardian,
    Lesson,
    NotificationOutbox,
    OutboxStatus,
    Student,
)
from app.services import outbox_service, template_service

#: Xabar turi — foydalanuvchi sozlamalarida oʻchira oladi (Ilova B:
#: «majburiylaridan tashqari»).
KIND = "attendance_daily"


async def _kun_uchun(session, kun: date) -> int:  # noqa: ANN001
    """Bir kunlik xulosalarni navbatga qoʻyadi. Qaytaradi: nechta."""
    # Oʻsha kuni davomati belgilangan oʻquvchilar boʻyicha sanoq.
    rows = await session.execute(
        select(
            AttendanceRecord.student_id,
            AttendanceRecord.status,
            func.count(),
        )
        .join(Lesson, Lesson.id == AttendanceRecord.lesson_id)
        .where(
            Lesson.lesson_date == kun,
            AttendanceRecord.is_archived.is_(False),
        )
        .group_by(AttendanceRecord.student_id, AttendanceRecord.status)
    )

    sanoq: dict[uuid.UUID, dict[str, int]] = {}
    for student_id, status, n in rows.all():
        sanoq.setdefault(student_id, {})[status] = n

    if not sanoq:
        return 0

    student_ids = list(sanoq)
    ism_rows = await session.execute(
        select(Student.id, Student.last_name, Student.first_name).where(
            Student.id.in_(student_ids)
        )
    )
    nomlar = {sid: f"{fam} {ism}".strip() for sid, fam, ism in ism_rows.all()}

    vasiylar: dict[uuid.UUID, list[uuid.UUID]] = {sid: [] for sid in student_ids}
    grows = await session.execute(
        select(Guardian.student_id, Guardian.user_id).where(
            Guardian.student_id.in_(student_ids),
            Guardian.is_archived.is_(False),
        )
    )
    for student_id, user_id in grows.all():
        vasiylar[student_id].append(user_id)

    tpl = await template_service.get(session, KIND)
    kun_matn = kun.strftime("%d.%m.%Y")
    jami = 0

    # Shu kun uchun allaqachon yozilgan xabarlar — bekor qilinganidan
    # boshqa har qanday holatda. Takror ishga tushirishda ular oʻtkazib
    # yuboriladi.
    obyektlar = [_kun_obyekti(sid, kun) for sid in student_ids]
    mavjud_rows = await session.execute(
        select(NotificationOutbox.user_id, NotificationOutbox.object_id).where(
            NotificationOutbox.kind == KIND,
            NotificationOutbox.object_id.in_(obyektlar),
            NotificationOutbox.status != OutboxStatus.CANCELLED.value,
        )
    )
    mavjud = set(mavjud_rows.all())

    for student_id, holatlar in sanoq.items():
        ism = nomlar.get(student_id)
        if ism is None or not vasiylar.get(student_id):
            continue

        # Hammasi «keldi» boʻlsa xabar yubormaymiz: har kuni «hammasi
        # joyida» degan xabar oʻqilmay qoladi va keyin haqiqiy xabar
        # ham eʼtibordan chetda qolardi.
        muhim = sum(
            holatlar.get(s.value, 0)
            for s in (
                AttendanceStatus.ABSENT,
                AttendanceStatus.EXCUSED,
                AttendanceStatus.LATE,
            )
        )
        if muhim == 0:
            continue

        sarlavha, matn = template_service.render(
            tpl,
            student_name=ism,
            date=kun_matn,
            total=sum(holatlar.values()),
            present=holatlar.get(AttendanceStatus.PRESENT.value, 0),
            absent=holatlar.get(AttendanceStatus.ABSENT.value, 0),
            excused=holatlar.get(AttendanceStatus.EXCUSED.value, 0),
            late=holatlar.get(AttendanceStatus.LATE.value, 0),
            class_name=None,
        )
        obyekt = _kun_obyekti(student_id, kun)
        for vasiy_id in vasiylar[student_id]:
            if (vasiy_id, obyekt) in mavjud:
                continue
            qator = await outbox_service.enqueue(
                session,
                user_id=vasiy_id,
                kind=KIND,
                title=sarlavha,
                body=matn,
                # Obyekt — «shu oʻquvchi, shu kun». Takror ishga
                # tushirishda ikkinchi xabar yozilmaydi.
                object_type="attendance_daily",
                object_id=obyekt,
            )
            if qator is not None:
                jami += 1

    await session.commit()
    return jami


def _kun_obyekti(student_id: uuid.UUID, kun: date) -> uuid.UUID:
    """«Oʻquvchi + kun» uchun barqaror id.

    Alohida jadval ochmaslik uchun: takrorni aniqlash `outbox` dagi
    `object_id` ga tayanadi, va u har safar bir xil chiqishi kerak.
    """
    return uuid.uuid5(uuid.NAMESPACE_OID, f"{student_id}:{kun.isoformat()}")


async def main() -> None:
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    # Sukut boʻyicha BUGUN. Argument bilan boshqa kun ham beriladi —
    # taymer tunda ishlab, kechagi kunni yuborishi uchun.
    kun = local_today()
    if len(sys.argv) > 1:
        kun = date.fromisoformat(sys.argv[1]) if sys.argv[1] != "kecha" else kun - timedelta(days=1)

    async with SessionFactory() as session:
        n = await _kun_uchun(session, kun)
    await engine.dispose()
    print(f"{kun}: {n} ta kunlik xulosa navbatga qoʻyildi ({utcnow():%H:%M})")


if __name__ == "__main__":
    asyncio.run(main())
