"""Oʻquv rejalari (metodik baza) — CRUD + Excel import/eksport.

Oqim: shablonni yuklab olish → toʻldirish → import (QORALAMA) →
koʻrib chiqish → JORIY qilish (ustozlarga koʻrinadi). Bir (fan, yil,
sinf) uchun bitta joriy reja — yangisi joriy boʻlganda eskisi ARXIV.

Kirish: yozish amallari oʻquv boʻlimi/admin/superadmin (router darajasida
rol bilan), joriy rejalarni OʻQISH esa barcha xodimlarga ochiq (ustoz
kabineti shu yerdan oladi).
"""

import io
import re
import uuid
from dataclasses import dataclass, field

from openpyxl import Workbook, load_workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.timeutil import utcnow
from app.models import (
    PROGRAM_YEARS,
    AuditAction,
    CurriculumPlan,
    CurriculumStatus,
)
from app.services import audit_service
from app.services.access import CurrentUser

#: Shablon ustunlari — tartib MUHIM (import shu tartibda oʻqiydi).
COLUMNS = [
    ("Chorak", "1–4 raqami"),
    ("Mavzu", "Dars mavzusi (majburiy)"),
    ("Tur", "qurish / dasturlash / nazorat / loyiha / elektronika / ai"),
    ("Model", "Model nomi (ixtiyoriy)"),
    ("Maqsad", "Har qatorda bitta maqsad (Alt+Enter bilan)"),
    ("Lugʻat", "Har qatorda bitta atama"),
    ("Nazariya", "Nazariy qism — har qatorda bitta band"),
    ("Amaliy", "Amaliy qism — har qatorda bitta band"),
    ("Uyga vazifa", "Har qatorda bitta topshiriq"),
    ("Resurslar", "Har qatorda bitta resurs"),
]

TYPES = {
    "qurish", "dasturlash", "nazorat", "loyiha",
    "elektronika", "ai", "spike", "arduino", "esp32",
}

MAX_LESSONS = 200

_APO = re.compile(r"([oOgG])['’`ʼ]")
_REST = re.compile(r"['’`]")


def _toza(s: str) -> str:
    """Apostrof normalizatsiyasi (CLAUDE.md 8-qoida)."""
    s = _APO.sub(lambda m: m.group(1) + "ʻ", s.strip())
    return _REST.sub("ʼ", s)


def _lines(cell: object) -> list[str]:
    if cell is None:
        return []
    return [_toza(x) for x in str(cell).splitlines() if x.strip()]


@dataclass
class ImportResult:
    plan: CurriculumPlan
    warnings: list[str] = field(default_factory=list)


# ─────────────────────────── Shablon ───────────────────────────


def build_template() -> bytes:
    """Boʻsh Excel shablon — «Reja» varagʻi + «Yoʻriqnoma»."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Reja"
    ws.append([c[0] for c in COLUMNS])
    # Namuna qator — foydalanuvchi formatni koʻrsin.
    ws.append([
        1,
        "Kirish darsi: fan bilan tanishuv",
        "qurish",
        "",
        "Oʻquvchilar fan nimani oʻrganishini biladilar",
        "Atama (Term) — izohi",
        "Kirish suhbati (10 daqiqa)\nAsosiy tushunchalar (20 daqiqa)",
        "Amaliy mashq (15 daqiqa)",
        "Oʻtilganlarni takrorlash",
        "Doska, tarqatma material",
    ])
    for i, _ in enumerate(COLUMNS, start=1):
        ws.column_dimensions[chr(64 + i)].width = 28

    y = wb.create_sheet("Yoʻriqnoma")
    y.column_dimensions["A"].width = 90
    y.append(["Oʻquv rejasi shabloni — toʻldirish qoidalari"])
    y.append([""])
    for nom, izoh in COLUMNS:
        y.append([f"• {nom}: {izoh}"])
    y.append([""])
    y.append(["Bir katakda bir nechta band boʻlsa — har birini yangi qatordan (Alt+Enter)."])
    y.append(["Chorak 1 dan 4 gacha; qatorlar tartibi darslar tartibini belgilaydi."])
    y.append([
        "Fayl yuklangach reja QORALAMA boʻladi — "
        "«Joriy qilish»dan keyin ustozlarga koʻrinadi."
    ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ─────────────────────────── Import ───────────────────────────


def _parse_xlsx(data: bytes) -> tuple[list[dict], list[str]]:
    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001 — foydalanuvchi faylı, har xil buzilishi mumkin
        raise ValidationError("Fayl ochilmadi — .xlsx shablon yuklang.") from e

    ws = wb["Reja"] if "Reja" in wb.sheetnames else wb.active
    warnings: list[str] = []
    lessons: list[dict] = []

    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if row is None or all(v is None or str(v).strip() == "" for v in row):
            continue
        chorak_raw, mavzu, tur, model, maqsad, lugat, nazariya, amaliy, uyga, resurslar = (
            list(row) + [None] * 10
        )[:10]

        if mavzu is None or not str(mavzu).strip():
            warnings.append(f"{idx}-qator: mavzu boʻsh — oʻtkazib yuborildi.")
            continue
        try:
            chorak = int(chorak_raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            chorak = 0
        if chorak < 1 or chorak > 4:
            warnings.append(f"{idx}-qator: chorak 1–4 boʻlishi kerak — 1 deb olindi.")
            chorak = 1

        tur_s = str(tur).strip().lower() if tur else "qurish"
        if tur_s not in TYPES:
            warnings.append(f"{idx}-qator: nomaʼlum tur «{tur_s}» — «qurish» deb olindi.")
            tur_s = "qurish"

        dars: dict = {
            "chorak": chorak,
            "title": _toza(str(mavzu)),
            "type": tur_s,
            "model": _toza(str(model)) if model and str(model).strip() else None,
        }
        if _lines(maqsad):
            dars["maqsad"] = _lines(maqsad)
        if _lines(lugat):
            dars["lugat"] = _lines(lugat)
        if _lines(nazariya):
            dars["nazariya"] = [{"title": "Nazariy qism", "points": _lines(nazariya)}]
        if _lines(amaliy):
            dars["amaliy"] = [{"title": "Amaliy qism", "points": _lines(amaliy)}]
        if _lines(uyga):
            dars["uyga"] = _lines(uyga)
        if _lines(resurslar):
            dars["resurslar"] = _lines(resurslar)
        lessons.append(dars)

    if not lessons:
        raise ValidationError("Faylda birorta ham dars topilmadi.")
    if len(lessons) > MAX_LESSONS:
        raise ValidationError(f"Darslar soni {MAX_LESSONS} dan oshmasin.")
    # Chorak boʻyicha barqaror tartib (fayl tartibi saqlangan holda).
    lessons.sort(key=lambda d: d["chorak"])
    return lessons, warnings


async def import_plan(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    fan: str,
    yil: str,
    sinf: str,
    data: bytes,
    source_name: str | None,
    ip: str | None = None,
) -> ImportResult:
    fan = _toza(fan)
    if not fan:
        raise ValidationError("Fan nomi boʻsh boʻlmasin.")
    if yil not in PROGRAM_YEARS:
        raise ValidationError("Yil «1-yil» yoki «2-yil» boʻlsin.")
    sinf = sinf.strip()
    if not sinf:
        raise ValidationError("Sinf koʻrsatilsin.")

    lessons, warnings = _parse_xlsx(data)

    plan = CurriculumPlan(
        fan=fan,
        yil=yil,
        sinf=sinf,
        status=CurriculumStatus.QORALAMA.value,
        source_name=(source_name or "").strip()[:200] or None,
        lessons=lessons,
        created_by_id=actor.id,
    )
    session.add(plan)
    await session.flush()
    audit_service.record(
        session,
        object_type="curriculum_plan",
        object_id=plan.id,
        action=AuditAction.CREATE,
        new={"fan": fan, "yil": yil, "sinf": sinf, "darslar": len(lessons)},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return ImportResult(plan=plan, warnings=warnings)


# ─────────────────────────── Roʻyxat / joriy ───────────────────────────


async def list_plans(session: AsyncSession) -> list[CurriculumPlan]:
    rows = await session.execute(
        select(CurriculumPlan)
        .where(CurriculumPlan.is_archived.is_(False))
        .order_by(
            CurriculumPlan.fan,
            CurriculumPlan.yil,
            CurriculumPlan.sinf,
            CurriculumPlan.created_at.desc(),
        )
    )
    return list(rows.scalars())


async def get_plan(session: AsyncSession, plan_id: uuid.UUID) -> CurriculumPlan:
    plan = await session.get(CurriculumPlan, plan_id)
    if plan is None or plan.is_archived:
        raise NotFoundError("Reja topilmadi.")
    return plan


async def publish(
    session: AsyncSession,
    actor: CurrentUser,
    plan_id: uuid.UUID,
    *,
    ip: str | None = None,
) -> CurriculumPlan:
    """Rejani JORIY qiladi; shu (fan, yil, sinf)ning eski joriysi ARXIV."""
    plan = await get_plan(session, plan_id)
    if plan.status == CurriculumStatus.JORIY.value:
        raise ConflictError("Bu reja allaqachon joriy.")

    eski = (
        await session.execute(
            select(CurriculumPlan).where(
                CurriculumPlan.fan == plan.fan,
                CurriculumPlan.yil == plan.yil,
                CurriculumPlan.sinf == plan.sinf,
                CurriculumPlan.status == CurriculumStatus.JORIY.value,
                CurriculumPlan.is_archived.is_(False),
            )
        )
    ).scalars()
    for e in eski:
        e.status = CurriculumStatus.ARXIV.value

    plan.status = CurriculumStatus.JORIY.value
    audit_service.record(
        session,
        object_type="curriculum_plan",
        object_id=plan.id,
        action=AuditAction.UPDATE,
        old={"status": "qoralama"},
        new={"status": "joriy", "fan": plan.fan, "yil": plan.yil, "sinf": plan.sinf},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return plan


async def archive(
    session: AsyncSession, actor: CurrentUser, plan_id: uuid.UUID, *, ip: str | None = None
) -> None:
    plan = await get_plan(session, plan_id)
    plan.is_archived = True
    plan.archived_at = utcnow()
    audit_service.record(
        session,
        object_type="curriculum_plan",
        object_id=plan.id,
        action=AuditAction.ARCHIVE,
        old={"status": plan.status},
        new={"is_archived": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()


# ─────────────────────────── Eksport ───────────────────────────


def export_xlsx(plan: CurriculumPlan) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Reja"
    ws.append([c[0] for c in COLUMNS])
    for d in plan.lessons:
        naz = d.get("nazariya") or []
        ama = d.get("amaliy") or []
        ws.append([
            d.get("chorak", 1),
            d.get("title", ""),
            d.get("type", ""),
            d.get("model") or "",
            "\n".join(d.get("maqsad") or []),
            "\n".join(d.get("lugat") or []),
            "\n".join(pt for b in naz for pt in b.get("points", [])),
            "\n".join(pt for b in ama for pt in b.get("points", [])),
            "\n".join(d.get("uyga") or []),
            "\n".join(d.get("resurslar") or []),
        ])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ─────────────────── Ustozlar uchun joriy rejalar ───────────────────


async def published_catalog(session: AsyncSession) -> dict:
    """fan → yil → sinf → darslar soni (ustoz kabineti fan tanlagichi)."""
    rows = (
        await session.execute(
            select(CurriculumPlan).where(
                CurriculumPlan.status == CurriculumStatus.JORIY.value,
                CurriculumPlan.is_archived.is_(False),
            )
        )
    ).scalars()
    out: dict = {}
    for p in rows:
        out.setdefault(p.fan, {}).setdefault(p.yil, {})[p.sinf] = len(p.lessons)
    return out


async def published_plan(
    session: AsyncSession, *, fan: str, yil: str, sinf: str
) -> CurriculumPlan:
    plan = await session.scalar(
        select(CurriculumPlan).where(
            CurriculumPlan.fan == fan,
            CurriculumPlan.yil == yil,
            CurriculumPlan.sinf == sinf,
            CurriculumPlan.status == CurriculumStatus.JORIY.value,
            CurriculumPlan.is_archived.is_(False),
        )
    )
    if plan is None:
        raise NotFoundError("Bu fan/sinf uchun joriy reja yoʻq.")
    return plan
