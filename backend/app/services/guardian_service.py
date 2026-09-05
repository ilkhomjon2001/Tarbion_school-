"""Vasiylarni oʻquvchiga bogʻlash va uzish (T-009, AUT-03).

Bu modul butun loyihadagi eng nozik yozuv amalini bajaradi: `guardians`
jadvali 6-domen qoidasining va X-1 ning **yagona manbai**. Ota-ona
kabineti «qaysi bolani koʻrsataman» degan savolga aynan shu jadvaldan
javob oladi. Shu sabab uchta qoida bor.

**1. Bogʻlash hech qachon jimgina boshqa hisobga tushmaydi.**
Bir oilada ikki farzand boʻlsa, ota bitta hisob bilan ikkalasini
koʻrishi kerak — ya'ni mavjud hisobni qayta ishlatish zarur. Lekin
uni telefon raqami boʻyicha OʻZIMIZ tanlab qoʻysak, administrator
raqamda bitta xato qilganda bola butunlay begona odamning kabinetiga
tushib qolardi va buni hech kim sezmasdi.

Shuning uchun ikki yoʻl aniq ajratilgan:
  · `user_id` berilsa — mavjud hisobga bogʻlanadi (administrator kimga
    bogʻlayotganini koʻrib turibdi);
  · shaxsiy maʼlumot berilsa — yangi hisob ochiladi, lekin oʻsha telefon
    allaqachon boshqa vasiyda boʻlsa `409` qaytadi va xabar kimligini
    aytadi. Qaror administratorda qoladi, taxmin bizda emas.

**2. Uzish — arxivlash, oʻchirish emas** (1-qoida). Bogʻlanish uzilishi
bilan ota-onaning kirish huquqi shu zahoti yopiladi, lekin «kim qachon
kimga bogʻlangan edi» tarixi qoladi.

**3. Har oʻzgarish `audit_log` da.** 4-qoida baho, davomat va toʻlovni
nomlaydi; bu undan ham nozikroq — bu kimning nimani koʻrishini
oʻzgartiradi.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models import (
    AuditAction,
    Guardian,
    GuardianRelation,
    Permission,
    Role,
    RoleName,
    Student,
    User,
    UserRole,
)
from app.services import audit_service, permissions, user_service
from app.services.access import CurrentUser

RELATIONS = frozenset(r.value for r in GuardianRelation)


async def _assert_can_manage(session: AsyncSession, actor: CurrentUser) -> None:
    await permissions.assert_permission(session, actor, Permission.STUDENTS_MANAGE)


async def _get_student(session: AsyncSession, student_id: uuid.UUID) -> Student:
    student = await session.get(Student, student_id)
    if student is None or student.is_archived:
        # X-3: mavjud emasligi ham, ruxsat yoʻqligi ham bir xil koʻrinadi.
        raise NotFoundError("Oʻquvchi topilmadi.")
    return student


def _normalize_phone(phone: str | None) -> str | None:
    """Faqat raqamlar qoladi: «+998 90 123-45-67» va «998901234567» bir xil.

    Taqqoslash shu shakl ustida ketadi, aks holda bitta odam probel
    yoki chiziqcha tufayli ikkita hisob olardi.
    """
    if phone is None:
        return None
    faqat_raqam = "".join(ch for ch in phone if ch.isdigit())
    return faqat_raqam or None


async def _find_parent_by_phone(session: AsyncSession, phone: str) -> User | None:
    """Shu telefonli, arxivlanmagan ota-ona hisobi bormi.

    Taqqoslash bazada: raqam boʻlmagan belgilar SQL da olib tashlanadi.
    Hamma foydalanuvchini Python'ga tortib solishtirish maktab
    oʻsganda sekinlashardi.

    Tartib MAJBURIY. Yangi raqam qoʻyishda dublikat toʻsiladi
    (`set_guardian_phone`), lekin eski maʼlumotda ikkita vasiyda bir
    xil raqam turgan boʻlishi mumkin. `ORDER BY` boʻlmasa Postgres
    ikkovidan xohlaganini qaytaradi va bir xil soʻrov har safar boshqa
    odamni koʻrsatardi. Eng eski hisob tanlanadi — u koʻpincha
    haqiqiy egasi.
    """
    raqam = _normalize_phone(phone)
    if raqam is None:
        return None

    tozalangan = func.regexp_replace(User.phone, r"[^0-9]", "", "g")
    stmt = (
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(
            User.is_archived.is_(False),
            User.phone.is_not(None),
            tozalangan == raqam,
            Role.name == RoleName.PARENT.value,
        )
        .order_by(User.created_at, User.id)
        .limit(1)
    )
    return await session.scalar(stmt)


async def list_guardians(
    session: AsyncSession, student_id: uuid.UUID, *, include_archived: bool = False
) -> list[tuple[Guardian, User]]:
    """Oʻquvchining vasiylari. Kirish huquqi chaqiruvchida tekshiriladi."""
    stmt = (
        select(Guardian, User)
        .join(User, User.id == Guardian.user_id)
        .where(Guardian.student_id == student_id)
        .order_by(Guardian.is_primary.desc(), User.last_name)
    )
    if not include_archived:
        stmt = stmt.where(Guardian.is_archived.is_(False))
    return [(g, u) for g, u in (await session.execute(stmt)).all()]


async def update_guardian(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    user_id: uuid.UUID,
    last_name: str,
    first_name: str,
    middle_name: str | None,
    phone: str | None,
    address: str | None,
    profession: str | None,
    relation: str,
    ip: str | None = None,
) -> tuple[Guardian, User]:
    """Vasiy maʼlumotini tahrirlash (ADM-05, AUT-03).

    Login, parol va rol bu yerda oʻzgarmaydi — ular kirish huquqini
    belgilaydi. Familiya oʻzgarsa ham login OʻZGARMAYDI: u boshqa
    joylarda havola sifatida ishlatilgan boʻlishi mumkin va uni
    almashtirish odamni tizimdan uzib qoʻyardi.

    Bogʻlanish oʻquvchi orqali topiladi: `user_id` yolgʻiz yetarli
    emas, aks holda huquqi bor administrator istalgan foydalanuvchini
    shu yoʻldan tahrirlay olardi (X-5 — kirish sxemasi tor boʻlsin).
    """
    await _assert_can_manage(session, actor)

    if relation not in RELATIONS:
        raise ValidationError("Qarindoshlik turi notoʻgʻri.")
    if not last_name.strip() or not first_name.strip():
        raise ValidationError("Familiya va ism boʻsh boʻlmasin.")

    link = await session.scalar(
        select(Guardian).where(
            Guardian.student_id == student_id,
            Guardian.user_id == user_id,
            Guardian.is_archived.is_(False),
        )
    )
    if link is None:
        raise NotFoundError("Ota-ona topilmadi.")

    user = await session.get(User, user_id)
    if user is None or user.is_archived:
        raise NotFoundError("Ota-ona topilmadi.")

    raqam = _normalize_phone(phone)
    if raqam is not None and raqam != _normalize_phone(user.phone):
        band = await _find_parent_by_phone(session, raqam)
        if band is not None and band.id != user.id:
            raise ConflictError(
                f"Bu telefon allaqachon boshqa ota-onaga biriktirilgan: {band.full_name}."
            )

    eski = {
        "last_name": user.last_name,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "phone": user.phone,
        "address": user.address,
        "profession": user.profession,
        "relation": link.relation,
    }

    user.last_name = last_name.strip()
    user.first_name = first_name.strip()
    user.middle_name = (middle_name or "").strip() or None
    user.phone = raqam
    user.address = (address or "").strip() or None
    user.profession = (profession or "").strip() or None
    link.relation = relation

    yangi = {
        "last_name": user.last_name,
        "first_name": user.first_name,
        "middle_name": user.middle_name,
        "phone": user.phone,
        "address": user.address,
        "profession": user.profession,
        "relation": link.relation,
    }

    if eski != yangi:
        audit_service.record(
            session,
            object_type="guardian",
            object_id=link.id,
            action=AuditAction.UPDATE,
            old=eski,
            new=yangi,
            actor_id=actor.id,
            ip=ip,
        )
    await session.commit()
    return link, user


async def link_existing(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    user_id: uuid.UUID,
    relation: str,
    is_primary: bool = False,
    ip: str | None = None,
) -> Guardian:
    """Mavjud hisobni oʻquvchiga vasiy qilib bogʻlaydi.

    Ikkinchi farzand shu yerdan qoʻshiladi — yangi hisob ochilmaydi.
    """
    await _assert_can_manage(session, actor)
    await _get_student(session, student_id)

    if relation not in RELATIONS:
        raise ValidationError("Qarindoshlik turi notoʻgʻri.")

    user = await session.get(User, user_id)
    if user is None or user.is_archived:
        raise NotFoundError("Foydalanuvchi topilmadi.")

    mavjud = await session.scalar(
        select(Guardian).where(
            Guardian.student_id == student_id, Guardian.user_id == user_id
        )
    )
    if mavjud is not None and not mavjud.is_archived:
        raise ConflictError(f"{user.full_name} allaqachon shu oʻquvchining ota-onasi.")

    await _ensure_parent_role(session, user)

    if mavjud is not None:
        # Arxivdagi bogʻlanish qaytariladi — yangisi yaratilmaydi, aks
        # holda bitta juftlik uchun ikkita yozuv paydo boʻlardi va
        # unique constraint yiqilardi.
        mavjud.is_archived = False
        mavjud.archived_at = None
        mavjud.relation = relation
        bogʻlanish = mavjud
        amal = AuditAction.UPDATE
        eski: dict[str, object] | None = {"is_archived": True}
    else:
        bogʻlanish = Guardian(
            student_id=student_id,
            user_id=user_id,
            relation=relation,
            is_primary=False,
        )
        session.add(bogʻlanish)
        await session.flush()
        amal = AuditAction.CREATE
        eski = None

    if is_primary:
        await _set_primary(session, student_id, bogʻlanish)

    audit_service.record(
        session,
        object_type="guardian",
        object_id=bogʻlanish.id,
        action=amal,
        old=eski,
        new={
            "student_id": str(student_id),
            "user_id": str(user_id),
            "relation": relation,
            "is_primary": bogʻlanish.is_primary,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return bogʻlanish


async def create_and_link(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    last_name: str,
    first_name: str,
    middle_name: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    relation: str,
    is_primary: bool = False,
    ip: str | None = None,
) -> tuple[Guardian, user_service.CreatedUser]:
    """Yangi ota-ona hisobi ochib, oʻquvchiga bogʻlaydi (T-009 mezoni).

    Boshlangʻich parol javobda BIR MARTA qaytadi — xodim yaratishdagi
    kabi. Bazada faqat xeshi qoladi.

    Telefon allaqachon boshqa ota-onada boʻlsa `409`: bu koʻpincha
    ikkinchi farzand demakdir va mavjud hisobga bogʻlash kerak. Buni
    oʻzimiz qilib qoʻymaymiz — xabar kimligini aytadi, administrator
    tanlaydi.
    """
    await _assert_can_manage(session, actor)
    await _get_student(session, student_id)

    if relation not in RELATIONS:
        raise ValidationError("Qarindoshlik turi notoʻgʻri.")

    if phone:
        bor = await _find_parent_by_phone(session, phone)
        if bor is not None:
            raise ConflictError(
                f"Bu telefon {bor.full_name} hisobiga tegishli. Yangi hisob ochish "
                f"oʻrniga oʻsha hisobni ota-ona qilib bogʻlang."
            )

    yaratildi = await user_service.create_user(
        session,
        actor=actor,
        last_name=last_name,
        first_name=first_name,
        middle_name=middle_name,
        roles=[RoleName.PARENT.value],
        phone=phone,
        email=email,
        ip=ip,
    )

    bogʻlanish = Guardian(
        student_id=student_id,
        user_id=yaratildi.user.id,
        relation=relation,
        is_primary=False,
    )
    session.add(bogʻlanish)
    await session.flush()

    if is_primary:
        await _set_primary(session, student_id, bogʻlanish)

    audit_service.record(
        session,
        object_type="guardian",
        object_id=bogʻlanish.id,
        action=AuditAction.CREATE,
        old=None,
        new={
            "student_id": str(student_id),
            "user_id": str(yaratildi.user.id),
            "relation": relation,
            "is_primary": bogʻlanish.is_primary,
        },
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return bogʻlanish, yaratildi


async def set_primary(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    ip: str | None = None,
) -> Guardian:
    """Asosiy vasiyni belgilaydi — xabarnoma birinchi navbatda shunga ketadi."""
    await _assert_can_manage(session, actor)

    bogʻlanish = await _get_link(session, student_id, guardian_id)
    await _set_primary(session, student_id, bogʻlanish)

    audit_service.record(
        session,
        object_type="guardian",
        object_id=bogʻlanish.id,
        action=AuditAction.UPDATE,
        old={"is_primary": False},
        new={"is_primary": True},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return bogʻlanish


async def unlink(
    session: AsyncSession,
    *,
    actor: CurrentUser,
    student_id: uuid.UUID,
    guardian_id: uuid.UUID,
    reason: str,
    ip: str | None = None,
) -> Guardian:
    """Bogʻlanishni arxivlaydi — kirish huquqi shu zahoti yopiladi.

    Sabab majburiy: bu odamning farzandi haqidagi maʼlumotga kirishini
    toʻxtatadi va keyin «nega uzilgan edi» degan savol albatta chiqadi.
    """
    await _assert_can_manage(session, actor)

    if len(reason.strip()) < 2:
        raise ValidationError("Uzish sababi koʻrsatilsin.")

    bogʻlanish = await _get_link(session, student_id, guardian_id)
    bogʻlanish.is_archived = True
    bogʻlanish.is_primary = False

    audit_service.record(
        session,
        object_type="guardian",
        object_id=bogʻlanish.id,
        action=AuditAction.ARCHIVE,
        old={"is_archived": False, "user_id": str(bogʻlanish.user_id)},
        new={"is_archived": True, "reason": reason.strip()},
        actor_id=actor.id,
        ip=ip,
    )
    await session.commit()
    return bogʻlanish


# ─────────────────────────── Ichki yordamchilar ───────────────────────────


async def _get_link(
    session: AsyncSession, student_id: uuid.UUID, guardian_id: uuid.UUID
) -> Guardian:
    bogʻlanish = await session.get(Guardian, guardian_id)
    # `student_id` ham tekshiriladi: boshqa oʻquvchining bogʻlanishini
    # id boʻyicha oʻzgartirib boʻlmasin.
    if bogʻlanish is None or bogʻlanish.student_id != student_id or bogʻlanish.is_archived:
        raise NotFoundError("Ota-ona bogʻlanishi topilmadi.")
    return bogʻlanish


async def _set_primary(
    session: AsyncSession, student_id: uuid.UUID, bogʻlanish: Guardian
) -> None:
    """Bitta oʻquvchida bitta asosiy vasiy boʻladi."""
    rows = await session.execute(
        select(Guardian).where(
            Guardian.student_id == student_id, Guardian.is_archived.is_(False)
        )
    )
    for g in rows.scalars():
        g.is_primary = g.id == bogʻlanish.id
    await session.flush()


async def _ensure_parent_role(session: AsyncSession, user: User) -> None:
    """Vasiy qilib bogʻlangan hisobda `parent` roli boʻlishi shart.

    Rolsiz u ota-ona kabinetiga kira olmasdi va bogʻlanish maʼnosiz
    qolardi.
    """
    if RoleName.PARENT.value in user.role_names:
        return

    rol = await session.scalar(select(Role).where(Role.name == RoleName.PARENT.value))
    if rol is not None:
        session.add(UserRole(user_id=user.id, role_id=rol.id))
        await session.flush()


async def children_count(session: AsyncSession, user_id: uuid.UUID) -> int:
    """Shu hisobga nechta farzand bogʻlangan — interfeysda ogohlantirish uchun."""
    return (
        await session.scalar(
            select(func.count(Guardian.id)).where(
                Guardian.user_id == user_id, Guardian.is_archived.is_(False)
            )
        )
    ) or 0


@dataclass(frozen=True, slots=True)
class PhoneMatch:
    """Telefon boʻyicha topilgan mavjud vasiy."""

    user_id: uuid.UUID
    full_name: str
    relation: str | None  # shu telefonli hisobning birinchi bogʻlanishidagi
    children_count: int
    #: Farzandlarining ismi — administrator «bu oʻsha oilami» deb qaror qiladi.
    children: list[str]
    #: Shu oʻquvchining vasiysi boʻlib boʻlganmi — «biriktirish» taklif
    #: qilinmasin.
    already_linked: bool


async def find_by_phone(
    session: AsyncSession,
    actor: CurrentUser,
    *,
    student_id: uuid.UUID,
    phone: str,
) -> PhoneMatch | None:
    """Telefon allaqachon ota-onada bormi — YOZISHDAN OLDIN.

    Ilgari bu faqat `409` xatosi orqali bilinardi: administrator butun
    shaklni toʻldirib, yuborib, keyin «bu telefon falonchida» degan
    xabarni koʻrardi va nima qilishni bilmasdi — mavjud hisobga
    bogʻlash yoʻli interfeysda umuman yoʻq edi.

    Endi raqam kiritilishi bilan tekshiriladi va «shu vasiyga bu
    oʻquvchi ham biriktirilsinmi» deb soʻraladi.

    Huquq `students.manage` — vasiy qoʻshish bilan bir xil. Bu ataylab
    tor: aks holda endpoint telefon raqamlarini sanab chiqish yoʻliga
    aylanardi (X-6).
    """
    await _assert_can_manage(session, actor)
    await _get_student(session, student_id)

    topildi = await _find_parent_by_phone(session, phone)
    if topildi is None:
        return None

    rows = (
        await session.execute(
            select(Guardian, Student)
            .join(Student, Student.id == Guardian.student_id)
            .where(
                Guardian.user_id == topildi.id,
                Guardian.is_archived.is_(False),
                Student.is_archived.is_(False),
            )
            .order_by(Student.last_name, Student.first_name)
        )
    ).all()

    return PhoneMatch(
        user_id=topildi.id,
        full_name=topildi.full_name,
        relation=rows[0][0].relation if rows else None,
        children_count=len(rows),
        children=[s.full_name for _, s in rows],
        already_linked=any(g.student_id == student_id for g, _ in rows),
    )
