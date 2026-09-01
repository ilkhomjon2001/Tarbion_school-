"""Kadrlar — xodim profili va taʼtillar.

Hisobning oʻzi (`users`) autentifikatsiya uchun; bu yerdagi profil —
kadrlar boʻlimining qoʻshimchasi: lavozim, shartnoma turi, malaka
toifasi, ishga kirgan sana, oylik.

Oylik — BIGINT, soʻmda (CLAUDE.md 2-qoida). Bu nozik maydon: butun
modul `users.manage` huquqi bilan yopiq, oylikning oʻzgarishi
audit_log ga tushadi.

Boʻsh ish oʻrinlari va ishdan ketish bu modelda YOʻQ: ketish — hisobni
arxivlash (allaqachon bor), vakansiyalar esa TZ'da yoʻq.
"""

import enum
import uuid
from datetime import date

from sqlalchemy import BigInteger, Date, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class ContractType(enum.StrEnum):
    TOLIQ = "toliq"
    YARIM = "yarim"
    SOATBAY = "soatbay"


CONTRACT_TYPE_LABELS_UZ: dict[str, str] = {
    ContractType.TOLIQ.value: "Toʻliq stavka",
    ContractType.YARIM.value: "Yarim stavka",
    ContractType.SOATBAY.value: "Soatbay",
}


class Qualification(enum.StrEnum):
    OLIY = "oliy"
    BIRINCHI = "birinchi"
    IKKINCHI = "ikkinchi"
    TOIFASIZ = "toifasiz"


QUALIFICATION_LABELS_UZ: dict[str, str] = {
    Qualification.OLIY.value: "Oliy toifa",
    Qualification.BIRINCHI.value: "1-toifa",
    Qualification.IKKINCHI.value: "2-toifa",
    Qualification.TOIFASIZ.value: "Toifasiz",
}


class LeaveType(enum.StrEnum):
    TATIL = "tatil"
    KASALLIK = "kasallik"
    OZ_HISOBIDAN = "oz-hisobidan"
    MALAKA = "malaka"


LEAVE_TYPE_LABELS_UZ: dict[str, str] = {
    LeaveType.TATIL.value: "Mehnat taʼtili",
    LeaveType.KASALLIK.value: "Kasallik varaqasi",
    LeaveType.OZ_HISOBIDAN.value: "Oʻz hisobidan",
    LeaveType.MALAKA.value: "Malaka oshirish",
}


class StaffProfile(Entity):
    __tablename__ = "staff_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True
    )
    position: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    contract_type: Mapped[str] = mapped_column(
        String(16), default=ContractType.TOLIQ.value, nullable=False
    )
    qualification: Mapped[str] = mapped_column(
        String(16), default=Qualification.TOIFASIZ.value, nullable=False
    )
    hired_on: Mapped[date | None] = mapped_column(Date)
    #: Soʻmda, tiyin yoʻq (2-qoida). `None` — kiritilmagan.
    base_salary: Mapped[int | None] = mapped_column(BigInteger)
    note: Mapped[str | None] = mapped_column(String(300))


class StaffLeave(Entity):
    __tablename__ = "staff_leaves"
    __table_args__ = (Index("ix_staff_leaves_user", "user_id", "starts_on"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    leave_type: Mapped[str] = mapped_column(String(20), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(200))
