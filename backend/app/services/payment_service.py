"""Toʻlov servisi (TOL-01…TOL-07).

Kim nimani koʻradi — MOLIYA uchun alohida qoida:

  administrator / superadmin / direktor — hammasi;
  ota-ona — FAQAT oʻz farzandining balansi va tarixi (soʻrov darajasida);
  oʻquv boʻlimi — HECH NARSA. `is_staff_wide` ga ataylab tayanmaymiz:
  u academic'ni ham oʻz ichiga oladi, oʻquv boʻlimi esa toʻlov va
  qarzdorlikni koʻrmasligi kerak (access.py dagi ogohlantirish).

Yozish — faqat `payments.manage` huquqi bilan.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.timeutil import local_today
from app.models import (
    TUITION_MONTHS,
    AuditAction,
    DiscountKind,
    IntentStatus,
    Payment,
    PaymentIntent,
    PaymentMethod,
    Permission,
    RoleName,
    SchoolClass,
    Student,
    TuitionCharge,
    TuitionContract,
    TuitionCredit,
    TuitionDiscount,
)
from app.services import audit_service, permissions
from app.services.access import CurrentUser, accessible_student_ids

METHODS = frozenset(m.value for m in PaymentMethod)

#: Moliyani toʻliq koʻradigan rollar. Academic ATAYLAB yoʻq.
FINANCE_ROLES = (
    RoleName.ADMIN.value,
    RoleName.SUPERADMIN.value,
    RoleName.DIRECTOR.value,
)


@dataclass(frozen=True, slots=True)
class LedgerRow:
    """Bitta yozuv — qarz yoki toʻlov, sana boʻyicha aralash roʻyxatda."""

    kind: str  # "charge" | "payment" | "storno"
    when: date
    title: str
    amount: int  # qarz: +, toʻlov: −, storno: + (qarzni qaytaradi)
    payment_id: uuid.UUID | None = None
    method: str | None = None
    receipt_no: str | None = None
    stornod: bool = False  # bu toʻlov bekor qilinganmi


@dataclass(frozen=True, slots=True)
class StudentFinance:
    student_id: uuid.UUID
    student_name: str
    class_name: str | None
    monthly_fee: int | None
    charged: int
    paid: int
    balance: int  # manfiy = qarz
    #: Ketgan oʻquvchi — qarzi qolgan boʻlsa hisobotda «ketgan» belgisi bilan.
    is_archived: bool = False


@dataclass(frozen=True, slots=True)
class MonthStatus:
    """Bitta oyning holati — FIFO boʻyicha yopilgan qismi bilan."""

    year: int
    month: int
    amount: int  # samarali qarz (kredit qoʻllangandan keyin)
    covered: int  # toʻlovlar bilan yopilgan qismi
    status: str  # tolangan | qisman | tolanmagan
    overdue: bool  # muddat (10-sana) oʻtdi va toʻliq yopilmagan


# ─────────────────────────── Kirish nazorati ───────────────────────────


def _sees_all_finance(user: CurrentUser) -> bool:
    return user.has(*FINANCE_ROLES)


async def assert_finance_admin(session: AsyncSession, user: CurrentUser) -> None:
    """Umumiy moliya koʻrinishi (qarzdorlar, jamlanma)."""
    if not _sees_all_finance(user):
        raise PermissionDeniedError("Moliya boʻlimiga kirish huquqingiz yoʻq.")


async def assert_can_view_student_finance(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> None:
    """Bitta oʻquvchining moliyasi: rahbariyat yoki OʻZ vasiysi (X-1)."""
    if _sees_all_finance(user):
        return
    if user.has(RoleName.PARENT.value):
        ruxsatli = await accessible_student_ids(session, user)
        if ruxsatli is not None and student_id in ruxsatli:
            return
    raise PermissionDeniedError("Bu oʻquvchining toʻlovlarini koʻra olmaysiz.")


async def _assert_can_write(session: AsyncSession, user: CurrentUser) -> None:
    await permissions.assert_permission(session, user, Permission.PAYMENTS_MANAGE)


async def _get_student(session: AsyncSession, student_id: uuid.UUID) -> Student:
    student = await session.get(Student, student_id)
    if student is None or student.is_archived:
        raise NotFoundError("Oʻquvchi topilmadi.")
    return student


# ─────────────────────────── Shartnoma ───────────────────────────


async def active_contract(
    session: AsyncSession, student_id: uuid.UUID
) -> TuitionContract | None:
    return await session.scalar(
        select(TuitionContract)
        .where(
            TuitionContract.student_id == student_id,
            TuitionContract.is_archived.is_(False),
        )
        .order_by(TuitionContract.starts_on.desc())
        .limit(1)
    )


async def set_contract(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    monthly_fee: int,
    starts_on: date,
    note: str | None = None,
    ip: str | None = None,
) -> TuitionContract:
    """Yangi shartnoma summasi. Eskisi arxivlanadi — tarix qoladi.

    Oʻtgan oylardagi hisoblangan qarzlar OʻZGARMAYDI (2-buzilmas qoida).
    """
    await _assert_can_write(session, actor)
    await _get_student(session, student_id)
    if monthly_fee <= 0:
        raise ValidationError("Oylik summa musbat boʻlsin.")

    eski = await active_contract(session, student_id)
    if eski is not None:
        eski.is_archived = True

    contract = TuitionContract(
        student_id=student_id,
        monthly_fee=monthly_fee,
        starts_on=starts_on.replace(day=1),
        note=(note or "").strip() or None,
    )
    session.add(contract)
    await session.flush()

    audit_service.record(
        session,
        object_type="tuition_contract",
        object_id=contract.id,
        action=AuditAction.CREATE,
        old={"monthly_fee": eski.monthly_fee} if eski else None,
        new={"monthly_fee": monthly_fee, "student_id": str(student_id)},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return contract


# ─────────────────────────── Chegirma ───────────────────────────


async def add_discount(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    kind: str,
    value: int,
    reason: str,
    starts_on: date,
    ends_on: date | None = None,
    ip: str | None = None,
) -> TuitionDiscount:
    await _assert_can_write(session, actor)
    await _get_student(session, student_id)

    if kind not in {DiscountKind.PERCENT.value, DiscountKind.AMOUNT.value}:
        raise ValidationError("Chegirma turi notoʻgʻri.")
    if kind == DiscountKind.PERCENT.value and not (1 <= value <= 100):
        raise ValidationError("Foiz 1 dan 100 gacha boʻlsin.")
    if kind == DiscountKind.AMOUNT.value and value <= 0:
        raise ValidationError("Chegirma summasi musbat boʻlsin.")
    if len(reason.strip()) < 3:
        raise ValidationError("Chegirma sababi koʻrsatilsin.")

    discount = TuitionDiscount(
        student_id=student_id,
        kind=kind,
        value=value,
        reason=reason.strip(),
        starts_on=starts_on,
        ends_on=ends_on,
    )
    session.add(discount)
    await session.flush()

    audit_service.record(
        session,
        object_type="tuition_discount",
        object_id=discount.id,
        action=AuditAction.CREATE,
        old=None,
        new={
            "student_id": str(student_id),
            "kind": kind,
            "value": value,
            "reason": discount.reason,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return discount


async def archive_discount(
    session: AsyncSession, *, actor: CurrentUser, discount_id: uuid.UUID, ip: str | None = None
) -> None:
    await _assert_can_write(session, actor)
    discount = await session.get(TuitionDiscount, discount_id)
    if discount is None or discount.is_archived:
        raise NotFoundError("Chegirma topilmadi.")
    discount.is_archived = True
    audit_service.record(
        session,
        object_type="tuition_discount",
        object_id=discount.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()


def _discount_for(
    discounts: list[TuitionDiscount], base: int, first_day: date
) -> int:
    """Oy uchun amal qiladigan chegirmalar yigʻindisi, soʻmda.

    Bir nechta chegirma qoʻshilib ketishi mumkin, lekin qarz manfiy
    boʻlmaydi.
    """
    jami = 0
    for d in discounts:
        if d.starts_on > first_day:
            continue
        if d.ends_on is not None and d.ends_on < first_day:
            continue
        if d.kind == DiscountKind.PERCENT.value:
            jami += base * d.value // 100
        else:
            jami += d.value
    return min(jami, base)


# ─────────────────────────── Hisoblash ───────────────────────────


async def generate_charges(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    year: int,
    month: int,
    ip: str | None = None,
) -> int:
    """Oy uchun qarz yozadi. IDEMPOTENT — mavjudlar oʻtkazib yuboriladi.

    Faqat oʻquv yili oylari (sentyabr–may). Oy oʻrtasida kelgan
    oʻquvchining birinchi oyi qoʻlda kiritiladi — bu yerda faqat
    shartnomasi shu oydan oldin boshlanganlar hisoblanadi.
    """
    await _assert_can_write(session, actor)
    if month not in TUITION_MONTHS:
        raise ValidationError("Bu oy oʻquv yiliga kirmaydi (sentyabr–may hisoblanadi).")

    first_day = date(year, month, 1)

    contracts = list(
        (
            await session.execute(
                select(TuitionContract)
                .join(Student, Student.id == TuitionContract.student_id)
                .where(
                    TuitionContract.is_archived.is_(False),
                    TuitionContract.starts_on <= first_day,
                    Student.is_archived.is_(False),
                )
            )
        ).scalars()
    )
    if not contracts:
        return 0

    student_ids = [c.student_id for c in contracts]
    mavjud = set(
        (
            await session.execute(
                select(TuitionCharge.student_id).where(
                    TuitionCharge.year == year, TuitionCharge.month == month
                )
            )
        ).scalars()
    )
    discounts_by_student: dict[uuid.UUID, list[TuitionDiscount]] = {}
    rows = await session.execute(
        select(TuitionDiscount).where(
            TuitionDiscount.student_id.in_(student_ids),
            TuitionDiscount.is_archived.is_(False),
        )
    )
    for d in rows.scalars():
        discounts_by_student.setdefault(d.student_id, []).append(d)

    yozildi = 0
    for c in contracts:
        if c.student_id in mavjud:
            continue
        chegirma = _discount_for(
            discounts_by_student.get(c.student_id, []), c.monthly_fee, first_day
        )
        session.add(
            TuitionCharge(
                student_id=c.student_id,
                year=year,
                month=month,
                base_amount=c.monthly_fee,
                discount_amount=chegirma,
                amount=c.monthly_fee - chegirma,
            )
        )
        yozildi += 1

    if yozildi:
        audit_service.record(
            session,
            object_type="tuition_charge",
            object_id=None,
            action=AuditAction.CREATE,
            old=None,
            new={"year": year, "month": month, "students": yozildi},
            actor_id=actor.id,
            ip=ip,
        )
    await session.commit()
    return yozildi


# ─────────────────────────── Toʻlov va storno ───────────────────────────


async def record_payment(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    amount: int,
    method: str,
    paid_on: date | None = None,
    receipt_no: str | None = None,
    note: str | None = None,
    provider: str | None = None,
    provider_tx_id: str | None = None,
    ip: str | None = None,
    skip_permission: bool = False,
) -> Payment:
    """Toʻlov yozadi. `skip_permission` faqat webhook yoʻli uchun —
    u imzo bilan tasdiqlangan va o'z tekshiruvidan oʻtgan."""
    if not skip_permission:
        await _assert_can_write(session, actor)
    await _get_student(session, student_id)

    if amount <= 0:
        raise ValidationError("Summa musbat boʻlsin.")
    if method not in METHODS:
        raise ValidationError("Toʻlov usuli notoʻgʻri.")

    # TOL-04: chek raqami berilmasa reyestr raqami beriladi — KV-<yil>-<tartib>.
    raqam = (receipt_no or "").strip()
    if not raqam:
        yil = (paid_on or local_today()).year
        soni = (
            await session.scalar(
                select(func.count(Payment.id)).where(
                    Payment.receipt_no.like(f"KV-{yil}-%")
                )
            )
        ) or 0
        raqam = f"KV-{yil}-{soni + 1:04d}"

    payment = Payment(
        student_id=student_id,
        amount=amount,
        method=method,
        paid_on=paid_on or local_today(),
        receipt_no=raqam,
        note=(note or "").strip() or None,
        recorded_by_id=actor.id,
        provider=provider,
        provider_tx_id=provider_tx_id,
    )
    session.add(payment)
    await session.flush()

    # 4-domen qoidasi: toʻlovdagi har oʻzgarish auditga.
    audit_service.record(
        session,
        object_type="payment",
        object_id=payment.id,
        action=AuditAction.CREATE,
        old=None,
        new={
            "student_id": str(student_id),
            "amount": amount,
            "method": method,
            "receipt_no": payment.receipt_no,
            "provider": provider,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return payment


async def storno(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    payment_id: uuid.UUID,
    reason: str,
    ip: str | None = None,
) -> Payment:
    """Toʻlovni bekor qilish — TOL-07. Tahrirlash yoʻq, faqat storno.

    Storno ham oddiy yozuv: kim, qachon, nima uchun. Bitta toʻlovga
    bitta storno (unique cheklov), stornoni storno qilib boʻlmaydi.
    """
    await _assert_can_write(session, actor)
    if len(reason.strip()) < 3:
        raise ValidationError("Storno sababi koʻrsatilsin.")

    asl = await session.get(Payment, payment_id)
    if asl is None:
        raise NotFoundError("Toʻlov topilmadi.")
    if asl.is_storno:
        raise ConflictError("Storno yozuvini storno qilib boʻlmaydi.")

    bor = await session.scalar(select(Payment).where(Payment.storno_of_id == payment_id))
    if bor is not None:
        raise ConflictError("Bu toʻlov allaqachon storno qilingan.")

    yozuv = Payment(
        student_id=asl.student_id,
        amount=asl.amount,
        method=asl.method,
        paid_on=local_today(),
        is_storno=True,
        storno_of_id=asl.id,
        storno_reason=reason.strip(),
        recorded_by_id=actor.id,
    )
    session.add(yozuv)
    await session.flush()

    audit_service.record(
        session,
        object_type="payment",
        object_id=yozuv.id,
        action=AuditAction.CREATE,
        old={"payment_id": str(asl.id), "amount": asl.amount},
        new={"storno": True, "reason": yozuv.storno_reason},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return yozuv


# ─────────────────────────── Balans va roʻyxatlar ───────────────────────────


async def _totals(
    session: AsyncSession, student_ids: list[uuid.UUID]
) -> tuple[dict[uuid.UUID, int], dict[uuid.UUID, int]]:
    """(hisoblangan, toʻlangan) — har oʻquvchi uchun.

    Kredit-yozuvlar hisoblanganni KAMAYTIRADI: qarz tomonning
    tuzatishi, toʻlov emas.
    """
    charged: dict[uuid.UUID, int] = {}
    rows = await session.execute(
        select(TuitionCharge.student_id, func.coalesce(func.sum(TuitionCharge.amount), 0))
        .where(
            TuitionCharge.student_id.in_(student_ids),
            TuitionCharge.is_archived.is_(False),
        )
        .group_by(TuitionCharge.student_id)
    )
    for sid, total in rows.all():
        charged[sid] = int(total)

    rows = await session.execute(
        select(TuitionCredit.student_id, func.coalesce(func.sum(TuitionCredit.amount), 0))
        .where(
            TuitionCredit.student_id.in_(student_ids),
            TuitionCredit.is_archived.is_(False),
        )
        .group_by(TuitionCredit.student_id)
    )
    for sid, total in rows.all():
        charged[sid] = max(0, charged.get(sid, 0) - int(total))

    paid: dict[uuid.UUID, int] = {}
    # Storno manfiy hisoblanadi: Σ(amount · (storno ? −1 : +1)).
    ifoda = func.sum(case((Payment.is_storno.is_(True), -Payment.amount), else_=Payment.amount))
    rows = await session.execute(
        select(Payment.student_id, ifoda)
        .where(Payment.student_id.in_(student_ids), Payment.is_archived.is_(False))
        .group_by(Payment.student_id)
    )
    for sid, total in rows.all():
        paid[sid] = int(total or 0)

    return charged, paid


async def finance_rows(
    session: AsyncSession, user: CurrentUser, *, only_debtors: bool = False
) -> list[StudentFinance]:
    """Barcha oʻquvchilar moliyasi (yoki faqat qarzdorlar)."""
    await assert_finance_admin(session, user)

    # Arxivlanganlar ham olinadi: ketgan oʻquvchining qarzi hisobotdan
    # yoʻqolmasligi kerak (1-domen qoidasi). Balansi nolga teng
    # arxivlanganlar esa roʻyxatni bosmasin — pastda filtrlanadi.
    rows = await session.execute(
        select(Student, SchoolClass.name)
        .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
        .order_by(Student.last_name, Student.first_name)
    )
    students = rows.all()
    ids = [s.id for s, _ in students]
    charged, paid = await _totals(session, ids)

    contracts = {
        c.student_id: c.monthly_fee
        for c in (
            await session.execute(
                select(TuitionContract).where(
                    TuitionContract.student_id.in_(ids),
                    TuitionContract.is_archived.is_(False),
                )
            )
        ).scalars()
    }

    natija = []
    for s, class_name in students:
        c = charged.get(s.id, 0)
        p = paid.get(s.id, 0)
        balans = p - c
        if only_debtors and balans >= 0:
            continue
        if s.is_archived and balans == 0:
            continue  # ketgan va hisobi yopiq — roʻyxatni bosmasin
        natija.append(
            StudentFinance(
                student_id=s.id,
                student_name=s.full_name,
                class_name=class_name,
                monthly_fee=contracts.get(s.id),
                charged=c,
                paid=p,
                balance=balans,
                is_archived=s.is_archived,
            )
        )
    if only_debtors:
        natija.sort(key=lambda r: r.balance)
    return natija


async def student_ledger(
    session: AsyncSession, user: CurrentUser, student_id: uuid.UUID
) -> tuple[StudentFinance, list[LedgerRow], list[TuitionDiscount], list[MonthStatus]]:
    """Bitta oʻquvchining toʻliq daftari — qarzlar, toʻlovlar, oy kesimi."""
    await assert_can_view_student_finance(session, user, student_id)
    # Arxivlangan oʻquvchining daftari OʻQILADI — qarzi bor boʻlishi mumkin.
    student = await session.get(Student, student_id)
    if student is None:
        raise NotFoundError("Oʻquvchi topilmadi.")

    class_name = None
    if student.class_id:
        cls = await session.get(SchoolClass, student.class_id)
        class_name = cls.name if cls else None

    charges = list(
        (
            await session.execute(
                select(TuitionCharge)
                .where(
                    TuitionCharge.student_id == student_id,
                    TuitionCharge.is_archived.is_(False),
                )
                .order_by(TuitionCharge.year, TuitionCharge.month)
            )
        ).scalars()
    )
    payments = list(
        (
            await session.execute(
                select(Payment)
                .where(Payment.student_id == student_id, Payment.is_archived.is_(False))
                .order_by(Payment.paid_on, Payment.created_at)
            )
        ).scalars()
    )
    stornolangan = {p.storno_of_id for p in payments if p.is_storno}

    OYLAR = [
        "", "yanvar", "fevral", "mart", "aprel", "may", "iyun",
        "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
    ]
    rows: list[LedgerRow] = []
    for c in charges:
        title = f"{c.year}, {OYLAR[c.month]} uchun"
        if c.discount_amount:
            title += f" (chegirma {c.discount_amount:,} soʻm)".replace(",", " ")
        rows.append(
            LedgerRow(kind="charge", when=date(c.year, c.month, 1), title=title, amount=c.amount)
        )
    for p in payments:
        if p.is_storno:
            qaytarishmi = p.storno_of_id is None
            rows.append(
                LedgerRow(
                    kind="refund" if qaytarishmi else "storno",
                    when=p.paid_on,
                    title=(
                        (p.storno_reason or "")
                        if qaytarishmi
                        else f"Storno: {p.storno_reason or ''}"
                    ),
                    amount=p.amount,
                    payment_id=p.id,
                    method=p.method,
                )
            )
        else:
            rows.append(
                LedgerRow(
                    kind="payment",
                    when=p.paid_on,
                    title="Onlayn toʻlov (sinov)" if p.provider else "Toʻlov",
                    amount=-p.amount,
                    payment_id=p.id,
                    method=p.method,
                    receipt_no=p.receipt_no,
                    stornod=p.id in stornolangan,
                )
            )
    credits = list(
        (
            await session.execute(
                select(TuitionCredit)
                .where(
                    TuitionCredit.student_id == student_id,
                    TuitionCredit.is_archived.is_(False),
                )
                .order_by(TuitionCredit.created_at)
            )
        ).scalars()
    )
    for k in credits:
        rows.append(
            LedgerRow(
                kind="credit",
                when=k.created_at.date(),
                title=f"Kredit-yozuv: {k.reason}",
                amount=-k.amount,
            )
        )

    rows.sort(key=lambda r: r.when)

    months = _month_coverage(charges, payments, credits)

    charged, paid = await _totals(session, [student_id])
    c_total = charged.get(student_id, 0)
    p_total = paid.get(student_id, 0)
    contract = await active_contract(session, student_id)

    discounts = list(
        (
            await session.execute(
                select(TuitionDiscount).where(
                    TuitionDiscount.student_id == student_id,
                    TuitionDiscount.is_archived.is_(False),
                )
            )
        ).scalars()
    )

    return (
        StudentFinance(
            student_id=student_id,
            student_name=student.full_name,
            class_name=class_name,
            monthly_fee=contract.monthly_fee if contract else None,
            charged=c_total,
            paid=p_total,
            balance=p_total - c_total,
            is_archived=student.is_archived,
        ),
        rows,
        discounts,
        months,
    )


def _month_coverage(
    charges: list[TuitionCharge],
    payments: list[Payment],
    credits: list[TuitionCredit],
) -> list[MonthStatus]:
    """Oylar kesimi: qaysi oy toʻlangan, qaysi qisman, qaysi kechikdi.

    Taqsimot FIFO: pul eng eski qarzdan boshlab yopib boriladi —
    xuddi kassir daftarda qilganidek. Saqlashda hech narsa
    oʻzgarmaydi, bu faqat KOʻRINISH: toʻlovlar oylarga bogʻlab
    yozilmagani uchun hisob qatʼiy va bahssiz qoladi.

    Muddat: oyning `payment_due_day`-sanasi (standart 10). Undan keyin
    toʻliq yopilmagan oy «kechikdi» (overdue) hisoblanadi.
    """
    # 1) Har oyning samarali qarzi: maqsadli kreditlar oʻz oyiga.
    effective: dict[tuple[int, int], int] = {}
    for c in charges:
        effective[(c.year, c.month)] = c.amount
    pool_credit = 0
    for k in credits:
        kalit = (k.year, k.month) if k.year and k.month else None
        if kalit is not None and kalit in effective:
            olinadigan = min(k.amount, effective[kalit])
            effective[kalit] -= olinadigan
            pool_credit += k.amount - olinadigan
        else:
            pool_credit += k.amount

    # 2) Umumiy hovuz: toʻlovlar (storno ayirilgan) + maqsadsiz kredit.
    pool = pool_credit + sum(-p.amount if p.is_storno else p.amount for p in payments)
    pool = max(pool, 0)

    bugun = local_today()
    natija: list[MonthStatus] = []
    for c in sorted(charges, key=lambda x: (x.year, x.month)):
        summa = effective[(c.year, c.month)]
        yopildi = min(pool, summa)
        pool -= yopildi
        if summa == 0 or yopildi >= summa:
            holat = "tolangan"
        elif yopildi > 0:
            holat = "qisman"
        else:
            holat = "tolanmagan"
        muddat = date(c.year, c.month, settings.payment_due_day)
        natija.append(
            MonthStatus(
                year=c.year,
                month=c.month,
                amount=summa,
                covered=yopildi,
                status=holat,
                overdue=holat != "tolangan" and bugun > muddat,
            )
        )
    return natija


async def add_credit(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    amount: int,
    reason: str,
    year: int | None = None,
    month: int | None = None,
    ip: str | None = None,
) -> TuitionCredit:
    """Qarzni sabab bilan kamaytirish — storno'ning qarz tomondagi juft."""
    await _assert_can_write(session, actor)
    student = await session.get(Student, student_id)
    if student is None:
        raise NotFoundError("Oʻquvchi topilmadi.")
    if amount <= 0:
        raise ValidationError("Summa musbat boʻlsin.")
    if len(reason.strip()) < 3:
        raise ValidationError("Kredit-yozuv sababi koʻrsatilsin.")
    if (year is None) != (month is None):
        raise ValidationError("Yil va oy birga koʻrsatiladi.")

    credit = TuitionCredit(
        student_id=student_id,
        amount=amount,
        reason=reason.strip(),
        year=year,
        month=month,
        created_by_id=actor.id,
    )
    session.add(credit)
    await session.flush()

    audit_service.record(
        session,
        object_type="tuition_credit",
        object_id=credit.id,
        action=AuditAction.CREATE,
        old=None,
        new={
            "student_id": str(student_id),
            "amount": amount,
            "reason": credit.reason,
            "target": f"{year}-{month}" if year else None,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return credit


async def refund(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    amount: int,
    reason: str,
    ip: str | None = None,
) -> Payment:
    """Avansni qaytarish — pul kassadan chiqdi, yozuv izli.

    Faqat balans MUSBAT boʻlganda va undan oshmagan summaga: qarzdor
    oilaga «qaytarish» boʻlmaydi. Texnik jihatdan bu storno-yozuv
    (toʻlanganni kamaytiradi), lekin aniq sabab bilan.
    """
    await _assert_can_write(session, actor)
    if amount <= 0:
        raise ValidationError("Summa musbat boʻlsin.")
    if len(reason.strip()) < 3:
        raise ValidationError("Qaytarish sababi koʻrsatilsin.")

    charged, paid = await _totals(session, [student_id])
    balans = paid.get(student_id, 0) - charged.get(student_id, 0)
    if amount > balans:
        raise ConflictError("Qaytariladigan summa avansdan oshmasin.")

    yozuv = Payment(
        student_id=student_id,
        amount=amount,
        method=PaymentMethod.NAQD.value,
        paid_on=local_today(),
        is_storno=True,
        storno_reason=f"Qaytarish: {reason.strip()}",
        recorded_by_id=actor.id,
    )
    session.add(yozuv)
    await session.flush()

    audit_service.record(
        session,
        object_type="payment",
        object_id=yozuv.id,
        action=AuditAction.CREATE,
        old=None,
        new={"student_id": str(student_id), "refund": amount, "reason": reason.strip()},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return yozuv


async def summary(session: AsyncSession, user: CurrentUser) -> dict[str, int]:
    """Jamlanma: hisoblangan, tushum, qarz, qarzdorlar soni."""
    await assert_finance_admin(session, user)
    rows = await finance_rows(session, user)
    return {
        "charged": sum(r.charged for r in rows),
        "paid": sum(r.paid for r in rows),
        "debt": sum(-r.balance for r in rows if r.balance < 0),
        "debtors": sum(1 for r in rows if r.balance < 0),
        "students_with_contract": sum(1 for r in rows if r.monthly_fee is not None),
    }


# ─────────────────────────── Onlayn (sinov provayderi) ───────────────────────────


def _sign(intent_id: str, status: str) -> str:
    """Webhook imzosi — HMAC-SHA256, kalit .env da."""
    kalit = settings.sinov_provider_key.encode()
    return hmac.new(kalit, f"{intent_id}:{status}".encode(), hashlib.sha256).hexdigest()


async def create_intent(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    amount: int,
) -> PaymentIntent:
    """Ota-ona «toʻlash»ni bosdi — niyat ochiladi.

    Faqat OʻZ farzandiga (X-1) va musbat summaga.
    """
    await assert_can_view_student_finance(session, actor, student_id)
    if amount <= 0:
        raise ValidationError("Summa musbat boʻlsin.")
    if amount > 100_000_000:
        raise ValidationError("Summa juda katta.")

    intent = PaymentIntent(
        student_id=student_id, created_by_id=actor.id, amount=amount, provider="sinov"
    )
    session.add(intent)
    await session.commit()
    return intent


async def handle_webhook(
    session: AsyncSession,
    *,
    tx_id: str,
    status: str,
    signature: str,
) -> str:
    """Provayder callback'i — X-9 ning uch qoidasi shu yerda:

      1. imzo tekshiriladi — notoʻgʻri boʻlsa 403;
      2. summa callback'dan OLINMAYDI — intent yozuvidan;
      3. idempotent — bir tranzaksiya ikki marta hisoblanmaydi.
    """
    if not hmac.compare_digest(signature, _sign(tx_id, status)):
        raise PermissionDeniedError("Imzo notoʻgʻri.")

    try:
        intent_uuid = uuid.UUID(tx_id)
    except ValueError as e:
        raise ValidationError("Tranzaksiya identifikatori notoʻgʻri.") from e

    intent = await session.get(PaymentIntent, intent_uuid)
    if intent is None:
        raise NotFoundError("Tranzaksiya topilmadi.")

    if intent.status == IntentStatus.PAID.value:
        # Takror callback — jimgina OK: provayderlar qayta yuboradi.
        return "allaqachon"
    if intent.status == IntentStatus.CANCELLED.value:
        raise ConflictError("Bekor qilingan tranzaksiya toʻlanmaydi.")

    if status == "cancelled":
        intent.status = IntentStatus.CANCELLED.value
        await session.commit()
        return "bekor"

    if status != "paid":
        raise ValidationError("Holat notoʻgʻri.")

    intent.status = IntentStatus.PAID.value
    session.add(
        Payment(
            student_id=intent.student_id,
            amount=intent.amount,  # X-9: summa intentdan, callback'dan emas
            method=PaymentMethod.ONLAYN.value,
            paid_on=local_today(),
            provider=intent.provider,
            provider_tx_id=str(intent.id),
            recorded_by_id=intent.created_by_id,
        )
    )
    await session.flush()
    payment = await session.scalar(
        select(Payment).where(Payment.provider_tx_id == str(intent.id))
    )
    audit_service.record(
        session,
        object_type="payment",
        object_id=payment.id if payment else None,
        action=AuditAction.CREATE,
        old=None,
        new={
            "student_id": str(intent.student_id),
            "amount": intent.amount,
            "method": "onlayn",
            "provider": intent.provider,
        },
        actor_id=intent.created_by_id,
        ip=None,
    )
    await session.commit()
    return "toladi"


def make_signature(intent_id: str, status: str) -> str:
    """Sinov «provayderi» uchun — server oʻzi imzolab webhookka uzatadi.

    Haqiqiy provayderda bu funksiya ularning hujjatidagi imzo bilan
    almashadi; kalit hech qachon brauzerga chiqmaydi.
    """
    return _sign(intent_id, status)
