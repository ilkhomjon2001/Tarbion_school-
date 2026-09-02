"""Foydalanuvchi, rol, sessiya va kirish jurnali (T-003, T-004).

TZ: AUT-01, AUT-04, AUT-05, AUT-06, AUT-07.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AppendOnly, Base, Entity, UUIDPk


class RoleName(enum.StrEnum):
    """Rollar. Frontenddagi `lib/roles.ts` bilan bir xil boʻlishi shart.

    `homeroom_teacher` — ustozning ustiga qoʻshiladigan rol (sinf rahbari),
    alohida kabineti yoʻq. `academic` — oʻquv boʻlimi kabineti.
    """

    STUDENT = "student"
    PARENT = "parent"
    TEACHER = "teacher"
    HOMEROOM_TEACHER = "homeroom_teacher"
    # Oʻquv boʻlimi: imtihon, dars rejasi, sifat nazorati. Maktab rahbari
    # soʻragan alohida rol — administratordan farqli, moliya va qabulga
    # tegmaydi.
    ACADEMIC = "academic"
    ADMIN = "admin"
    DIRECTOR = "director"
    SUPERADMIN = "superadmin"


class Role(Base, UUIDPk):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(200), default="")


class User(Entity):
    """AUT-07: foydalanuvchi oʻchirilmaydi, faqat faolsizlantiriladi/arxivlanadi."""

    __tablename__ = "users"

    # Kirish identifikatori — `familiya.ism` (app/core/naming.py).
    # Foydalanuvchi tanlamaydi, administrator hisob ochganda tizim yasaydi.
    login: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Telefon endi kirish uchun EMAS — aloqa va SMS uchun. Oʻquvchilarda
    # telefon boʻlmasligi mumkin, shuning uchun majburiy emas.
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)

    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(80), nullable=True)

    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    telegram_id: Mapped[int | None] = mapped_column(nullable=True, index=True)

    is_active: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    # Parol majburiy almashtirilishi kerakmi (hisob admin tomonidan yaratilganda).
    must_change_password: Mapped[bool] = mapped_column(
        default=False, server_default="false", nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Super administrator belgilagan boʻlimlar roʻyxati (T-005).
    #
    # `None` — rol standarti ishlaydi. Roʻyxat berilgan boʻlsa u ustun
    # turadi. JSONB ustun ataylab: alohida jadval boʻlsa "boʻsh roʻyxat"
    # va "istisno yoʻq" holatlari farqlanmasdi, va har sahifa yuklashda
    # qoʻshimcha JOIN kerak boʻlardi. Oʻzgarish tarixi `audit_log` da.
    section_overrides: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    # --- Ikki bosqichli tasdiqlash (X-14) ---
    #
    # Sekret PAROL EMAS, lekin unga teng qiymatga ega: uni bilgan odam
    # istalgan kodni yasay oladi. Shu sababli u hech qachon javobda
    # qaytmaydi — faqat sozlash paytida bir marta.
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    totp_enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Oxirgi ishlatilgan qadam — bir kod ikki marta ishlatilmasin.
    # Yelka ortidan koʻrgan odam oʻsha 30 soniyada kira olmasin.
    totp_last_step: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    @property
    def two_factor_enabled(self) -> bool:
        return self.totp_enabled_at is not None and self.totp_secret is not None

    roles: Mapped[list[Role]] = relationship(
        secondary="user_roles", lazy="selectin", order_by=Role.name
    )

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name, self.middle_name or ""]
        return " ".join(p for p in parts if p).strip()

    @property
    def short_name(self) -> str:
        """ "Aliyev S." koʻrinishi — jadval ustunlariga sigʻishi uchun."""
        initial = f"{self.first_name[0]}." if self.first_name else ""
        return f"{self.last_name} {initial}".strip()

    @property
    def role_names(self) -> list[str]:
        return [r.name for r in self.roles]


class UserRole(Base):
    """AUT-04: bir foydalanuvchi bir nechta rolga ega boʻlishi mumkin."""

    __tablename__ = "user_roles"
    # UniqueConstraint ataylab yoʻq: birlamchi kalitning oʻzi (user_id, role_id)
    # takrorlanishni taqiqlaydi. Qoʻshimcha UNIQUE bir xil ustunlar boʻyicha
    # yozilganda Postgres uni yaratmaydi, Alembic esa har autogenerate da
    # "yetishmayapti" deb qayta-qayta migratsiya yozib beradi.

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )


class RefreshToken(Base, UUIDPk):
    """Refresh token sessiyasi — aylantirish va qayta ishlatishni aniqlash bilan.

    Token ochiq saqlanmaydi, faqat sha256 xeshi. Har yangilashda eski token
    bekor qilinadi va yangisi beriladi (rotation). Bekor qilingan token
    qaytadan kelsa — oʻgʻirlangan deb hisoblanadi va butun "oila" (family)
    bekor qilinadi, ya'ni oʻgʻri ham, egasi ham chiqarib yuboriladi.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_tokens_user_active", "user_id", "revoked_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Bitta qurilmadagi ketma-ket tokenlar bitta oilaga tegishli.
    family_id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(String(40))

    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(INET)


class LoginAttempt(AppendOnly):
    """AUT-05: ketma-ket 5 marta notoʻgʻri parol → 15 daqiqa blok.

    Redis ishlatilmaydi (DECISIONS.md), shuning uchun hisoblash shu jadvaldan.
    """

    __tablename__ = "login_attempts"
    __table_args__ = (Index("ix_login_attempts_login_time", "login", "created_at"),)

    # Foydalanuvchi topilmasa ham yoziladi (mavjud boʻlmagan login bilan
    # urinish ham hisoblanadi), shuning uchun user_id emas, loginning oʻzi.
    login: Mapped[str] = mapped_column(String(64), nullable=False)
    successful: Mapped[bool] = mapped_column(nullable=False)
    ip_address: Mapped[str | None] = mapped_column(INET)


class LoginLog(AppendOnly):
    """AUT-06: har bir kirish urinishi (sana, IP, qurilma) jurnalga yoziladi."""

    __tablename__ = "login_log"
    __table_args__ = (Index("ix_login_log_user_time", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(255))


class Permission(enum.StrEnum):
    """Rolga qoʻshimcha beriladigan aniq huquqlar.

    Rol nima koʻrishini belgilaydi, huquq esa nima QILA OLISHINI. Ikkalasi
    alohida, chunki maktabda ikkita administrator bir xil kabinetda ishlab,
    biri hisob ocha oladi, ikkinchisi yoʻq.

    Superadministratorga bularning hech biri berilmaydi — u hammasiga ega
    (`has_permission` ga qara).
    """

    # ── Foydalanuvchilar ──
    USERS_CREATE = "users.create"
    USERS_MANAGE = "users.manage"
    USERS_RESET_PASSWORD = "users.reset_password"  # noqa: S105 — huquq nomi, parol emas
    PERMISSIONS_GRANT = "permissions.grant"

    # ── Oʻquv jarayoni ──
    #: DAV-03 oynasi yopilgandan keyin ham davomatni tuzatish.
    ATTENDANCE_EDIT_CLOSED = "attendance.edit_closed"
    #: Dars jadvalini tuzish va oʻzgartirish (ADM-09).
    SCHEDULE_MANAGE = "schedule.manage"
    #: Oʻquvchi qabul qilish, sinfga koʻchirish, arxivlash.
    STUDENTS_MANAGE = "students.manage"

    # ── Moliya ──
    #: Toʻlov kiritish va storno (TOL-07).
    PAYMENTS_MANAGE = "payments.manage"

    # ── Maʼlumot chiqarish ──
    #: Roʻyxatlarni Excel/PDF ga yuklab olish. X-13: har eksport auditga.
    REPORTS_EXPORT = "reports.export"
    #: Butun maktab kesimidagi hisobotlar (rahbariyat koʻrinishi).
    REPORTS_VIEW_ALL = "reports.view_all"

    # ── Aloqa ──
    #: Ommaviy eʼlon yuborish.
    ANNOUNCEMENTS_PUBLISH = "announcements.publish"
    #: Soʻrovnoma tuzish, faollashtirish va natijalarini koʻrish.
    SURVEYS_MANAGE = "surveys.manage"


class UserPermission(Entity):
    """Foydalanuvchiga berilgan huquq.

    Bekor qilinganda oʻchirilmaydi, arxivlanadi (CLAUDE.md 1-qoida) —
    "kim kimga qachon huquq bergan va qachon olib qoʻygan" tarixi qoladi.
    """

    __tablename__ = "user_permissions"
    __table_args__ = (Index("ix_user_permissions_lookup", "user_id", "permission", "is_archived"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    permission: Mapped[str] = mapped_column(String(64), nullable=False)
    granted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class TwoFactorRecoveryCode(Entity):
    """Telefon yoʻqolganda kirish uchun bir martalik kod (X-14).

    2FA ni majburiy qilib, tiklash yoʻlini bermaslik — administratorni
    tizimdan butunlay chiqarib yuborish demakdir. Telefon sinadi,
    yoʻqoladi va oʻgʻirlanadi.

    Kod XESHLANGAN saqlanadi: baza sizib chiqsa u bilan kirib boʻlmasin.
    Ishlatilgani oʻchirilmaydi — `used_at` qoʻyiladi, shunda "qachon
    tiklash kodi ishlatildi" savoli javobsiz qolmaydi (1-qoida).
    """

    __tablename__ = "two_factor_recovery_codes"
    __table_args__ = (Index("ix_2fa_recovery_user", "user_id", "used_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_ip: Mapped[str | None] = mapped_column(INET)


class ResetChannel(enum.StrEnum):
    """Tiklash kodi qaysi yoʻl bilan yetkaziladi."""

    #: Telegram orqali 6 raqamli kod (AUT-02).
    TELEGRAM = "telegram"
    #: Kanal yoʻq — administrator qoʻlda tiklaydi. Kod yaratilmaydi.
    MANUAL = "manual"


class PasswordResetRequest(Entity):
    """Parolni tiklash soʻrovi (T-006, AUT-02).

    Bitta jadval ikki yoʻlni ham saqlaydi: oʻz-oʻziga xizmat (Telegram
    kodi) va administrator qoʻlda tiklashi. Ular bir xil hodisaning
    ikki yechimi — ajratilsa «bu odam parolini nechta marta tikladi»
    degan savolga ikki joydan javob izlashga toʻgʻri kelardi.

    Kod XESHLANGAN saqlanadi: baza sizib chiqsa u bilan hisobni
    egallab boʻlmasin. 6 raqam atigi million variant, shuning uchun
    `attempts` ham bor — brut kuch bilan topishga urinish yopiladi.

    Ishlatilgan soʻrov oʻchirilmaydi (CLAUDE.md 1-qoida): «qachon va
    qaysi IP dan tiklandi» savoli javobsiz qolmasin.
    """

    __tablename__ = "password_reset_requests"
    __table_args__ = (
        # Cheklovni tekshirish: shu odamning oxirgi soʻrovi qachon edi.
        Index("ix_reset_user_created", "user_id", "created_at"),
        # Administrator navbati: hal qilinmagan qoʻlda tiklashlar.
        Index("ix_reset_queue", "channel", "resolved_at", "used_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(16), nullable=False)

    #: `manual` da `None` — yuboradigan kanal yoʻq, kod ham yoʻq.
    code_hash: Mapped[str | None] = mapped_column(String(255))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: Notoʻgʻri kod kiritilgan urinishlar soni.
    attempts: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)

    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_ip: Mapped[str | None] = mapped_column(INET)

    #: Administrator hal qilgan boʻlsa — kim va qachon.
    resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
