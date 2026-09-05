"""Murojaatlar biznes mantigʻi va kirish nazorati (MUR-01…MUR-06).

Modulning yuragi — `visible_appeals()`. U roʻyxatni olib keyin filtrlamaydi,
balki SOʻROVGA shart qoʻshadi. Farqi muhim: filtrlash usulida bitta unutilgan
joy butun maktabning yozishmasini ochib yuboradi.

Nega `is_staff_wide` ishlatilmadi
---------------------------------
`access.py` dagi `is_staff_wide` ichida oʻquv boʻlimi (`academic`) ham bor —
u oʻquv jarayonini barcha sinflar kesimida koʻradi. Lekin murojaat oʻquv
maʼlumoti emas: unda oilaviy holat, toʻlov qiyinchiligi, sogʻliq haqida gap
boradi. Shu sabab bu yerda ruxsat ALOHIDA roʻyxat bilan beriladi —
`access.py` dagi izohda aytilgan «moliya endpointlari alohida tekshiruv
qoʻyadi» qoidasining aynan shu holati.
"""

import uuid
from collections.abc import Sequence
from datetime import timedelta

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from app.core.timeutil import utcnow
from app.models import (
    Appeal,
    AppealMessage,
    AppealNote,
    AppealStatus,
    AppealTarget,
    Guardian,
    NotificationKind,
    RoleName,
    SchoolClass,
    Student,
    Subject,
    User,
)
from app.services import audit_service, notifications_service
from app.services.access import CurrentUser, homeroom_class_ids

# MUR-04: javob berish muddati. Uch kun — maktab ish ritmi: dushanba kelgan
# murojaatga payshanbagacha javob beriladi. Oʻzgarsa, eski murojaatlarning
# muddati qayta hisoblanmaydi (`due_at` yaratilishda qotib qoladi).
RESPONSE_DAYS = 3

# Murojaatlarni butun maktab kesimida koʻra oladigan rollar. `academic`
# ataylab yoʻq — yuqoridagi izohga qarang.
APPEAL_WIDE_ROLES = (
    RoleName.ADMIN.value,
    RoleName.DIRECTOR.value,
    RoleName.SUPERADMIN.value,
)

# Ichki qaydlarni (`AppealNote`) koʻra oladigan rollar. Direktor ham kiradi:
# u sifat nazoratida «bu oila bilan nima qilingan» degan savolga javob
# izlaydi. Ustoz va ota-ona hech qachon koʻrmaydi.
NOTE_ROLES = APPEAL_WIDE_ROLES


def can_see_all(user: CurrentUser) -> bool:
    return user.has(*APPEAL_WIDE_ROLES)


def can_read_notes(user: CurrentUser) -> bool:
    return user.has(*NOTE_ROLES)


async def _scope(session: AsyncSession, user: CurrentUser):
    """Foydalanuvchi uchun `WHERE` sharti. `None` = cheklovsiz.

    Qaytadigan qiymat toʻgʻridan-toʻgʻri soʻrovga qoʻyiladi — chaqiruvchi
    uni «unutib qoʻysa» kod ishlamaydi, chunki `visible_appeals()` dan
    boshqa yoʻl bilan murojaat olinmaydi.
    """
    if can_see_all(user):
        return None

    terms = []

    # Ota-ona: oʻzi yozganlari. Faqat `author_id` yetarli emas — vasiylik
    # bekor qilingan boʻlishi mumkin, shuning uchun bola ham tekshiriladi.
    if user.has(RoleName.PARENT.value):
        child_ids = set(
            (
                await session.execute(
                    select(Guardian.student_id).where(
                        Guardian.user_id == user.id, Guardian.is_archived.is_(False)
                    )
                )
            ).scalars()
        )
        if child_ids:
            terms.append(
                and_(Appeal.author_id == user.id, Appeal.student_id.in_(child_ids))
            )

    if user.is_teacher:
        # Oʻziga biriktirilgani.
        terms.append(Appeal.assignee_id == user.id)
        # Sinf rahbari: oʻz sinfiga yozilgan «sinf rahbari» murojaatlari.
        # Masʼul almashtirilgan boʻlsa ham sinf rahbari koʻrishi kerak —
        # DAV-02 mantigʻi: sinf uning javobgarligida.
        class_ids = await homeroom_class_ids(session, user.id)
        if class_ids:
            terms.append(
                and_(
                    Appeal.target == AppealTarget.HOMEROOM.value,
                    Appeal.student_id.in_(
                        select(Student.id).where(Student.class_id.in_(class_ids))
                    ),
                )
            )

    if not terms:
        # Hech qanday asos yoʻq → hech narsa koʻrinmaydi. `False` sharti
        # ataylab: boʻsh roʻyxat qaytarish shartni butunlay tushirib
        # qoldirishdan xavfsizroq.
        return Appeal.id.is_(None)
    return or_(*terms)


def _detail_query() -> Select:
    """Murojaat + koʻrsatish uchun kerak boʻlgan nomlar.

    Ismlar JOIN bilan olinadi: frontend har bir murojaat uchun alohida
    «kim edi bu?» soʻrovi yubormasin.
    """
    author = User.__table__.alias("author")
    assignee = User.__table__.alias("assignee")
    opener = User.__table__.alias("opener")
    return (
        select(
            Appeal,
            Student.last_name,
            Student.first_name,
            SchoolClass.name,
            author.c.last_name,
            author.c.first_name,
            assignee.c.last_name,
            assignee.c.first_name,
            Subject.name,
            opener.c.last_name,
            opener.c.first_name,
        )
        .select_from(Appeal)
        .join(Student, Student.id == Appeal.student_id)
        .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
        .join(author, author.c.id == Appeal.author_id)
        .outerjoin(assignee, assignee.c.id == Appeal.assignee_id)
        .outerjoin(Subject, Subject.id == Appeal.subject_id)
        .outerjoin(opener, opener.c.id == Appeal.created_by_id)
    )


async def visible_appeals(
    session: AsyncSession,
    user: CurrentUser,
    *,
    status: str | None = None,
    target: str | None = None,
    limit: int = 100,
) -> Sequence[tuple]:
    """Foydalanuvchi koʻrishga haqli murojaatlar, oxirgi faollik boʻyicha."""
    query = _detail_query().where(Appeal.is_archived.is_(False))

    scope = await _scope(session, user)
    if scope is not None:
        query = query.where(scope)

    if status:
        query = query.where(Appeal.status == status)
    if target:
        query = query.where(Appeal.target == target)

    query = query.order_by(
        func.coalesce(Appeal.last_message_at, Appeal.created_at).desc()
    ).limit(limit)
    return (await session.execute(query)).all()


async def load_appeal(session: AsyncSession, user: CurrentUser, appeal_id: uuid.UUID) -> tuple:
    """Bitta murojaat — kirish huquqi bilan birga tekshiriladi.

    Ruxsat yoʻq boʻlsa `403`, `404` emas (X-3): `404` murojaat mavjudligini
    oshkor qilardi va id'larni sanab chiqishga yoʻl ochardi.
    """
    query = _detail_query().where(Appeal.id == appeal_id)
    scope = await _scope(session, user)
    if scope is not None:
        query = query.where(scope)

    row = (await session.execute(query)).first()
    if row is None:
        # Mavjud emasmi yoki ruxsat yoʻqmi — farqi bilinmasin.
        raise PermissionDeniedError("Bu murojaatni koʻrishga ruxsatingiz yoʻq.")
    return row


async def thread(session: AsyncSession, appeal_id: uuid.UUID) -> Sequence[tuple]:
    """Yozishma xabarlari. Kirish huquqi CHAQIRUVCHIDA tekshirilgan boʻlishi
    shart — bu funksiya `load_appeal()` dan keyin chaqiriladi."""
    rows = await session.execute(
        select(AppealMessage, User.last_name, User.first_name)
        .join(User, User.id == AppealMessage.author_id)
        .where(
            AppealMessage.appeal_id == appeal_id,
            AppealMessage.is_archived.is_(False),
        )
        .order_by(AppealMessage.created_at)
    )
    return rows.all()


async def resolve_assignee(
    session: AsyncSession,
    *,
    target: str,
    student_id: uuid.UUID,
    subject_id: uuid.UUID | None,
    requested_id: uuid.UUID | None,
) -> uuid.UUID | None:
    """Murojaat kimga tushishini aniqlaydi.

    Ota-ona `assignee_id` yuborishi mumkin (fan oʻqituvchisini tanlagan),
    lekin u ISHONCHLI DEB QABUL QILINMAYDI: tanlangan xodim shu bolaning
    sinfida haqiqatan dars berayotganini tekshiramiz. Aks holda ota-ona
    murojaatni xohlagan xodimga — masalan direktorga — «fan oʻqituvchisi»
    niqobi ostida yuborib yuborardi.
    """
    if target == AppealTarget.HOMEROOM.value:
        # Sinf rahbari — bolaning sinfidan olinadi, soʻrovdan emas.
        return await session.scalar(
            select(SchoolClass.homeroom_teacher_id)
            .join(Student, Student.class_id == SchoolClass.id)
            .where(Student.id == student_id)
        )

    if target == AppealTarget.SUBJECT_TEACHER.value:
        if requested_id is None:
            raise ValidationError("Fan oʻqituvchisini tanlang.")
        # Ustoz shu sinfda shu fandan dars beradimi?
        from app.models import Lesson  # noqa: PLC0415 — aylanma importni oldini olish

        ok = await session.scalar(
            select(func.count())
            .select_from(Lesson)
            .join(Student, Student.class_id == Lesson.class_id)
            .where(
                Student.id == student_id,
                Lesson.teacher_id == requested_id,
                *( [Lesson.subject_id == subject_id] if subject_id else [] ),
            )
        )
        if not ok:
            raise ValidationError("Bu oʻqituvchi farzandingizga dars bermaydi.")
        return requested_id

    # Rahbariyat: masʼulni administrator taqsimlaydi. Direktorni avtomatik
    # qoʻyish notoʻgʻri boʻlardi — maktabda bir necha rahbar boʻlishi mumkin.
    return None


async def guardians_of(session: AsyncSession, student_id: uuid.UUID) -> list[tuple]:
    """Oʻquvchining vasiy hisoblari — xodim yozishma boshlaganda kerak.

    Maktab yozishmani KIMGA yozishini tanlamaydi: u oʻquvchini tanlaydi,
    vasiy shu yerdan olinadi. Shunda notoʻgʻri oilaga yozib yuborish
    ehtimoli yoʻqoladi.
    """
    rows = await session.execute(
        select(User.id, User.last_name, User.first_name, Guardian.relation, Guardian.is_primary)
        .join(Guardian, Guardian.user_id == User.id)
        .where(
            Guardian.student_id == student_id,
            Guardian.is_archived.is_(False),
            User.is_archived.is_(False),
        )
        .order_by(Guardian.is_primary.desc(), User.last_name)
    )
    return rows.all()


async def _recipients(
    session: AsyncSession, appeal: Appeal, *, to_family: bool
) -> list[notifications_service.Recipient]:
    """Yozishma boʻyicha xabar kimga boradi.

    Oilaga — har doim `author_id`, chunki yozishma OILAGA tegishli
    (maktab boshlagan boʻlsa ham).

    Maktabga — masʼul xodimga. Masʼul tayinlanmagan boʻlsa (rahbariyatga
    kelgan yangi murojaat) administrator va rahbariyatga: aks holda
    murojaat hech kimga koʻrinmay turib, MUR-04 muddati oʻtib ketardi.
    """
    student_id = appeal.student_id

    if to_family:
        return [
            notifications_service.Recipient(user_id=appeal.author_id, student_id=student_id)
        ]

    if appeal.assignee_id is not None:
        return [
            notifications_service.Recipient(user_id=appeal.assignee_id, student_id=student_id)
        ]

    xodimlar = await notifications_service.staff_recipients(session, APPEAL_WIDE_ROLES)
    return [
        notifications_service.Recipient(user_id=uid, student_id=student_id)
        for uid in xodimlar
    ]


async def create_appeal(
    session: AsyncSession,
    user: CurrentUser,
    *,
    student_id: uuid.UUID,
    target: str,
    title: str,
    body: str,
    subject_id: uuid.UUID | None = None,
    assignee_id: uuid.UUID | None = None,
    author_id: uuid.UUID | None = None,
) -> Appeal:
    """Yozishma ochish. Ikki yoʻl bor va ikkalasi ham shu yerdan oʻtadi.

    MUR-01 — ota-ona oʻzi yozadi. `author_id` eʼtiborga olinmaydi:
    ota-ona uni yuborib boshqa oila nomidan yozib yuborardi.

    ADM-16 — maktab birinchi boʻlib yozadi (administrator/rahbariyat).
    Bunda `author_id` — yozishma tegishli boʻlgan VASIY hisobi, va u
    shu oʻquvchining vasiysi ekani tekshiriladi. Berilmasa asosiy vasiy
    olinadi.

    Ustoz bu yoʻldan foydalana olmaydi: ustoz ota-onaga yozmoqchi boʻlsa
    sinf rahbari yoki administrator orqali boradi — aks holda har bir
    ustoz istagan oilaga toʻgʻridan-toʻgʻri yozardi va bu nazoratsiz
    kanal boʻlib qolardi.
    """
    school_initiated = not user.has(RoleName.PARENT.value)

    if school_initiated:
        if not can_see_all(user):
            raise PermissionDeniedError("Yozishmani ota-ona yoki administrator boshlaydi.")

        family = await guardians_of(session, student_id)
        if not family:
            raise ValidationError("Bu oʻquvchiga ota-ona hisobi biriktirilmagan.")

        allowed = {row[0] for row in family}
        if author_id is None:
            author_id = family[0][0]  # asosiy vasiy — `guardians_of` tartibi
        elif author_id not in allowed:
            raise ValidationError("Tanlangan hisob bu oʻquvchining ota-onasi emas.")
    else:
        # Bola haqiqatan shu ota-onaning farzandimi — soʻrov darajasida.
        is_child = await session.scalar(
            select(func.count())
            .select_from(Guardian)
            .where(
                Guardian.user_id == user.id,
                Guardian.student_id == student_id,
                Guardian.is_archived.is_(False),
            )
        )
        if not is_child:
            raise PermissionDeniedError("Bu oʻquvchi boʻyicha murojaat yoza olmaysiz.")
        author_id = user.id

    if school_initiated:
        # Maktab boshlagan yozishma har doim `management`, masʼul esa uni
        # boshlagan xodim. Yoʻnaltirish qoidalari (sinf rahbari, fan
        # oʻqituvchisi) bu yerda qoʻllanmaydi: ular ota-ona «kimga
        # yozaman» deb tanlashi uchun. Oila tomonidan qaralganda esa
        # yozgan tomon bitta — «Rahbariyat».
        target = AppealTarget.MANAGEMENT.value
        subject_id = None
        resolved = user.id
    else:
        resolved = await resolve_assignee(
            session,
            target=target,
            student_id=student_id,
            subject_id=subject_id,
            requested_id=assignee_id,
        )

    now = utcnow()
    appeal = Appeal(
        student_id=student_id,
        author_id=author_id,
        # Ota-ona oʻzi ochsa `NULL` — «kim ochgan» savoli tugʻilmaydi.
        created_by_id=user.id if school_initiated else None,
        target=target,
        assignee_id=resolved,
        subject_id=subject_id if target == AppealTarget.SUBJECT_TEACHER.value else None,
        title=title.strip(),
        # Maktab boshlagan yozishma «yangi murojaat» emas — javob kutayotgan
        # tomon OTA-ONA. Uni `new` qoldirish administrator ekranidagi
        # «javob berilmagan» sanogʻini yolgʻon oshirardi.
        status=AppealStatus.IN_REVIEW.value if school_initiated else AppealStatus.NEW.value,
        # Maktabning oʻz savoliga javob berish muddati boʻlmaydi.
        due_at=None if school_initiated else now + timedelta(days=RESPONSE_DAYS),
        last_message_at=now,
    )
    session.add(appeal)
    await session.flush()

    # Birinchi xabar muallifi — kim yozgan boʻlsa oʻsha. Maktab boshlagan
    # yozishmada bu xodim: ota-onaning ogʻziga soʻz solinmaydi.
    session.add(AppealMessage(appeal_id=appeal.id, author_id=user.id, body=body.strip()))
    audit_service.record(
        session,
        object_type="appeal",
        object_id=appeal.id,
        action="create",
        new={
            "target": target,
            "title": appeal.title,
            "student_id": student_id,
            "author_id": author_id,
            "created_by_id": appeal.created_by_id,
        },
        actor_id=user.id,
    )

    # Maktab boshlagan yozishmada xabar OILAGA boradi, ota-ona
    # boshlaganida — maktabga. Yoʻnalish `school_initiated` ga bogʻliq,
    # `author_id` ga emas: maktab boshlagan yozishmada ham muallif
    # ota-ona boʻlib qoladi.
    await notifications_service.notify(
        session,
        recipients=await _recipients(session, appeal, to_family=school_initiated),
        kind=NotificationKind.APPEAL_NEW,
        title="Maktabdan xabar" if school_initiated else f"Yangi murojaat: {appeal.title}",
        body=body.strip()[:400],
        object_type="appeal",
        object_id=appeal.id,
        actor_id=user.id,
    )

    await session.flush()
    return appeal


async def add_message(
    session: AsyncSession, user: CurrentUser, appeal_id: uuid.UUID, body: str
) -> AppealMessage:
    """MUR-03: yozishmani davom ettirish.

    Kim javob bera oladi — `load_appeal()` allaqachon hal qiladi: koʻra
    olgan odam yoza ham oladi. Alohida qoida yozish takrorlash boʻlardi va
    ikki joyda ikki xil mantiq paydo boʻlish xavfini tugʻdirardi.
    """
    row = await load_appeal(session, user, appeal_id)
    appeal: Appeal = row[0]

    if appeal.status == AppealStatus.CLOSED.value and not can_see_all(user):
        raise ValidationError("Murojaat yopilgan. Yangi murojaat oching.")

    message = AppealMessage(appeal_id=appeal.id, author_id=user.id, body=body.strip())
    session.add(message)

    old_status = appeal.status
    is_parent = appeal.author_id == user.id
    if is_parent:
        # Ota-ona qayta yozdi → javob kutilmoqda.
        if appeal.status == AppealStatus.ANSWERED.value:
            appeal.status = AppealStatus.IN_REVIEW.value
        # Maktab boshlagan yozishmada muddat yoʻq edi. Ota-ona savol
        # berdi — endi javob berish navbati maktabda, MUR-04 muddati
        # shu paytdan sanaladi.
        if appeal.due_at is None:
            appeal.due_at = utcnow() + timedelta(days=RESPONSE_DAYS)
    else:
        appeal.status = AppealStatus.ANSWERED.value

    appeal.last_message_at = utcnow()

    if old_status != appeal.status:
        audit_service.record(
            session,
            object_type="appeal",
            object_id=appeal.id,
            action="update",
            old={"status": old_status},
            new={"status": appeal.status},
            actor_id=user.id,
        )

    # Xabar NARIGI tomonga boradi. Ota-ona yozgan boʻlsa — maktabga,
    # xodim yozgan boʻlsa — oilaga.
    await notifications_service.notify(
        session,
        recipients=await _recipients(session, appeal, to_family=not is_parent),
        kind=NotificationKind.APPEAL_MESSAGE,
        title=f"Yangi xabar: {appeal.title}",
        body=message.body[:400],
        object_type="appeal",
        object_id=appeal.id,
        actor_id=user.id,
    )

    await session.flush()
    return message


async def set_status(
    session: AsyncSession, user: CurrentUser, appeal_id: uuid.UUID, status: str
) -> Appeal:
    """MUR-05: holatni oʻzgartirish — faqat xodim.

    Ota-ona oʻz murojaatini «javob berildi» deb belgilay olmaydi: bu
    hisobotni buzardi va ustozning javob berish koʻrsatkichini yolgʻon
    yaxshilardi.
    """
    if user.has(RoleName.PARENT.value) and not can_see_all(user):
        raise PermissionDeniedError("Murojaat holatini xodim oʻzgartiradi.")

    row = await load_appeal(session, user, appeal_id)
    appeal: Appeal = row[0]

    old = appeal.status
    if old == status:
        return appeal

    appeal.status = status
    appeal.closed_at = utcnow() if status == AppealStatus.CLOSED.value else None

    audit_service.record(
        session,
        object_type="appeal",
        object_id=appeal.id,
        action="update",
        old={"status": old},
        new={"status": status},
        actor_id=user.id,
    )

    # Oilaga faqat yopilgani haqida xabar beriladi. «Koʻrib chiqilmoqda»
    # kabi oraliq holatlar ota-onaga qiziq emas va qoʻngʻiroqni
    # keraksiz toʻldirardi.
    if status == AppealStatus.CLOSED.value:
        await notifications_service.notify(
            session,
            recipients=await _recipients(session, appeal, to_family=True),
            kind=NotificationKind.APPEAL_CLOSED,
            title=f"Murojaat yopildi: {appeal.title}",
            body="Murojaatingiz koʻrib chiqildi va yopildi.",
            object_type="appeal",
            object_id=appeal.id,
            actor_id=user.id,
        )

    await session.flush()
    return appeal


async def assign(
    session: AsyncSession, user: CurrentUser, appeal_id: uuid.UUID, assignee_id: uuid.UUID
) -> Appeal:
    """Rahbariyatga kelgan murojaatni masʼulga biriktirish (administrator)."""
    if not can_see_all(user):
        raise PermissionDeniedError("Murojaatni administrator taqsimlaydi.")

    appeal = await session.get(Appeal, appeal_id)
    if appeal is None or appeal.is_archived:
        raise NotFoundError("Murojaat topilmadi.")

    target_user = await session.get(User, assignee_id)
    if target_user is None or target_user.is_archived or not target_user.is_active:
        raise ValidationError("Tanlangan xodim topilmadi yoki faol emas.")

    old = appeal.assignee_id
    appeal.assignee_id = assignee_id
    if appeal.status == AppealStatus.NEW.value:
        appeal.status = AppealStatus.IN_REVIEW.value

    audit_service.record(
        session,
        object_type="appeal",
        object_id=appeal.id,
        action="update",
        old={"assignee_id": old},
        new={"assignee_id": assignee_id},
        actor_id=user.id,
    )

    # Masʼul oʻzgardi — yangi masʼul buni bilishi kerak, aks holda
    # murojaat unga tayinlanib turib, u xabarsiz qolardi.
    await notifications_service.notify(
        session,
        recipients=[
            notifications_service.Recipient(
                user_id=assignee_id, student_id=appeal.student_id
            )
        ],
        kind=NotificationKind.APPEAL_ASSIGNED,
        title=f"Sizga murojaat biriktirildi: {appeal.title}",
        body=f"Biriktirdi: {user.short_name}",
        object_type="appeal",
        object_id=appeal.id,
        actor_id=user.id,
    )

    await session.flush()
    return appeal


async def add_note(
    session: AsyncSession,
    user: CurrentUser,
    appeal_id: uuid.UUID,
    *,
    kind: str,
    summary: str,
    about_teacher_id: uuid.UUID | None = None,
    teacher_rating: int | None = None,
    teacher_comment: str | None = None,
) -> AppealNote:
    """ADM-16: ichki suhbat qaydi — telefon/yuzma-yuz/onlayn.

    Bu ota-onaga koʻrinmaydi. Shuning uchun ruxsat `load_appeal()` dan
    emas, ALOHIDA rol roʻyxatidan tekshiriladi: ustoz murojaatni koʻrsa
    ham qayd qoʻsha olmaydi va oʻqiy olmaydi.
    """
    if not can_read_notes(user):
        raise PermissionDeniedError("Ichki qaydlar administrator uchun.")

    appeal = await session.get(Appeal, appeal_id)
    if appeal is None or appeal.is_archived:
        raise NotFoundError("Murojaat topilmadi.")

    if teacher_rating is not None and about_teacher_id is None:
        raise ValidationError("Reyting qoʻyish uchun ustozni tanlang.")

    note = AppealNote(
        appeal_id=appeal_id,
        author_id=user.id,
        kind=kind,
        summary=summary.strip(),
        about_teacher_id=about_teacher_id,
        teacher_rating=teacher_rating,
        teacher_comment=(teacher_comment or "").strip() or None,
    )
    session.add(note)
    audit_service.record(
        session,
        object_type="appeal_note",
        object_id=appeal_id,
        action="create",
        new={"kind": kind, "about_teacher_id": about_teacher_id},
        actor_id=user.id,
    )
    await session.flush()
    return note


async def notes_of(
    session: AsyncSession, user: CurrentUser, appeal_id: uuid.UUID
) -> Sequence[tuple]:
    if not can_read_notes(user):
        raise PermissionDeniedError("Ichki qaydlar administrator uchun.")
    about = User.__table__.alias("about")
    rows = await session.execute(
        select(AppealNote, User.last_name, User.first_name, about.c.last_name, about.c.first_name)
        .join(User, User.id == AppealNote.author_id)
        .outerjoin(about, about.c.id == AppealNote.about_teacher_id)
        .where(AppealNote.appeal_id == appeal_id, AppealNote.is_archived.is_(False))
        .order_by(AppealNote.created_at.desc())
    )
    return rows.all()


async def stats_by_class(session: AsyncSession, user: CurrentUser) -> Sequence[tuple]:
    """Sinflar kesimida murojaat statistikasi (MUR-06).

    Faqat butun maktabni koʻradigan rollar uchun: ustozga sinflar kesimi
    kerak emas va bu boshqa sinflar haqida maʼlumot berardi.
    """
    if not can_see_all(user):
        raise PermissionDeniedError("Bu hisobot rahbariyat uchun.")

    open_filter = Appeal.status != AppealStatus.CLOSED.value
    rows = await session.execute(
        select(
            SchoolClass.name,
            func.count(),
            func.count().filter(open_filter),
            func.count().filter(Appeal.target == AppealTarget.MANAGEMENT.value),
            func.count().filter(Appeal.target != AppealTarget.MANAGEMENT.value),
            func.count().filter(
                and_(open_filter, Appeal.due_at.is_not(None), Appeal.due_at < utcnow())
            ),
        )
        .select_from(Appeal)
        .join(Student, Student.id == Appeal.student_id)
        .join(SchoolClass, SchoolClass.id == Student.class_id)
        .where(Appeal.is_archived.is_(False))
        .group_by(SchoolClass.name)
        .order_by(func.count().desc(), SchoolClass.name)
    )
    return rows.all()


async def summary(session: AsyncSession, user: CurrentUser) -> dict[str, int]:
    """Kirish qutisi boshidagi raqamlar — foydalanuvchi kesimida.

    Ota-ona oʻz murojaatlarining, ustoz oʻziga kelganlarining, administrator
    esa butun maktabniki sanog'ini koʻradi: `_scope()` bir xil ishlaydi.
    """
    scope = await _scope(session, user)
    base = select(Appeal).where(Appeal.is_archived.is_(False))
    if scope is not None:
        base = base.where(scope)
    sub = base.subquery()

    row = (
        await session.execute(
            select(
                func.count(),
                func.count().filter(sub.c.status == AppealStatus.NEW.value),
                func.count().filter(sub.c.status != AppealStatus.CLOSED.value),
                func.count().filter(
                    and_(
                        sub.c.status != AppealStatus.CLOSED.value,
                        sub.c.due_at.is_not(None),
                        sub.c.due_at < utcnow(),
                    )
                ),
            ).select_from(sub)
        )
    ).one()
    return {"total": row[0], "new": row[1], "open": row[2], "overdue": row[3]}


async def compose_options(session: AsyncSession, user: CurrentUser) -> list[dict]:
    """MUR-01 formasi: farzandlar va ularga yozish mumkin boʻlgan xodimlar.

    Ustozlar roʻyxati bolaning HAQIQIY darslaridan quriladi (`lessons`),
    fan biriktirmasidan emas: ustoz almashtirilgan boʻlishi mumkin, va
    ota-ona bolasiga kim dars berayotganini koʻrishi kerak. Boshqa
    sinflarning ustozlari bu roʻyxatga tushmaydi (X-6).
    """
    from app.models import Lesson  # noqa: PLC0415 — aylanma importni oldini olish

    children = (
        await session.execute(
            select(Student, SchoolClass.name, User.last_name, User.first_name)
            .join(Guardian, Guardian.student_id == Student.id)
            .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
            .outerjoin(User, User.id == SchoolClass.homeroom_teacher_id)
            .where(
                Guardian.user_id == user.id,
                Guardian.is_archived.is_(False),
                Student.is_archived.is_(False),
            )
            .order_by(Student.last_name, Student.first_name)
        )
    ).all()

    out: list[dict] = []
    for student, class_name, hr_last, hr_first in children:
        teachers = (
            await session.execute(
                select(User.id, User.last_name, User.first_name, Subject.id, Subject.name)
                .select_from(Lesson)
                .join(User, User.id == Lesson.teacher_id)
                .join(Subject, Subject.id == Lesson.subject_id)
                .where(
                    Lesson.class_id == student.class_id,
                    Lesson.is_archived.is_(False),
                    User.is_archived.is_(False),
                )
                .distinct()
                .order_by(Subject.name, User.last_name)
            )
        ).all()
        out.append(
            {
                "student_id": student.id,
                "full_name": f"{student.last_name} {student.first_name}",
                "class_name": class_name,
                "homeroom_teacher_name": f"{hr_last} {hr_first}" if hr_last else None,
                "teachers": [
                    {
                        "id": t_id,
                        "full_name": f"{t_last} {t_first}",
                        "subject_id": s_id,
                        "subject_name": s_name,
                    }
                    for t_id, t_last, t_first, s_id, s_name in teachers
                ],
            }
        )
    return out


async def message_counts(session: AsyncSession, appeal_ids: list[uuid.UUID]) -> dict:
    """Roʻyxatdagi har bir murojaat uchun xabarlar soni — BITTA soʻrovda.

    Har bir qator uchun alohida `count(*)` yuborish N+1 boʻlardi.
    """
    if not appeal_ids:
        return {}
    rows = await session.execute(
        select(AppealMessage.appeal_id, func.count())
        .where(
            AppealMessage.appeal_id.in_(appeal_ids),
            AppealMessage.is_archived.is_(False),
        )
        .group_by(AppealMessage.appeal_id)
    )
    return dict(rows.all())


async def search_students(
    session: AsyncSession, user: CurrentUser, query: str, limit: int = 10
) -> list[dict]:
    """Xodim yozishma boshlaganda oʻquvchi qidiruvi.

    X-6: bu roʻyxatda telefon, manzil va hujjat raqami YOʻQ — faqat ism,
    sinf va vasiy ismi. Ular yozishmani kimga yozayotganini tasdiqlash
    uchun yetarli.
    """
    if not can_see_all(user):
        raise PermissionDeniedError("Oʻquvchi qidiruvi administrator uchun.")

    needle = f"%{query.strip().lower()}%"
    rows = (
        await session.execute(
            select(Student.id, Student.last_name, Student.first_name, SchoolClass.name)
            .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
            .where(
                Student.is_archived.is_(False),
                func.lower(Student.last_name + " " + Student.first_name).like(needle),
            )
            .order_by(Student.last_name, Student.first_name)
            .limit(limit)
        )
    ).all()

    out: list[dict] = []
    for student_id, last, first, class_name in rows:
        family = await guardians_of(session, student_id)
        out.append(
            {
                "student_id": student_id,
                "full_name": f"{last} {first}",
                "class_name": class_name,
                "guardians": [
                    {
                        "id": g_id,
                        "full_name": f"{g_last} {g_first}",
                        "relation": relation,
                        "is_primary": is_primary,
                    }
                    for g_id, g_last, g_first, relation, is_primary in family
                ],
            }
        )
    return out
