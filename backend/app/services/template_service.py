"""Xabar shablonlari (T-019, BOT-05).

Sukut boʻyicha matnlar SHU YERDA, bazada esa faqat administrator
oʻzgartirgani. Sabab: boʻsh bazada ham tizim toʻliq ishlashi kerak, va
yangi xabar turi qoʻshilganda migratsiya bilan qator yozish shart
boʻlmasin. Baza — ustama, manba emas.

Oʻrin egallovchi maydonlar jingalak qavsda. Ular **oq roʻyxat** bilan
cheklangan: administrator `{parol}` yoki `{telefon}` deb yozib, xabarga
tasodifan boshqa maʼlumot chiqarib yubormasin. Nomaʼlum maydon
saqlashda rad etiladi — yuborish paytida emas, chunki oʻshanda xato
tunda, hech kim koʻrmaydigan payt chiqardi.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.models import AuditAction, MessageTemplate, Permission
from app.services import audit_service, permissions
from app.services.access import CurrentUser


@dataclass(frozen=True, slots=True)
class Template:
    kind: str
    title: str
    body: str
    #: Shu turda ishlatish mumkin boʻlgan maydonlar.
    fields: tuple[str, ...]
    label: str
    #: Administrator oʻzgartirganmi (interfeys «sukut» belgisini
    #: koʻrsatishi uchun).
    customized: bool = False


#: Sukut boʻyicha matnlar. Kalit — `outbox` dagi `kind`.
DEFAULTS: dict[str, Template] = {
    "attendance_absent": Template(
        kind="attendance_absent",
        label="Farzand darsga kelmadi",
        title="{student_name} darsga kelmadi",
        body=(
            "{date} · {subject} · {period}-dars\n\n"
            "Sabab boʻlsa sinf rahbariga xabar bering."
        ),
        fields=("student_name", "date", "subject", "period", "class_name"),
    ),
    "attendance_late": Template(
        kind="attendance_late",
        label="Farzand darsga kechikdi",
        title="{student_name} darsga kechikdi",
        body="{date} · {subject} · {period}-dars",
        fields=("student_name", "date", "subject", "period", "class_name"),
    ),
    "attendance_daily": Template(
        kind="attendance_daily",
        label="Kunlik davomat xulosasi",
        title="{student_name} — {date} kungi davomat",
        body=(
            "Darslar: {total}\n"
            "Keldi: {present}\n"
            "Kelmadi: {absent}\n"
            "Sababli: {excused}\n"
            "Kechikdi: {late}"
        ),
        fields=(
            "student_name",
            "date",
            "total",
            "present",
            "absent",
            "excused",
            "late",
            "class_name",
        ),
    ),
    "account_created": Template(
        kind="account_created",
        label="Tizimga kirish maʼlumotlari",
        title="Tarbion tizimiga kirish",
        body=(
            "Hurmatli {full_name}, sizga hisob ochildi.\n\n"
            "Sayt: {site}\nLogin: {login}\n\n"
            "Parolni maktab administratori ogʻzaki aytadi."
        ),
        # `{parol}` ATAYLAB yoʻq: parol Telegramga yozilmaydi (X-10).
        fields=("full_name", "login", "site"),
    ),
}

#: Matndagi `{maydon}` larni topadi.
_MAYDON = re.compile(r"\{([a-z_]+)\}")


def _tekshir(matn: str, ruxsat: tuple[str, ...], qayerda: str) -> None:
    topilgan = set(_MAYDON.findall(matn))
    notogri = sorted(topilgan - set(ruxsat))
    if notogri:
        raise ValidationError(
            f"{qayerda}: nomaʼlum maydon — {', '.join('{' + m + '}' for m in notogri)}. "
            f"Ruxsat etilganlar: {', '.join('{' + m + '}' for m in ruxsat)}"
        )


async def get(session: AsyncSession, kind: str) -> Template:
    """Amaldagi shablon: bazadagi ustama boʻlsa u, boʻlmasa sukut."""
    sukut = DEFAULTS.get(kind)
    if sukut is None:
        raise ValidationError(f"Nomaʼlum xabar turi: {kind}")

    row = await session.scalar(
        select(MessageTemplate).where(
            MessageTemplate.kind == kind, MessageTemplate.is_archived.is_(False)
        )
    )
    if row is None:
        return sukut
    return Template(
        kind=kind,
        label=sukut.label,
        title=row.title,
        body=row.body,
        fields=sukut.fields,
        customized=True,
    )


async def list_all(session: AsyncSession, user: CurrentUser) -> list[Template]:
    """Barcha shablonlar — administrator ekrani uchun."""
    await permissions.assert_permission(session, user, Permission.ANNOUNCEMENTS_PUBLISH)
    return [await get(session, kind) for kind in DEFAULTS]


async def set_template(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    kind: str,
    title: str,
    body: str,
    ip: str | None = None,
) -> Template:
    """Shablonni oʻzgartiradi (BOT-05)."""
    await permissions.assert_permission(session, actor, Permission.ANNOUNCEMENTS_PUBLISH)

    sukut = DEFAULTS.get(kind)
    if sukut is None:
        raise ValidationError(f"Nomaʼlum xabar turi: {kind}")

    title = title.strip()
    body = body.strip()
    if not title or not body:
        raise ValidationError("Sarlavha va matn boʻsh boʻlmasin.")
    _tekshir(title, sukut.fields, "Sarlavha")
    _tekshir(body, sukut.fields, "Matn")

    row = await session.scalar(select(MessageTemplate).where(MessageTemplate.kind == kind))
    eski = {"title": row.title, "body": row.body} if row else None
    if row is None:
        row = MessageTemplate(kind=kind, title=title, body=body, updated_by_id=actor.id)
        session.add(row)
    else:
        row.title = title
        row.body = body
        row.updated_by_id = actor.id
        row.is_archived = False
        row.archived_at = None

    audit_service.record(
        session,
        object_type="message_template",
        object_id=row.id,
        action=AuditAction.UPDATE if eski else AuditAction.CREATE,
        old=eski,
        new={"kind": kind, "title": title, "body": body},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return Template(
        kind=kind, label=sukut.label, title=title, body=body,
        fields=sukut.fields, customized=True,
    )


async def reset(
    session: AsyncSession, *, actor: CurrentUser, kind: str, ip: str | None = None
) -> Template:
    """Sukut matnga qaytaradi. Ustama arxivlanadi, oʻchirilmaydi."""
    await permissions.assert_permission(session, actor, Permission.ANNOUNCEMENTS_PUBLISH)
    sukut = DEFAULTS.get(kind)
    if sukut is None:
        raise ValidationError(f"Nomaʼlum xabar turi: {kind}")

    row = await session.scalar(
        select(MessageTemplate).where(
            MessageTemplate.kind == kind, MessageTemplate.is_archived.is_(False)
        )
    )
    if row is not None:
        row.is_archived = True
        audit_service.record(
            session,
            object_type="message_template",
            object_id=row.id,
            action=AuditAction.UPDATE,
            old={"title": row.title, "body": row.body},
            new={"reset_to_default": True},
            actor_id=actor.id,
            ip=ip,
        )
        await session.commit()
    return sukut


def render(tpl: Template, **qiymatlar: object) -> tuple[str, str]:
    """Shablonni toʻldiradi. Qaytaradi: `(sarlavha, matn)`.

    Yetishmagan maydon oʻrniga «—» qoʻyiladi. `KeyError` koʻtarilsa
    xabar butunlay yuborilmasdan qolardi — bitta boʻsh maydon uchun
    ota-ona farzandi darsga kelmaganini bilmay qolishi juda qimmat.
    """
    xavfsiz = {k: ("—" if v is None else str(v)) for k, v in qiymatlar.items()}

    def almashtir(m: re.Match[str]) -> str:
        return xavfsiz.get(m.group(1), m.group(0))

    return (_MAYDON.sub(almashtir, tpl.title), _MAYDON.sub(almashtir, tpl.body))


async def render_kind(
    session: AsyncSession, kind: str, **qiymatlar: object
) -> tuple[str, str]:
    return render(await get(session, kind), **qiymatlar)


__all__ = [
    "DEFAULTS",
    "Template",
    "get",
    "list_all",
    "render",
    "render_kind",
    "reset",
    "set_template",
]
