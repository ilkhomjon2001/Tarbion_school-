"""Toʻlov sxemalari. Pul hamma joyda butun son, soʻmda."""

import uuid
from datetime import date

from pydantic import BaseModel, Field


class StudentFinanceOut(BaseModel):
    student_id: uuid.UUID
    student_name: str
    class_name: str | None
    monthly_fee: int | None
    charged: int
    paid: int
    #: Manfiy = qarz.
    balance: int
    #: `tolangan | qisman | tolanmagan | hisobsiz` — «hech narsa
    #: toʻlamagan»ni «yarmini toʻlagan»dan ajratadi.
    status: str
    #: Ketgan oʻquvchi — qarzi bilan hisobotda qoladi.
    is_archived: bool = False


class MonthStatusOut(BaseModel):
    """Bitta oyning holati — FIFO boʻyicha."""

    year: int
    month: int
    amount: int
    covered: int
    status: str
    overdue: bool


class MethodTotalOut(BaseModel):
    """Bitta toʻlov kanali boʻyicha yigʻindi (TOL-05).

    `label` SERVERDAN keladi: kanal nomi bitta joyda — model
    enum'ida — yozilsin, frontend uni qaytadan oʻylab topmasin.
    """

    method: str
    label: str
    count: int
    total: int


class FinanceSummaryOut(BaseModel):
    charged: int
    paid: int
    debt: int
    debtors: int
    students_with_contract: int
    #: Jami oʻquvchi — qamrovni koʻrsatish uchun. Shartnomasi yoʻq
    #: oʻquvchiga qarz hisoblanmaydi va jamlanma «hamma toʻlagan»
    #: boʻlib koʻrinishi mumkin.
    students_total: int
    #: Holat kesimi. `debtors` bulardan ikkitasini birga sanaydi:
    #: toʻlamagan ham, yarim toʻlagan ham manfiy balansda turadi.
    paid_full: int
    partial: int
    unpaid: int
    no_charge: int
    #: Kanallar kesimi. Toʻlovi yoʻq kanal ham nol bilan qaytadi —
    #: «Visa orqali hech narsa kelmadi» ham javob.
    by_method: list[MethodTotalOut]


class LedgerRowOut(BaseModel):
    kind: str
    when: date
    title: str
    amount: int
    payment_id: uuid.UUID | None
    method: str | None
    receipt_no: str | None
    stornod: bool


class DiscountOut(BaseModel):
    id: uuid.UUID
    kind: str
    value: int
    reason: str
    starts_on: date
    ends_on: date | None


class StudentLedgerOut(BaseModel):
    finance: StudentFinanceOut
    rows: list[LedgerRowOut]
    discounts: list[DiscountOut]
    months: list[MonthStatusOut]


class CreditIn(BaseModel):
    """Kredit-yozuv: qarzni sabab bilan kamaytirish."""

    amount: int = Field(gt=0, le=1_000_000_000)
    reason: str = Field(min_length=3, max_length=200)
    year: int | None = Field(default=None, ge=2024, le=2100)
    month: int | None = Field(default=None, ge=1, le=12)


class RefundIn(BaseModel):
    """Avansni qaytarish — faqat musbat balansdan."""

    amount: int = Field(gt=0, le=1_000_000_000)
    reason: str = Field(min_length=3, max_length=200)


class ContractIn(BaseModel):
    monthly_fee: int = Field(gt=0, le=1_000_000_000)
    starts_on: date
    note: str | None = Field(default=None, max_length=200)


class DiscountIn(BaseModel):
    kind: str
    value: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=200)
    starts_on: date
    ends_on: date | None = None


class PaymentIn(BaseModel):
    student_id: uuid.UUID
    amount: int = Field(gt=0, le=1_000_000_000)
    method: str
    paid_on: date | None = None
    receipt_no: str | None = Field(default=None, max_length=60)
    note: str | None = Field(default=None, max_length=200)


class StornoIn(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


class GenerateChargesIn(BaseModel):
    year: int = Field(ge=2024, le=2100)
    month: int = Field(ge=1, le=12)


class IntentCreateIn(BaseModel):
    student_id: uuid.UUID
    amount: int = Field(gt=0, le=100_000_000)


class IntentOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    amount: int
    provider: str
    status: str


class SinovCompleteIn(BaseModel):
    """Sinov «bank sahifasi»dagi tugma: toʻlash yoki bekor qilish."""

    outcome: str  # "paid" | "cancelled"


class WebhookIn(BaseModel):
    """Provayder callback shakli — haqiqiy integratsiyada ham shu oʻzak."""

    tx_id: str
    status: str
    signature: str
