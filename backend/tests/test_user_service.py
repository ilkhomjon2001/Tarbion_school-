"""Hisob ochish, huquq va parol (T-003).

Loyiha egasining talablari:
  – hisobni faqat huquqi bor administrator yoki superadmin ochadi
  – login `familiya.ism` shaklida, takrorlanmas
  – boshlangʻich parol 5 xonali, keyin foydalanuvchi almashtiradi
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PermissionDeniedError, ValidationError
from app.core.security import INITIAL_PASSWORD_DIGITS, verify_password
from app.models import AuditLog, Permission, Role, RoleName, User
from app.services import permissions, user_service
from app.services.access import CurrentUser


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _make_user(session: AsyncSession, login: str, *role_names: str) -> User:
    roles = await _roles(session)
    user = User(
        login=login,
        password_hash="x",
        last_name="Sinov",
        first_name=login,
    )
    user.roles = [roles[r] for r in role_names]
    session.add(user)
    await session.flush()
    return user


def _current(user: User) -> CurrentUser:
    return CurrentUser.from_model(user)


# ─────────────────────────── Huquq ───────────────────────────


async def test_huquqsiz_admin_hisob_ocholmaydi(session: AsyncSession) -> None:
    """Eng muhim tekshiruv: rolning oʻzi yetarli emas, huquq kerak."""
    admin = await _make_user(session, "admin.huquqsiz", RoleName.ADMIN.value)

    with pytest.raises(PermissionDeniedError):
        await user_service.create_user(
            session,
            actor=_current(admin),
            last_name="Aliyev",
            first_name="Sardor",
            roles=[RoleName.TEACHER.value],
        )


async def test_huquq_berilgan_admin_hisob_ochadi(session: AsyncSession) -> None:
    admin = await _make_user(session, "admin.huquqli", RoleName.ADMIN.value)
    await permissions.grant(
        session,
        target_user_id=admin.id,
        permission=Permission.USERS_CREATE,
        granted_by=_current(admin),
    )
    await session.flush()

    natija = await user_service.create_user(
        session,
        actor=_current(admin),
        last_name="Aliyev",
        first_name="Sardor",
        roles=[RoleName.TEACHER.value],
    )
    assert natija.user.login == "aliyev.sardor"


async def test_superadminga_huquq_kerak_emas(session: AsyncSession) -> None:
    """Superadmin tizim egasi — unga alohida huquq berilmaydi."""
    sa = await _make_user(session, "sa.bosh", RoleName.SUPERADMIN.value)

    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Karimov",
        first_name="Jasur",
        roles=[RoleName.ADMIN.value],
    )
    assert natija.user.login == "karimov.jasur"


async def test_bekor_qilingan_huquq_ishlamaydi(session: AsyncSession) -> None:
    admin = await _make_user(session, "admin.bekor", RoleName.ADMIN.value)
    await permissions.grant(
        session,
        target_user_id=admin.id,
        permission=Permission.USERS_CREATE,
        granted_by=_current(admin),
    )
    await session.flush()
    assert await permissions.has_permission(session, _current(admin), Permission.USERS_CREATE)

    await permissions.revoke(session, target_user_id=admin.id, permission=Permission.USERS_CREATE)
    await session.flush()
    assert not await permissions.has_permission(session, _current(admin), Permission.USERS_CREATE)


async def test_admin_ozidan_yuqori_rol_bera_olmaydi(session: AsyncSession) -> None:
    """Aks holda huquq cheklovini butunlay aylanib oʻtish mumkin edi."""
    admin = await _make_user(session, "admin.kotarilmoqchi", RoleName.ADMIN.value)
    await permissions.grant(
        session,
        target_user_id=admin.id,
        permission=Permission.USERS_CREATE,
        granted_by=_current(admin),
    )
    await session.flush()

    with pytest.raises(ValidationError, match="Super administrator"):
        await user_service.create_user(
            session,
            actor=_current(admin),
            last_name="Yangi",
            first_name="Bosh",
            roles=[RoleName.SUPERADMIN.value],
        )


# ─────────────────────────── Login ───────────────────────────


async def test_login_takrorlansa_raqam_qoshiladi(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.login", RoleName.SUPERADMIN.value)

    loginlar = []
    for _ in range(3):
        natija = await user_service.create_user(
            session,
            actor=_current(sa),
            last_name="Rahimov",
            first_name="Aziz",
            roles=[RoleName.STUDENT.value],
        )
        await session.flush()
        loginlar.append(natija.user.login)

    assert loginlar == ["rahimov.aziz", "rahimov.aziz2", "rahimov.aziz3"]


async def test_ozbek_belgilari_logindan_tozalanadi(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.ozbek", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Gʻofurov",
        first_name="Oʻktam",
        roles=[RoleName.TEACHER.value],
    )
    assert natija.user.login == "gofurov.oktam"


async def test_bosh_familiya_rad_etiladi(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.bosh2", RoleName.SUPERADMIN.value)
    with pytest.raises(ValidationError):
        await user_service.create_user(
            session,
            actor=_current(sa),
            last_name="   ",
            first_name="Sardor",
            roles=[RoleName.STUDENT.value],
        )


# ─────────────────────────── Parol ───────────────────────────


async def test_boshlangich_parol_5_xonali_raqam(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.parol", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Toshev",
        first_name="Bekzod",
        roles=[RoleName.STUDENT.value],
    )

    assert len(natija.initial_password) == INITIAL_PASSWORD_DIGITS == 5
    assert natija.initial_password.isdigit()
    # Parol xesh sifatida saqlanadi, ochiq emas
    assert natija.user.password_hash != natija.initial_password
    assert verify_password(natija.initial_password, natija.user.password_hash)
    # Birinchi kirishda almashtirish majburiy
    assert natija.user.must_change_password is True


async def test_parolni_almashtirish(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.almash", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Nazarov",
        first_name="Otabek",
        roles=[RoleName.TEACHER.value],
    )
    await session.flush()

    await user_service.change_own_password(
        session,
        user=natija.user,
        current_password=natija.initial_password,
        new_password="yangiParol2026",
    )
    assert verify_password("yangiParol2026", natija.user.password_hash)
    assert natija.user.must_change_password is False


async def test_eski_parol_notogri_bolsa_almashtirilmaydi(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.eski", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Sobirov",
        first_name="Ulugʻbek",
        roles=[RoleName.TEACHER.value],
    )
    await session.flush()

    with pytest.raises(ValidationError, match="Joriy parol"):
        await user_service.change_own_password(
            session,
            user=natija.user,
            current_password="00000",
            new_password="yangiParol2026",
        )


async def test_qisqa_yangi_parol_rad_etiladi(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.qisqa", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Ergashev",
        first_name="Doniyor",
        roles=[RoleName.TEACHER.value],
    )
    await session.flush()

    with pytest.raises(ValidationError, match="kamida"):
        await user_service.change_own_password(
            session,
            user=natija.user,
            current_password=natija.initial_password,
            new_password="qisqa",
        )


async def test_yangi_parol_faqat_raqam_bolmasin(session: AsyncSession) -> None:
    """Boshlangʻich parol 5 xonali, lekin doimiysi raqamgina boʻlmasin."""
    sa = await _make_user(session, "sa.raqam", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Yoqubov",
        first_name="Shohruh",
        roles=[RoleName.TEACHER.value],
    )
    await session.flush()

    with pytest.raises(ValidationError, match="raqamlardan"):
        await user_service.change_own_password(
            session,
            user=natija.user,
            current_password=natija.initial_password,
            new_password="123456789",
        )


# ─────────────────────────── Audit ───────────────────────────


async def test_hisob_ochilishi_auditga_tushadi(session: AsyncSession) -> None:
    """CLAUDE.md 4-qoida: hisob oʻzgarishi izsiz qolmaydi."""
    sa = await _make_user(session, "sa.audit", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Xolmatov",
        first_name="Islom",
        roles=[RoleName.STUDENT.value],
    )
    await session.flush()

    yozuv = await session.scalar(select(AuditLog).where(AuditLog.object_id == natija.user.id))
    assert yozuv is not None
    assert yozuv.action == "create"
    assert yozuv.actor_id == sa.id
    assert yozuv.new_value["login"] == "xolmatov.islom"
    # Parol auditga TUSHMASLIGI kerak
    assert "password" not in str(yozuv.new_value)


async def test_arxivlash_ochirmaydi(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.arxiv", RoleName.SUPERADMIN.value)
    natija = await user_service.create_user(
        session,
        actor=_current(sa),
        last_name="Qodirov",
        first_name="Bobur",
        roles=[RoleName.STUDENT.value],
    )
    await session.flush()

    await user_service.archive_user(session, actor=_current(sa), user_id=natija.user.id)
    await session.flush()

    # Yozuv joyida, faqat arxivlangan
    hali_bor = await session.get(User, natija.user.id)
    assert hali_bor is not None
    assert hali_bor.is_archived is True
    assert hali_bor.is_active is False


async def test_ozini_arxivlab_bolmaydi(session: AsyncSession) -> None:
    sa = await _make_user(session, "sa.ozi", RoleName.SUPERADMIN.value)
    with pytest.raises(ValidationError, match="Oʻz hisobingizni"):
        await user_service.archive_user(session, actor=_current(sa), user_id=sa.id)
