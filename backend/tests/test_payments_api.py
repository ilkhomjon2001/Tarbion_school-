"""Toʻlov moduli (TOL-01…TOL-07, X-9).

Eng muhim tekshiruvlar:
  · hisoblash idempotent va faqat oʻquv yili oylarida;
  · chegirma foiz/summa, sabab majburiy, auditda;
  · toʻlov tahrirlanmaydi — storno; stornoning stornosi yoʻq;
  · ota-ona faqat OʻZ farzandining balansini koʻradi;
  · oʻquv boʻlimi (academic) moliyani UMUMAN koʻrmaydi;
  · webhook: imzo, idempotentlik, summa intentdan (X-9).
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicYear,
    AuditLog,
    Guardian,
    Permission,
    Role,
    RoleName,
    SchoolClass,
    Student,
    User,
    UserPermission,
)
from app.services import payment_service

PASSWORD = "Sinov12345!"  # noqa: S106
OYLIK = 3_500_000


async def _roles(session: AsyncSession) -> dict[str, Role]:
    return {r.name: r for r in (await session.execute(select(Role))).scalars()}


async def _user(session, roles, names, login, last):  # noqa: ANN001, ANN202
    u = User(
        login=login,
        password_hash=hash_password(PASSWORD),
        last_name=last,
        first_name="Sinov",
    )
    u.roles = [roles[n] for n in names]
    session.add(u)
    await session.flush()
    return u


@pytest.fixture
async def world(session: AsyncSession) -> dict:
    roles = await _roles(session)

    admin = await _user(session, roles, [RoleName.ADMIN.value], "pm.admin", "Adminov")
    session.add(UserPermission(user_id=admin.id, permission=Permission.PAYMENTS_MANAGE.value))
    session.add(UserPermission(user_id=admin.id, permission=Permission.STUDENTS_MANAGE.value))
    await _user(session, roles, [RoleName.DIRECTOR.value], "pm.direktor", "Direktorov")
    await _user(session, roles, [RoleName.ACADEMIC.value], "pm.oquv", "Oquvboyev")
    ota = await _user(session, roles, [RoleName.PARENT.value], "pm.ota", "Otayev")
    begona_ota = await _user(session, roles, [RoleName.PARENT.value], "pm.bota", "Botayev")

    year = AcademicYear(
        name="2026-2027", starts_on=date(2026, 9, 1), ends_on=date(2027, 5, 25)
    )
    year.is_current = True
    session.add(year)
    await session.flush()

    sinf = SchoolClass(academic_year_id=year.id, name="9-A")
    session.add(sinf)
    await session.flush()

    ali = Student(class_id=sinf.id, last_name="Otayev", first_name="Ali")
    vali = Student(class_id=sinf.id, last_name="Botayev", first_name="Vali")
    session.add_all([ali, vali])
    await session.flush()

    session.add_all(
        [
            Guardian(student_id=ali.id, user_id=ota.id, relation="father"),
            Guardian(student_id=vali.id, user_id=begona_ota.id, relation="father"),
        ]
    )
    await session.commit()
    return {"ali": ali, "vali": vali}


def _auth(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


async def _token(client: AsyncClient, login: str) -> str:
    r = await client.post("/api/v1/auth/login", json={"login": login, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _shartnoma(client, token, student_id, fee=OYLIK):  # noqa: ANN001, ANN202
    r = await client.put(
        f"/api/v1/payments/students/{student_id}/contract",
        headers=_auth(token),
        json={"monthly_fee": fee, "starts_on": "2026-09-01"},
    )
    assert r.status_code == 200, r.text
    return r.json()


# ─────────────────── Shartnoma va hisoblash ───────────────────


async def test_hisoblash_idempotent(client: AsyncClient, world: dict) -> None:
    """Ikki marta bosilsa qarz ikki marta yozilmaydi."""
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)

    r = await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 9},
    )
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 1

    r = await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 9},
    )
    assert r.json()["created"] == 0  # idempotent

    r = await client.get(
        f"/api/v1/payments/students/{world['ali'].id}", headers=_auth(token)
    )
    fin = r.json()["finance"]
    assert fin["charged"] == OYLIK
    assert fin["balance"] == -OYLIK  # qarz


async def test_yozgi_oyga_qarz_yozilmaydi(client: AsyncClient, world: dict) -> None:
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)
    r = await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2027, "month": 7},
    )
    assert r.status_code == 422, r.text


async def test_shartnoma_ozgarsa_otgan_oy_qotadi(client: AsyncClient, world: dict) -> None:
    """2-buzilmas qoida: hisoblangan qarz qayta hisoblanmaydi."""
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)
    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 9},
    )

    # Oktabrdan summa oshdi.
    r = await client.put(
        f"/api/v1/payments/students/{world['ali'].id}/contract",
        headers=_auth(token),
        json={"monthly_fee": 4_000_000, "starts_on": "2026-10-01"},
    )
    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 10},
    )
    r = await client.get(
        f"/api/v1/payments/students/{world['ali'].id}", headers=_auth(token)
    )
    qarzlar = [x for x in r.json()["rows"] if x["kind"] == "charge"]
    assert [q["amount"] for q in qarzlar] == [OYLIK, 4_000_000]


async def test_chegirma_hisobda_va_auditda(
    client: AsyncClient, world: dict, session: AsyncSession
) -> None:
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)

    r = await client.post(
        f"/api/v1/payments/students/{world['ali'].id}/discounts",
        headers=_auth(token),
        json={
            "kind": "percent",
            "value": 10,
            "reason": "Aka-uka chegirmasi",
            "starts_on": "2026-09-01",
        },
    )
    assert r.status_code == 200, r.text

    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 9},
    )
    r = await client.get(
        f"/api/v1/payments/students/{world['ali'].id}", headers=_auth(token)
    )
    assert r.json()["finance"]["charged"] == OYLIK - OYLIK // 10

    rows = (
        (
            await session.execute(
                select(AuditLog).where(AuditLog.object_type == "tuition_discount")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert rows[0].new_value["reason"] == "Aka-uka chegirmasi"


# ─────────────────── Toʻlov va storno ───────────────────


async def test_tolov_va_storno(client: AsyncClient, world: dict) -> None:
    """TOL-07: tahrirlash yoʻq — storno; stornoning stornosi 409."""
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)
    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 9},
    )

    r = await client.post(
        "/api/v1/payments",
        headers=_auth(token),
        json={
            "student_id": str(world["ali"].id),
            "amount": OYLIK,
            "method": "naqd",
            "receipt_no": "KV-001",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["finance"]["balance"] == 0  # qarz yopildi

    tolov = next(x for x in r.json()["rows"] if x["kind"] == "payment")

    # Storno — sababsiz boʻlmaydi.
    r = await client.post(
        f"/api/v1/payments/{tolov['payment_id']}/storno",
        headers=_auth(token),
        json={"reason": ""},
    )
    assert r.status_code == 422

    r = await client.post(
        f"/api/v1/payments/{tolov['payment_id']}/storno",
        headers=_auth(token),
        json={"reason": "Summa xato kiritilgan"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["finance"]["balance"] == -OYLIK  # qarz qaytdi

    # Ikkinchi storno — 409.
    r = await client.post(
        f"/api/v1/payments/{tolov['payment_id']}/storno",
        headers=_auth(token),
        json={"reason": "Yana"},
    )
    assert r.status_code == 409, r.text


# ─────────────────── Kirish doiralari ───────────────────


async def test_ota_faqat_oz_farzandini_koradi(client: AsyncClient, world: dict) -> None:
    """6-qoida / X-1 — moliya uchun ham."""
    admin = await _token(client, "pm.admin")
    await _shartnoma(client, admin, world["ali"].id)

    ota = await _token(client, "pm.ota")
    r = await client.get(
        f"/api/v1/payments/students/{world['ali'].id}", headers=_auth(ota)
    )
    assert r.status_code == 200, r.text

    r = await client.get(
        f"/api/v1/payments/students/{world['vali'].id}", headers=_auth(ota)
    )
    assert r.status_code == 403, r.text

    # Umumiy roʻyxat va jamlanma ota-onaga yopiq.
    r = await client.get("/api/v1/payments/students", headers=_auth(ota))
    assert r.status_code == 403
    r = await client.get("/api/v1/payments/summary", headers=_auth(ota))
    assert r.status_code == 403


async def test_oquv_bolimi_moliyani_kormaydi(client: AsyncClient, world: dict) -> None:
    """access.py dagi ogohlantirishning testi: academic staff_wide boʻlsa
    ham moliyaga kirmaydi."""
    token = await _token(client, "pm.oquv")
    for path in (
        "/api/v1/payments/summary",
        "/api/v1/payments/students",
        f"/api/v1/payments/students/{world['ali'].id}",
    ):
        r = await client.get(path, headers=_auth(token))
        assert r.status_code == 403, f"{path}: {r.status_code}"


async def test_direktor_koradi_lekin_yozolmaydi(client: AsyncClient, world: dict) -> None:
    admin = await _token(client, "pm.admin")
    await _shartnoma(client, admin, world["ali"].id)

    token = await _token(client, "pm.direktor")
    r = await client.get("/api/v1/payments/summary", headers=_auth(token))
    assert r.status_code == 200, r.text

    # Yozish `payments.manage` talab qiladi — direktorda yoʻq.
    r = await client.post(
        "/api/v1/payments",
        headers=_auth(token),
        json={"student_id": str(world["ali"].id), "amount": 1000, "method": "naqd"},
    )
    assert r.status_code == 403, r.text


# ─────────────────── Sinov provayderi (X-9) ───────────────────


async def test_onlayn_tolov_oqimi(client: AsyncClient, world: dict) -> None:
    """Intent → sinov-complete → balans yopildi. Takror — ikki marta emas."""
    admin = await _token(client, "pm.admin")
    await _shartnoma(client, admin, world["ali"].id)
    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(admin),
        json={"year": 2026, "month": 9},
    )

    ota = await _token(client, "pm.ota")
    r = await client.post(
        "/api/v1/payments/intents",
        headers=_auth(ota),
        json={"student_id": str(world["ali"].id), "amount": OYLIK},
    )
    assert r.status_code == 201, r.text
    intent = r.json()

    r = await client.post(
        f"/api/v1/payments/intents/{intent['id']}/sinov-complete",
        headers=_auth(ota),
        json={"outcome": "paid"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "paid"

    r = await client.get(
        f"/api/v1/payments/students/{world['ali'].id}", headers=_auth(ota)
    )
    assert r.json()["finance"]["balance"] == 0

    # Takror webhook — idempotent: yana bir toʻlov paydo boʻlmaydi.
    imzo = payment_service.make_signature(intent["id"], "paid")
    r = await client.post(
        "/api/v1/payments/webhook/sinov",
        json={"tx_id": intent["id"], "status": "paid", "signature": imzo},
    )
    assert r.status_code == 200
    assert r.json()["result"] == "allaqachon"

    r = await client.get(
        f"/api/v1/payments/students/{world['ali'].id}", headers=_auth(ota)
    )
    assert r.json()["finance"]["balance"] == 0  # oʻzgarmadi


async def test_webhook_imzosiz_otmaydi(client: AsyncClient, world: dict) -> None:
    ota = await _token(client, "pm.ota")
    r = await client.post(
        "/api/v1/payments/intents",
        headers=_auth(ota),
        json={"student_id": str(world["ali"].id), "amount": 1_000_000},
    )
    intent_id = r.json()["id"]

    r = await client.post(
        "/api/v1/payments/webhook/sinov",
        json={"tx_id": intent_id, "status": "paid", "signature": "soxta-imzo"},
    )
    assert r.status_code == 403, r.text


async def test_begona_ota_intent_ocholmaydi(client: AsyncClient, world: dict) -> None:
    """X-1: intent faqat oʻz farzandiga."""
    ota = await _token(client, "pm.ota")
    r = await client.post(
        "/api/v1/payments/intents",
        headers=_auth(ota),
        json={"student_id": str(world["vali"].id), "amount": 1_000_000},
    )
    assert r.status_code == 403, r.text


async def test_begona_intentni_yakunlay_olmaydi(client: AsyncClient, world: dict) -> None:
    ota = await _token(client, "pm.ota")
    r = await client.post(
        "/api/v1/payments/intents",
        headers=_auth(ota),
        json={"student_id": str(world["ali"].id), "amount": 1_000_000},
    )
    intent_id = r.json()["id"]

    begona = await _token(client, "pm.bota")
    r = await client.post(
        f"/api/v1/payments/intents/{intent_id}/sinov-complete",
        headers=_auth(begona),
        json={"outcome": "paid"},
    )
    assert r.status_code == 403, r.text


async def test_bekor_qilingan_intent_tolanmaydi(client: AsyncClient, world: dict) -> None:
    ota = await _token(client, "pm.ota")
    r = await client.post(
        "/api/v1/payments/intents",
        headers=_auth(ota),
        json={"student_id": str(world["ali"].id), "amount": 1_000_000},
    )
    intent_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/payments/intents/{intent_id}/sinov-complete",
        headers=_auth(ota),
        json={"outcome": "cancelled"},
    )
    assert r.json()["status"] == "cancelled"

    imzo = payment_service.make_signature(intent_id, "paid")
    r = await client.post(
        "/api/v1/payments/webhook/sinov",
        json={"tx_id": intent_id, "status": "paid", "signature": imzo},
    )
    assert r.status_code == 409, r.text


# ─────────────────── Oy kesimi, kredit, qaytarish, kvitansiya ───────────────────


async def test_oy_kesimi_fifo(client: AsyncClient, world: dict) -> None:
    """Pul eng eski qarzdan boshlab yopiladi: sentyabr toʻliq,
    oktyabr qisman."""
    token = await _token(client, "pm.admin")
    # Shartnoma maydan boshlanadi — sentyabr va oktyabrni hisoblaymiz.
    await _shartnoma(client, token, world["ali"].id)
    for oy in (9, 10):
        await client.post(
            "/api/v1/payments/charges/generate",
            headers=_auth(token),
            json={"year": 2026, "month": oy},
        )

    # 5 mln toʻlandi: 3.5 sentyabrga, 1.5 oktyabrga.
    r = await client.post(
        "/api/v1/payments",
        headers=_auth(token),
        json={"student_id": str(world["ali"].id), "amount": 5_000_000, "method": "naqd"},
    )
    oylar = r.json()["months"]
    assert [(m["month"], m["status"]) for m in oylar] == [(9, "tolangan"), (10, "qisman")]
    assert oylar[1]["covered"] == 1_500_000


async def test_muddat_otgan_oy_kechikdi(client: AsyncClient, world: dict) -> None:
    """10-sanadan keyin toʻlanmagan oy «kechikdi» (overdue)."""
    token = await _token(client, "pm.admin")
    # Shartnoma 2026-may oldidan — may qarzini yozamiz: muddati
    # 2026-05-10, bugungi sanadan (2026-09-01) oʻtgan.
    r = await client.put(
        f"/api/v1/payments/students/{world['ali'].id}/contract",
        headers=_auth(token),
        json={"monthly_fee": OYLIK, "starts_on": "2026-05-01"},
    )
    assert r.status_code == 200
    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 5},
    )
    # Sentyabr esa hali muddati kelmagan (bugun 10-sanadan oldin boʻlsa).
    r = await client.get(
        f"/api/v1/payments/students/{world['ali'].id}", headers=_auth(token)
    )
    may = next(m for m in r.json()["months"] if m["month"] == 5)
    assert may["status"] == "tolanmagan"
    assert may["overdue"] is True


async def test_kredit_yozuv(client: AsyncClient, world: dict, session: AsyncSession) -> None:
    """Oʻquvchi ketdi — oxirgi oy qarzi sabab bilan kamaytiriladi."""
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)
    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 9},
    )

    # Sababsiz kredit yoʻq.
    r = await client.post(
        f"/api/v1/payments/students/{world['ali'].id}/credits",
        headers=_auth(token),
        json={"amount": 1_750_000, "reason": ""},
    )
    assert r.status_code == 422

    r = await client.post(
        f"/api/v1/payments/students/{world['ali'].id}/credits",
        headers=_auth(token),
        json={
            "amount": 1_750_000,
            "reason": "20-sentyabrda oʻqishdan chiqdi — yarim oy",
            "year": 2026,
            "month": 9,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["finance"]["charged"] == OYLIK - 1_750_000
    sen = next(m for m in body["months"] if m["month"] == 9)
    assert sen["amount"] == 1_750_000  # samarali qarz kamaydi

    rows = (
        (
            await session.execute(
                select(AuditLog).where(AuditLog.object_type == "tuition_credit")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert "yarim oy" in rows[0].new_value["reason"]


async def test_qaytarish_faqat_avansdan(client: AsyncClient, world: dict) -> None:
    """Avans qaytariladi; qarzdorga «qaytarish» yoʻq."""
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)

    # Hech narsa hisoblanmagan, 1 mln avans bor.
    await client.post(
        "/api/v1/payments",
        headers=_auth(token),
        json={"student_id": str(world["ali"].id), "amount": 1_000_000, "method": "naqd"},
    )

    # Avansdan koʻp qaytarib boʻlmaydi.
    r = await client.post(
        f"/api/v1/payments/students/{world['ali'].id}/refund",
        headers=_auth(token),
        json={"amount": 2_000_000, "reason": "Ota-ona soʻradi"},
    )
    assert r.status_code == 409, r.text

    r = await client.post(
        f"/api/v1/payments/students/{world['ali'].id}/refund",
        headers=_auth(token),
        json={"amount": 1_000_000, "reason": "Oʻquvchi boshqa maktabga oʻtdi"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["finance"]["balance"] == 0
    assert any(x["kind"] == "refund" for x in r.json()["rows"])


async def test_kvitansiya_raqami_avtomatik(client: AsyncClient, world: dict) -> None:
    """TOL-04: chek raqami berilmasa KV-<yil>-<tartib> beriladi."""
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)

    raqamlar = []
    for _ in range(2):
        r = await client.post(
            "/api/v1/payments",
            headers=_auth(token),
            json={"student_id": str(world["ali"].id), "amount": 100_000, "method": "naqd"},
        )
        tolovlar = [x for x in r.json()["rows"] if x["kind"] == "payment"]
        raqamlar.append(tolovlar[-1]["receipt_no"])

    assert all(x and x.startswith("KV-") for x in raqamlar)
    assert raqamlar[0] != raqamlar[1]


async def test_arxivlangan_qarzdor_hisobotda_qoladi(
    client: AsyncClient, world: dict
) -> None:
    """1-domen qoidasi: ketgan oʻquvchining qarzi yoʻqolmaydi."""
    token = await _token(client, "pm.admin")
    await _shartnoma(client, token, world["ali"].id)
    await client.post(
        "/api/v1/payments/charges/generate",
        headers=_auth(token),
        json={"year": 2026, "month": 9},
    )

    # Oʻquvchini arxivlaymiz (students.manage kerak — beramiz).
    r = await client.post(
        f"/api/v1/school/students/{world['ali'].id}/archive",
        headers=_auth(token),
        json={"reason": "Boshqa maktabga oʻtdi"},
    )
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/payments/students?debtors=true", headers=_auth(token))
    qarzdorlar = {x["student_name"]: x for x in r.json()}
    assert "Otayev Ali" in qarzdorlar
    assert qarzdorlar["Otayev Ali"]["is_archived"] is True
