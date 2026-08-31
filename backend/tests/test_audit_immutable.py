"""Audit jurnalini oʻzgartirib boʻlmasligi (T-021, CLAUDE.md 4-qoida).

Bu testlar ILOVANI emas, BAZANI sinaydi. Audit jurnali aynan ilovaga
ishonib boʻlmagan holat uchun kerak: xodim oʻz izini yashirsa, hujumchi
tarixni tozalasa yoki kimdir `psql` ochib `DELETE` yozsa.

Shuning uchun soʻrovlar ORM orqali emas, xom SQL bilan yuboriladi —
aynan hujumchi qiladigan yoʻl bilan.
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditAction, AuditLog, LoginLog, User
from app.services import audit_service


@pytest.fixture
async def yozuv(session: AsyncSession) -> AuditLog:
    audit_service.record(
        session,
        object_type="grade",
        action=AuditAction.UPDATE,
        old={"value": 3},
        new={"value": 5},
    )
    await session.flush()
    row = await session.scalar(select(AuditLog).where(AuditLog.object_type == "grade"))
    assert row is not None
    return row


async def test_audit_yozuvini_ozgartirib_bolmaydi(
    session: AsyncSession, yozuv: AuditLog
) -> None:
    """Eng ehtimolli stsenariy: 2 qoʻygan ustoz keyin uni 5 qilib
    koʻrsatmoqchi va audit izini ham tuzatmoqchi."""
    with pytest.raises(ProgrammingError, match="ozgartirilmaydi"):
        await session.execute(
            text("UPDATE audit_log SET new_value = :v WHERE id = :i"),
            {"v": '{"value": 5}', "i": str(yozuv.id)},
        )
    await session.rollback()


async def test_audit_yozuvini_ochirib_bolmaydi(
    session: AsyncSession, yozuv: AuditLog
) -> None:
    with pytest.raises(ProgrammingError, match="ochirilmaydi"):
        await session.execute(
            text("DELETE FROM audit_log WHERE id = :i"), {"i": str(yozuv.id)}
        )
    await session.rollback()


async def test_audit_jadvalini_tozalab_bolmaydi(session: AsyncSession) -> None:
    """`TRUNCATE` qator triggerini AYLANIB OʻTADI.

    U qator darajasidagi triggerni umuman chaqirmaydi — shuning uchun
    alohida statement trigger qoʻyilgan. Bu test aynan oʻsha triggerni
    tekshiradi: usiz `DELETE` bloklangan boʻlsa ham `TRUNCATE` butun
    jurnalni oʻchirib yuborardi.
    """
    with pytest.raises(ProgrammingError):
        await session.execute(text("TRUNCATE audit_log"))
    await session.rollback()


async def test_yangi_yozuv_qoshiladi(session: AsyncSession, yozuv: AuditLog) -> None:
    """Trigger faqat UPDATE/DELETE ni toʻsadi — yozish ishlashi kerak."""
    audit_service.record(
        session, object_type="attendance", action=AuditAction.CREATE, new={"x": 1}
    )
    await session.flush()

    barchasi = (await session.execute(select(AuditLog))).scalars().all()
    assert len(barchasi) >= 2


async def test_kirish_jurnali_ham_himoyalangan(session: AsyncSession) -> None:
    """AUT-06: «kim qachon kirdi» javobi oʻzgarmasligi kerak."""
    from app.core.security import hash_password
    from app.models import Role, RoleName

    rol = await session.scalar(select(Role).where(Role.name == RoleName.TEACHER.value))
    user = User(
        login="audit.sinov",
        password_hash=hash_password("Sinov12345!"),
        last_name="Sinovov",
        first_name="Sinov",
    )
    user.roles = [rol] if rol else []
    session.add(user)
    await session.flush()

    session.add(LoginLog(user_id=user.id, ip_address="127.0.0.1"))
    await session.flush()

    row = await session.scalar(select(LoginLog))
    assert row is not None

    with pytest.raises(ProgrammingError):
        await session.execute(
            text("DELETE FROM login_log WHERE id = :i"), {"i": str(row.id)}
        )
    await session.rollback()
