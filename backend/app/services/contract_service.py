"""Shartnoma hujjati — «Oʻquvchini maktabga qabul qilish va taʼlim
xizmatlarini koʻrsatish toʻgʻrisida shartnoma».

Bu modul hujjat MATNINI saqlamaydi — u frontendda, chunki hujjat
oʻzgarganda dizayn ham oʻzgaradi. Bu yerda faqat hujjatga qoʻyiladigan
MAʼLUMOT yigʻiladi: oʻquvchi, vasiy, maktab rekvizitlari va amaldagi
shartnoma summasi.

Nega alohida modul: bir xil maʼlumot uch joyga kerak — ota-ona
kabinetidagi hujjat, administratorning chop etishi va kelajakdagi PDF.
Uchalasi bitta manbadan oʻqiydi, aks holda ular bir-biridan ajralib
ketardi.

Kirish nazorati `access.py` orqali (X-1): ota-ona faqat oʻz farzandining
shartnomasini koʻradi. Maktab rekvizitlari bu yerda `school_settings()`
dan OLINMAYDI — u xodimlarga cheklangan; ota-onaga shartnomada
koʻrsatiladigan rekvizitlar esa hujjatning oʻz qismi.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.models import Guardian, SchoolClass, SchoolSettings, Student, User
from app.models.payments import (
    CONTRACT_ADVANCE,
    DEFAULT_MONTHLY_FEE,
    PREPAY_HALF_YEAR_DISCOUNT_PERCENT,
    PREPAY_YEAR_DISCOUNT_PERCENT,
)
from app.services import payment_service
from app.services.access import CurrentUser, assert_can_view_student

#: Shartnomada koʻrsatilgan qarshi tomon — «Ijrochi».
_DEFAULT_SCHOOL_NAME = "«Tarbion» NTM"


@dataclass(frozen=True, slots=True)
class ContractParty:
    """Shartnomani imzolagan vasiy."""

    full_name: str
    phone: str | None
    address: str | None
    relation: str


@dataclass(frozen=True, slots=True)
class ContractView:
    # ── Ijrochi ──
    school_name: str
    school_address: str
    school_phone: str
    director_name: str
    tax_id: str
    bank_account: str
    bank_code: str
    bank_name: str

    # ── Oʻquvchi ──
    student_name: str
    birth_date: date | None
    class_name: str | None

    # ── Ota-ona / qonuniy vakil ──
    guardians: list[ContractParty]

    # ── Moliyaviy shartlar ──
    #: Amaldagi shartnoma summasi. Shartnoma ochilmagan boʻlsa —
    #: standart summa, va `has_contract` yolgʻon boʻladi.
    monthly_fee: int
    has_contract: bool
    contract_starts_on: date | None
    advance: int
    due_day: int
    prepay_year_percent: int
    prepay_half_year_percent: int


async def _school(session: AsyncSession) -> SchoolSettings | None:
    return await session.scalar(
        select(SchoolSettings)
        .where(SchoolSettings.is_archived.is_(False))
        .order_by(SchoolSettings.created_at.desc())
        .limit(1)
    )


async def contract_view(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> ContractView:
    """Shartnoma hujjati uchun maʼlumot.

    Ota-ona faqat oʻz farzandi uchun chaqira oladi — tekshiruv
    `access.py` da, soʻrov darajasida (X-1).
    """
    await assert_can_view_student(session, user, student_id)

    student = await session.get(Student, student_id)
    if student is None:
        raise NotFoundError("Oʻquvchi topilmadi.")

    class_name = None
    if student.class_id:
        cls = await session.get(SchoolClass, student.class_id)
        class_name = cls.name if cls else None

    # Vasiylar: asosiysi birinchi — hujjatda u imzolaydi.
    rows = (
        await session.execute(
            select(Guardian, User)
            .join(User, User.id == Guardian.user_id)
            .where(
                Guardian.student_id == student_id,
                Guardian.is_archived.is_(False),
                User.is_archived.is_(False),
            )
            .order_by(Guardian.is_primary.desc(), User.last_name)
        )
    ).all()

    contract = await payment_service.active_contract(session, student_id)
    school = await _school(session)

    return ContractView(
        school_name=school.name if school else _DEFAULT_SCHOOL_NAME,
        school_address=school.address if school else "",
        school_phone=school.phone if school else "",
        director_name=school.director_name if school else "",
        tax_id=school.tax_id if school else "",
        bank_account=school.bank_account if school else "",
        bank_code=school.bank_code if school else "",
        bank_name=school.bank_name if school else "",
        student_name=student.full_name,
        birth_date=student.birth_date,
        class_name=class_name,
        guardians=[
            ContractParty(
                full_name=u.full_name,
                phone=u.phone,
                address=u.address,
                relation=g.relation,
            )
            for g, u in rows
        ],
        monthly_fee=contract.monthly_fee if contract else DEFAULT_MONTHLY_FEE,
        has_contract=contract is not None,
        contract_starts_on=contract.starts_on if contract else None,
        advance=CONTRACT_ADVANCE,
        due_day=settings.payment_due_day,
        prepay_year_percent=PREPAY_YEAR_DISCOUNT_PERCENT,
        prepay_half_year_percent=PREPAY_HALF_YEAR_DISCOUNT_PERCENT,
    )
