"""Toʻlov endpointlari (TOL-01…TOL-07, OTA-06).

Webhook autentifikatsiyasiz — provayder token yubormaydi; uni imzo
himoya qiladi (X-9). Qolgan hamma endpoint token bilan, kirish
servisda: moliya administratori (admin/direktor/superadmin), yozish
`payments.manage`, ota-ona faqat oʻz farzandiga.
"""

import dataclasses
import uuid

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.models import PaymentIntent
from app.schemas.payments import (
    ContractIn,
    CreditIn,
    DiscountIn,
    DiscountOut,
    FinanceSummaryOut,
    GenerateChargesIn,
    IntentCreateIn,
    IntentOut,
    LedgerRowOut,
    MethodTotalOut,
    MonthStatusOut,
    PaymentIn,
    RefundIn,
    SinovCompleteIn,
    StornoIn,
    StudentFinanceOut,
    StudentLedgerOut,
    WebhookIn,
)
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["payments"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _finance_out(r: payment_service.StudentFinance) -> StudentFinanceOut:
    return StudentFinanceOut(
        student_id=r.student_id,
        student_name=r.student_name,
        class_name=r.class_name,
        monthly_fee=r.monthly_fee,
        charged=r.charged,
        paid=r.paid,
        balance=r.balance,
        is_archived=r.is_archived,
    )


# ─────────────────────────── Umumiy koʻrinish ───────────────────────────


@router.get("/summary", response_model=FinanceSummaryOut)
async def summary(user: CurrentUserDep, session: SessionDep) -> FinanceSummaryOut:
    """Jamlanma. Oʻquv boʻlimiga ham 403 — moliya alohida doira."""
    data = await payment_service.summary(session, user)
    return FinanceSummaryOut(
        charged=data.charged,
        paid=data.paid,
        debt=data.debt,
        debtors=data.debtors,
        students_with_contract=data.students_with_contract,
        students_total=data.students_total,
        by_method=[MethodTotalOut(**dataclasses.asdict(m)) for m in data.by_method],
    )


@router.get("/students", response_model=list[StudentFinanceOut])
async def students(
    user: CurrentUserDep, session: SessionDep, debtors: bool = False
) -> list[StudentFinanceOut]:
    rows = await payment_service.finance_rows(session, user, only_debtors=debtors)
    return [_finance_out(r) for r in rows]


@router.get("/students/{student_id}", response_model=StudentLedgerOut)
async def student_ledger(
    student_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> StudentLedgerOut:
    """Daftar: qarzlar va toʻlovlar. Ota-ona faqat oʻz farzandiga (X-1)."""
    finance, rows, discounts, months = await payment_service.student_ledger(
        session, user, student_id
    )
    return StudentLedgerOut(
        finance=_finance_out(finance),
        rows=[
            LedgerRowOut(
                kind=r.kind,
                when=r.when,
                title=r.title,
                amount=r.amount,
                payment_id=r.payment_id,
                method=r.method,
                receipt_no=r.receipt_no,
                stornod=r.stornod,
            )
            for r in rows
        ],
        discounts=[
            DiscountOut(
                id=d.id,
                kind=d.kind,
                value=d.value,
                reason=d.reason,
                starts_on=d.starts_on,
                ends_on=d.ends_on,
            )
            for d in discounts
        ],
        months=[
            MonthStatusOut(
                year=m.year,
                month=m.month,
                amount=m.amount,
                covered=m.covered,
                status=m.status,
                overdue=m.overdue,
            )
            for m in months
        ],
    )


# ─────────────────────────── Boshqarish ───────────────────────────


@router.put("/students/{student_id}/contract", response_model=StudentLedgerOut)
async def set_contract(
    student_id: uuid.UUID,
    payload: ContractIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentLedgerOut:
    """Shartnoma summasi. Oʻtgan oylar qarzi qayta hisoblanmaydi."""
    await payment_service.set_contract(
        session,
        actor=user,
        student_id=student_id,
        monthly_fee=payload.monthly_fee,
        starts_on=payload.starts_on,
        note=payload.note,
        ip=_client_ip(request),
    )
    return await student_ledger(student_id, user, session)


@router.post("/students/{student_id}/discounts", response_model=StudentLedgerOut)
async def add_discount(
    student_id: uuid.UUID,
    payload: DiscountIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentLedgerOut:
    await payment_service.add_discount(
        session,
        actor=user,
        student_id=student_id,
        kind=payload.kind,
        value=payload.value,
        reason=payload.reason,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        ip=_client_ip(request),
    )
    return await student_ledger(student_id, user, session)


@router.post("/discounts/{discount_id}/archive", status_code=204)
async def archive_discount(
    discount_id: uuid.UUID, request: Request, user: CurrentUserDep, session: SessionDep
) -> None:
    await payment_service.archive_discount(
        session, actor=user, discount_id=discount_id, ip=_client_ip(request)
    )


@router.post("/charges/generate")
async def generate_charges(
    payload: GenerateChargesIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> dict[str, int]:
    """Oylik qarzni yozish — idempotent, qayta bosilsa takrorlamaydi."""
    yozildi = await payment_service.generate_charges(
        session, actor=user, year=payload.year, month=payload.month, ip=_client_ip(request)
    )
    return {"created": yozildi}


@router.post("", response_model=StudentLedgerOut, status_code=201)
async def record_payment(
    payload: PaymentIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentLedgerOut:
    """Qoʻlda toʻlov kiritish: naqd, Humo, Uzcard, Visa, bank oʻtkazmasi."""
    await payment_service.record_payment(
        session,
        actor=user,
        student_id=payload.student_id,
        amount=payload.amount,
        method=payload.method,
        paid_on=payload.paid_on,
        receipt_no=payload.receipt_no,
        note=payload.note,
        ip=_client_ip(request),
    )
    return await student_ledger(payload.student_id, user, session)


@router.post("/{payment_id}/storno", response_model=StudentLedgerOut)
async def storno(
    payment_id: uuid.UUID,
    payload: StornoIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentLedgerOut:
    """TOL-07: tahrirlash yoʻq — faqat storno, sabab bilan."""
    yozuv = await payment_service.storno(
        session, actor=user, payment_id=payment_id, reason=payload.reason, ip=_client_ip(request)
    )
    return await student_ledger(yozuv.student_id, user, session)


@router.post("/students/{student_id}/credits", response_model=StudentLedgerOut)
async def add_credit(
    student_id: uuid.UUID,
    payload: CreditIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentLedgerOut:
    """Kredit-yozuv — qarzni sabab bilan kamaytirish (auditda)."""
    await payment_service.add_credit(
        session,
        actor=user,
        student_id=student_id,
        amount=payload.amount,
        reason=payload.reason,
        year=payload.year,
        month=payload.month,
        ip=_client_ip(request),
    )
    return await student_ledger(student_id, user, session)


@router.post("/students/{student_id}/refund", response_model=StudentLedgerOut)
async def refund(
    student_id: uuid.UUID,
    payload: RefundIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> StudentLedgerOut:
    """Avansni qaytarish — faqat musbat balansdan, izli yozuv bilan."""
    await payment_service.refund(
        session,
        actor=user,
        student_id=student_id,
        amount=payload.amount,
        reason=payload.reason,
        ip=_client_ip(request),
    )
    return await student_ledger(student_id, user, session)


# ─────────────────────── Onlayn (sinov provayderi) ───────────────────────


@router.post("/intents", response_model=IntentOut, status_code=201)
async def create_intent(
    payload: IntentCreateIn, user: CurrentUserDep, session: SessionDep
) -> IntentOut:
    """Ota-ona «toʻlash»ni bosdi. Faqat oʻz farzandiga (X-1)."""
    intent = await payment_service.create_intent(
        session, actor=user, student_id=payload.student_id, amount=payload.amount
    )
    return IntentOut(
        id=intent.id,
        student_id=intent.student_id,
        amount=intent.amount,
        provider=intent.provider,
        status=intent.status,
    )


@router.post("/intents/{intent_id}/sinov-complete", response_model=IntentOut)
async def sinov_complete(
    intent_id: uuid.UUID,
    payload: SinovCompleteIn,
    user: CurrentUserDep,
    session: SessionDep,
) -> IntentOut:
    """Sinov «bank sahifasi» tugmasi.

    Imzo SERVERDA yasaladi va webhook mantigʻining oʻzidan oʻtadi —
    haqiqiy provayder keladigan yoʻlning aynan oʻzi sinovdan oʻtadi.
    Kalit brauzerga hech qachon chiqmaydi.
    """
    intent = await session.get(PaymentIntent, intent_id)
    if intent is None or intent.created_by_id != user.id:
        # Faqat niyatni ochgan odam yakunlay oladi; X-3 — 403.
        from app.core.exceptions import PermissionDeniedError  # noqa: PLC0415

        raise PermissionDeniedError("Bu tranzaksiyani yakunlay olmaysiz.")

    status = "paid" if payload.outcome == "paid" else "cancelled"
    imzo = payment_service.make_signature(str(intent_id), status)
    await payment_service.handle_webhook(
        session, tx_id=str(intent_id), status=status, signature=imzo
    )
    yangilangan = await session.get(PaymentIntent, intent_id)
    return IntentOut(
        id=yangilangan.id,
        student_id=yangilangan.student_id,
        amount=yangilangan.amount,
        provider=yangilangan.provider,
        status=yangilangan.status,
    )


@router.post("/webhook/sinov")
async def webhook(payload: WebhookIn, session: SessionDep) -> dict[str, str]:
    """Provayder callback'i — autentifikatsiyasiz, imzo bilan (X-9).

    Haqiqiy Payme/Click kelganda shu oʻzakka ularning imzo sxemasi
    ulanadi; idempotentlik va «summa oʻz yozuvimizdan» oʻzgarmaydi.
    """
    natija = await payment_service.handle_webhook(
        session, tx_id=payload.tx_id, status=payload.status, signature=payload.signature
    )
    return {"result": natija}


# Sinov intenti holatini soʻrash — sahifa yangilanganda kerak.
@router.get("/intents/{intent_id}", response_model=IntentOut)
async def get_intent(
    intent_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> IntentOut:
    intent = await session.get(PaymentIntent, intent_id)
    if intent is None or (
        intent.created_by_id != user.id
        and not user.has(*payment_service.FINANCE_ROLES)
    ):
        from app.core.exceptions import PermissionDeniedError  # noqa: PLC0415

        raise PermissionDeniedError("Bu tranzaksiyani koʻra olmaysiz.")
    return IntentOut(
        id=intent.id,
        student_id=intent.student_id,
        amount=intent.amount,
        provider=intent.provider,
        status=intent.status,
    )

