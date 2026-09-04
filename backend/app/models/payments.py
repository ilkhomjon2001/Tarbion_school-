"""Toʻlov moduli (TOL-01…TOL-07): shartnoma, chegirma, hisoblash, toʻlov.

Pul hamma joyda BIGINT va SOʻMDA — tiyin yoʻq (CLAUDE.md 2-qoida).
Standart shartnoma — oyiga 3 500 000 soʻm, oʻquv yili 9 oy
(sentyabr–may).

Uchta buzilmas qoida:

  1. **Toʻlov yozuvi oʻchirilmaydi va tahrirlanmaydi** (TOL-07,
     9-domen qoidasi). Xato boʻlsa STORNO yozuvi qoʻshiladi — u ham
     oddiy yozuv, kassa daftaridagi qizil qator kabi.
  2. **Hisoblangan qarz qotadi.** Oylik qarz yozilgan paytdagi
     shartnoma va chegirmadan hisoblanadi; keyin shartnoma oʻzgarsa
     oʻtgan oylar qayta hisoblanmaydi — hisobot oʻzgarib turmaydi.
  3. **Onlayn toʻlovda summa callback'dan olinmaydi** (X-9) —
     faqat oʻzimiz ochgan niyat (intent) yozuvidan.
"""

import enum
import uuid
from datetime import date

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity

#: Standart oylik shartnoma summasi, soʻmda.
#:
#: Manba — «Oʻquvchini maktabga qabul qilish va taʼlim xizmatlarini
#: koʻrsatish toʻgʻrisida shartnoma», 3.1-band. Kodda oldin 3 500 000
#: turgan edi va u hech qanday hujjatga tayanmasdi.
DEFAULT_MONTHLY_FEE = 2_300_000

#: Shartnoma imzolanayotganda oldindan toʻlanadigan summa (3.1-band).
#: Toʻlov jadvalidagi koʻp uchraydigan «1 150 000» aynan shu.
CONTRACT_ADVANCE = 1_150_000

#: Oldindan toʻlov chegirmalari (3.2-band). Foizda.
#: · Variant B — butun yil uchun oldindan toʻlaganga;
#: · Variant S — 6 oylik oldindan toʻlaganga.
PREPAY_YEAR_DISCOUNT_PERCENT = 10
PREPAY_HALF_YEAR_DISCOUNT_PERCENT = 5

#: Oʻquv yili oylari — sentyabr–may. Iyun–avgustda qarz yozilmaydi.
TUITION_MONTHS = frozenset({9, 10, 11, 12, 1, 2, 3, 4, 5})


class TuitionContract(Entity):
    """Oʻquvchining oylik shartnoma summasi.

    Summa oʻzgarsa yangi yozuv ochiladi, eskisi arxivlanadi —
    «qachondan qancha boʻlgan» tarixi saqlanadi.
    """

    __tablename__ = "tuition_contracts"
    __table_args__ = (Index("ix_tuition_contracts_student", "student_id", "is_archived"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    monthly_fee: Mapped[int] = mapped_column(BigInteger, nullable=False)
    #: Qaysi oydan amal qiladi (oyning 1-sanasi).
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(String(200))


class DiscountKind(enum.StrEnum):
    PERCENT = "percent"
    AMOUNT = "amount"


class TuitionDiscount(Entity):
    """Chegirma — foiz yoki qatʼiy summa. Sabab MAJBURIY."""

    __tablename__ = "tuition_discounts"
    __table_args__ = (Index("ix_tuition_discounts_student", "student_id", "is_archived"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    #: `percent` uchun 1–100, `amount` uchun soʻm.
    value: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    #: `None` — muddatsiz.
    ends_on: Mapped[date | None] = mapped_column(Date)


class TuitionCharge(Entity):
    """Bitta oy uchun hisoblangan qarz. Yozilgach OʻZGARMAYDI."""

    __tablename__ = "tuition_charges"
    __table_args__ = (
        # Idempotent hisoblash: bir oʻquvchiga bir oy uchun bitta yozuv.
        UniqueConstraint("student_id", "year", "month"),
        Index("ix_tuition_charges_period", "year", "month"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    year: Mapped[int] = mapped_column(nullable=False)
    month: Mapped[int] = mapped_column(nullable=False)
    #: Shartnomadagi asos summa — hisoblash paytidagi.
    base_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    #: Qoʻllangan chegirma, soʻmda.
    discount_amount: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    #: Yakuniy qarz = base − discount. Alohida saqlanadi — hisobot
    #: formulaga emas, yozuvga tayanadi.
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)


class TuitionCredit(Entity):
    """Kredit-yozuv — qarzni sabab bilan KAMAYTIRISH.

    Storno'ning qarz tomondagi ekvivalenti: oʻquvchi oy oʻrtasida
    ketdi, kasallik tufayli uzoq qatnamadi va maktab yon berdi —
    hammasi shu yozuv orqali, izli. Qarz yozuvining oʻzi qotgan
    (2-buzilmas qoida), shuning uchun tuzatish alohida qatorda.

    `year`/`month` berilsa aynan oʻsha oyga qoʻllanadi, boʻlmasa
    umumiy balansga (eng eski qarzdan boshlab).
    """

    __tablename__ = "tuition_credits"
    __table_args__ = (Index("ix_tuition_credits_student", "student_id", "is_archived"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    year: Mapped[int | None] = mapped_column()
    month: Mapped[int | None] = mapped_column()
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id")
    )


class PaymentMethod(enum.StrEnum):
    """Toʻlov qanday kelgani.

    Kartalar BRENDI boʻyicha ajratilgan (loyiha egasining soʻrovi,
    2026-09-03). Ilgari hammasi bitta `terminal` edi va rahbar
    «qancha Humo, qancha Visa» degan savolga javob ololmasdi —
    bu esa kassa hisobini bank koʻchirmasi bilan solishtirishda
    kerak boʻladi.
    """

    NAQD = "naqd"
    HUMO = "humo"
    UZCARD = "uzcard"
    VISA = "visa"
    OTKAZMA = "otkazma"
    ONLAYN = "onlayn"

    #: ESKI qiymat. Yangi yozuvda tanlanmaydi, lekin enum'da QOLADI:
    #: hech narsa oʻchirilmaydi (1-domen qoidasi) va eski yozuvlar
    #: hisobotdan tushib qolmasligi kerak.
    TERMINAL = "terminal"


PAYMENT_METHOD_LABELS_UZ: dict[str, str] = {
    PaymentMethod.NAQD.value: "Naqd",
    PaymentMethod.HUMO.value: "Humo",
    PaymentMethod.UZCARD.value: "Uzcard",
    PaymentMethod.VISA.value: "Visa",
    PaymentMethod.OTKAZMA.value: "Bank oʻtkazmasi",
    PaymentMethod.ONLAYN.value: "Onlayn",
    PaymentMethod.TERMINAL.value: "Terminal (eski)",
}

#: Yangi toʻlov kiritishda tanlanadigan usullar — tartibi bilan.
#: `TERMINAL` bu yerda YOʻQ: u tarixiy qiymat.
PAYMENT_METHODS_SELECTABLE: tuple[str, ...] = (
    PaymentMethod.NAQD.value,
    PaymentMethod.HUMO.value,
    PaymentMethod.UZCARD.value,
    PaymentMethod.VISA.value,
    PaymentMethod.OTKAZMA.value,
    PaymentMethod.ONLAYN.value,
)


class Payment(Entity):
    """Toʻlov yozuvi. Tahrirlash va oʻchirish YOʻQ (TOL-07).

    Balans arifmetikasi: toʻlangan = Σ(amount · (storno ? −1 : +1)).
    Storno ham oddiy yozuv — kim, qachon, nima uchun bekor qilgani
    koʻrinib turadi.
    """

    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_student", "student_id", "paid_on"),
        # O5: kvitansiya raqami moliyaviy hujjat — takror boʻlmasin.
        Index(
            "uq_payments_receipt_no",
            "receipt_no",
            unique=True,
            postgresql_where=text("receipt_no IS NOT NULL"),
        ),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    #: Kvitansiya/chek raqami (TOL-04).
    receipt_no: Mapped[str | None] = mapped_column(String(60))
    note: Mapped[str | None] = mapped_column(String(200))
    #: Toʻlov sanasi — MAHALLIY kun (3-qoida).
    paid_on: Mapped[date] = mapped_column(Date, nullable=False)
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id")
    )

    # ── Storno ──
    is_storno: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    #: Qaysi toʻlovni bekor qiladi. Bitta toʻlovga bitta storno.
    storno_of_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("payments.id"), unique=True
    )
    storno_reason: Mapped[str | None] = mapped_column(String(200))

    # ── Onlayn (provayder) ──
    provider: Mapped[str | None] = mapped_column(String(20))
    #: Idempotentlik kaliti: bitta tranzaksiya ikki marta hisoblanmaydi (X-9).
    provider_tx_id: Mapped[str | None] = mapped_column(String(64), unique=True)


class IntentStatus(enum.StrEnum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentIntent(Entity):
    """Onlayn toʻlov niyati — «hisob-faktura».

    Ota-ona «toʻlash»ni bosganda ochiladi; provayder callback'i
    kelganda summa SHU YERDAN olinadi, callback'dan emas (X-9).
    """

    __tablename__ = "payment_intents"

    student_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="sinov")
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=IntentStatus.PENDING.value
    )
