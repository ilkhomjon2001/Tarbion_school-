"""Ota-ona kabineti sxemalari (T-016). TZ: OTA-01, OTA-02, OTA-03."""

import uuid
from datetime import date

from pydantic import BaseModel

from app.schemas.attendance import AttendanceStatusLiteral


class ChildOut(BaseModel):
    """Farzand kartochkasi (OTA-02, almashtirgich).

    Telefon, manzil va hujjat maydonlari ATAYLAB yoʻq (X-6) — ota-onaga
    oʻz farzandining sinfi va ismi yetarli, qolgani kerak emas.
    """

    student_id: uuid.UUID
    full_name: str
    short_name: str
    class_name: str
    #: Maktabdan ketgan — faqat qarzi qolgan boʻlsa roʻyxatda koʻrinadi (O7).
    is_archived: bool = False
    relation: str


class LessonStatusOut(BaseModel):
    period: int
    subject: str
    status: AttendanceStatusLiteral
    note: str | None


class DayAttendanceOut(BaseModel):
    """Bitta kunning davomati.

    Faqat DAVOMAT BELGILANGAN darslar. Ustoz hali belgilamagan dars
    bu yerga tushmaydi — «kelmadi» deb koʻrsatib ota-onani bekorga
    xavotirga solmaslik uchun.
    """

    date: date
    lessons: list[LessonStatusOut]
