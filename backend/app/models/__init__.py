"""Barcha modellar shu yerdan import qilinadi.

Alembic autogenerate `Base.metadata` ni toʻliq koʻrishi uchun har bir model
shu yerda roʻyxatdan oʻtishi shart — aks holda jadval migratsiyaga tushmaydi.
"""

from app.models.academic import AcademicYear, BellSchedule, Holiday, Term
from app.models.announcements import (
    Announcement,
    AnnouncementAudience,
    AnnouncementClass,
)
from app.models.appeals import (
    APPEAL_STATUS_LABELS_UZ,
    APPEAL_TARGET_LABELS_UZ,
    CONTACT_KIND_LABELS_UZ,
    Appeal,
    AppealMessage,
    AppealNote,
    AppealStatus,
    AppealTarget,
    ContactKind,
)
from app.models.attendance import ATTENDANCE_LABELS_UZ, AttendanceRecord, AttendanceStatus
from app.models.audit import AuditAction, AuditLog
from app.models.base import AppendOnly, Base, Entity
from app.models.documents import (
    DOCUMENT_TYPE_LABELS_UZ,
    DocumentRequest,
    DocumentStatus,
    DocumentType,
)
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
    TwoFactorRecoveryCode,
    User,
    UserPermission,
    UserRole,
)
from app.models.notifications import (
    NOTIFICATION_KIND_LABELS_UZ,
    Notification,
    NotificationKind,
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
from app.models.tests import (
    QUESTION_KIND_LABELS_UZ,
    TEST_STATUS_LABELS_UZ,
    QuestionKind,
    Test,
    TestAnswer,
    TestAttempt,
    TestOption,
    TestQuestion,
    TestStatus,
)
from app.models.wellbeing import (
    TONE_LABELS_UZ,
    WellbeingKind,
    WellbeingNote,
    WellbeingTone,
)

__all__ = [
    "DOCUMENT_TYPE_LABELS_UZ",
    "DocumentRequest",
    "DocumentStatus",
    "DocumentType",
    "TONE_LABELS_UZ",
    "WellbeingKind",
    "WellbeingNote",
    "WellbeingTone",
    "Announcement",
    "AnnouncementAudience",
    "AnnouncementClass",
    "AcademicYear",
    "APPEAL_STATUS_LABELS_UZ",
    "APPEAL_TARGET_LABELS_UZ",
    "Appeal",
    "AppealMessage",
    "AppealNote",
    "AppealStatus",
    "AppealTarget",
    "AppendOnly",
    "ATTENDANCE_LABELS_UZ",
    "AttendanceRecord",
    "AttendanceStatus",
    "AuditAction",
    "AuditLog",
    "Base",
    "BellSchedule",
    "ClassSubject",
    "CONTACT_KIND_LABELS_UZ",
    "ContactKind",
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
    "NOTIFICATION_KIND_LABELS_UZ",
    "Notification",
    "NotificationKind",
    "Permission",
    "RefreshToken",
    "Role",
    "RoleName",
    "SCALE_MAX",
    "ScheduleEntry",
    "SchoolClass",
    "Student",
    "Subject",
    "SUBMISSION_LABELS_UZ",
    "SubmissionStatus",
    "TeacherSubject",
    "TwoFactorRecoveryCode",
    "Test",
    "TestAnswer",
    "TestAttempt",
    "TestOption",
    "TestQuestion",
    "TEST_STATUS_LABELS_UZ",
    "TestStatus",
    "QUESTION_KIND_LABELS_UZ",
    "QuestionKind",
    "Term",
    "User",
    "UserPermission",
    "UserRole",
]
