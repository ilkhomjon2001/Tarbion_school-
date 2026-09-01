"""Ota-ona kabineti endpointlari (T-016). TZ: OTA-01, OTA-02, OTA-03.

Kabinet HAR DOIM "mening farzandlarim" roʻyxatidan boshlanadi. Ota-ona
`student_id` ni oʻylab topa olmasligi kerak — id lar shu roʻyxatdan
keladi va har bir soʻrovda `access.py` qaytadan tekshiradi (X-1).

Bu router faqat ota-onaga ochiq emas: administrator va sinf rahbari ham
ayni maʼlumotni koʻrishi mumkin. Kim nimani koʻrishini `access.py` hal
qiladi, rol darvozasi emas.
"""

import uuid
from datetime import date

from fastapi import APIRouter

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.core.timeutil import local_today
from app.schemas.parent import ChildOut, DayAttendanceOut, LessonStatusOut
from app.services import parent_service

router = APIRouter(prefix="/parent", tags=["parent"])


@router.get("/children", response_model=list[ChildOut])
async def my_children(user: CurrentUserDep, session: SessionDep) -> list[ChildOut]:
    """Vasiyning farzandlari (OTA-02).

    Boʻsh roʻyxat — xato emas: vasiy hali bolaga biriktirilmagan boʻlishi
    mumkin. Kabinet «Farzand biriktirilmagan» matnini koʻrsatadi.
    """
    rows = await parent_service.my_children(session, user)
    return [
        ChildOut(
            student_id=r.student_id,
            full_name=r.full_name,
            short_name=r.short_name,
            class_name=r.class_name,
            relation=r.relation,
            is_archived=r.is_archived,
        )
        for r in rows
    ]


@router.get("/children/{student_id}/attendance", response_model=list[DayAttendanceOut])
async def child_attendance(
    student_id: uuid.UUID,
    user: CurrentUserDep,
    session: SessionDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[DayAttendanceOut]:
    """Farzandning kunma-kun davomati (OTA-03, kalendar).

    Sana berilmasa — joriy oy. Mahalliy kun boʻyicha (CLAUDE.md
    3-qoida): UTC kuni olinsa oyning birinchi kuni tushib qolardi.

    Begona bolaning id si berilsa `403` (X-3: `404` emas — u obyekt
    mavjudligini oshkor qilardi).
    """
    bugun = local_today()
    boshi = date_from or bugun.replace(day=1)
    oxiri = date_to or bugun

    kunlar = await parent_service.child_attendance(
        session, user, student_id, date_from=boshi, date_to=oxiri
    )
    return [
        DayAttendanceOut(
            date=k.day,
            lessons=[
                LessonStatusOut(
                    period=lesson.period,
                    subject=lesson.subject,
                    status=lesson.status,  # type: ignore[arg-type]
                    note=lesson.note,
                )
                for lesson in k.lessons
            ],
        )
        for k in kunlar
    ]
