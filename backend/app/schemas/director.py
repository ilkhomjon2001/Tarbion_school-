"""Rahbariyat hisobotlari sxemalari. TZ: DIR-01…DIR-04.

MUHIM: bu yerda moliya maydonlari YOʻQ. Frontenddagi rahbariyat kabineti
tushum, qarzdorlik va toʻlov grafigini koʻrsatadi, lekin bazada hali
bironta moliya jadvali yoʻq (`payments`, `tuition_contracts` — 2-bosqich).
Boʻsh yoki nol qiymat qaytarish yolgʻon boʻlardi: rahbar «qarzdorlik 0»
deb oʻqib, xato qaror qabul qilishi mumkin. Shu sabab maydon umuman
qaytarilmaydi va frontend uni mock'dan olishda davom etadi.
"""

import uuid

from pydantic import BaseModel


class AttendancePoint(BaseModel):
    date: str
    percent: float


class DirectorOverviewOut(BaseModel):
    total_students: int
    total_teachers: int
    total_classes: int
    # Davr boʻyicha davomat foizi — kelgan (present + late) ulushi.
    attendance_percent: float
    average_grade: float
    lessons_conducted: int
    attendance_trend: list[AttendancePoint]


class ClassRowOut(BaseModel):
    id: uuid.UUID
    name: str
    homeroom_teacher_name: str | None
    student_count: int
    attendance_percent: float
    average_grade: float


class TeacherRowOut(BaseModel):
    id: uuid.UUID
    full_name: str
    short_name: str
    subjects: list[str]
    homeroom_class_name: str | None
    weekly_hours: int
    lessons_conducted: int
    average_grade_given: float
    grades_given: int
