"""Barcha modellar shu yerdan import qilinadi.

Alembic autogenerate `Base.metadata` ni toʻliq koʻrishi uchun har bir model
shu yerda roʻyxatdan oʻtishi shart — aks holda jadval migratsiyaga tushmaydi.
"""

from app.models.academic import AcademicYear, BellSchedule, Holiday, Term
from app.models.attendance import ATTENDANCE_LABELS_UZ, AttendanceRecord, AttendanceStatus
from app.models.audit import AuditAction, AuditLog
from app.models.base import AppendOnly, Base, Entity
from app.models.homework import (
    SCALE_MAX,
    SUBMISSION_LABELS_UZ,
    Grade,
    GradeKind,
    GradingScale,
    Homework,
    HomeworkSubmission,
    SubmissionStatus,
)
from app.models.identity import (
    LoginAttempt,
    LoginLog,
    Permission,
    RefreshToken,
    Role,
    RoleName,
    User,
    UserPermission,
    UserRole,
)
from app.models.scheduling import Lesson, ScheduleEntry
from app.models.school import (
    ClassSubject,
    Guardian,
    GuardianRelation,
    SchoolClass,
    Student,
    Subject,
    TeacherSubject,
)

__all__ = [
    "ATTENDANCE_LABELS_UZ",
    "SCALE_MAX",
    "SUBMISSION_LABELS_UZ",
    "AcademicYear",
    "AppendOnly",
    "AttendanceRecord",
    "AttendanceStatus",
    "AuditAction",
    "AuditLog",
    "Base",
    "BellSchedule",
    "ClassSubject",
    "Entity",
    "Grade",
    "GradeKind",
    "GradingScale",
    "Guardian",
    "GuardianRelation",
    "Holiday",
    "Homework",
    "HomeworkSubmission",
    "Lesson",
    "LoginAttempt",
    "LoginLog",
    "Permission",
    "RefreshToken",
    "Role",
    "RoleName",
    "ScheduleEntry",
    "SchoolClass",
    "Student",
    "SubmissionStatus",
    "Subject",
    "TeacherSubject",
    "Term",
    "User",
    "UserPermission",
    "UserRole",
]
