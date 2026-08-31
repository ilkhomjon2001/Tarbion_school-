"""Uchidan-uchiga xavfsizlik va funksional tekshiruv.

Ishlatish:
    uv run python scripts/security_probe.py

Ishlab turgan serverga HAQIQIY soʻrovlar yuboradi va hujumchi nima
qilishi mumkinligini takrorlaydi: begona bolaning maʼlumotini soʻrash,
URL dagi id ni almashtirish, boshqa ustozning jurnaliga kirish, test
javoblarini oldindan olish, huquqsiz amal bajarish.

Bu testlar `pytest` dagilarni ALMASHTIRMAYDI — ular izolyatsiyalangan
bazada, bu esa haqiqiy maʼlumot ustida ishlaydi va sozlama xatolarini
(middleware, CORS, sarlavha) ham ushlaydi.

Skript hech narsani oʻchirmaydi: yaratgan yozuvlarini arxivlaydi.
"""

import datetime as dt
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]

BASE = "http://localhost:8000"
API = f"{BASE}/api/v1"

OK = "✓"
XATO = "✗"

_natijalar: list[tuple[bool, str]] = []


def call(
    method: str, path: str, token: str | None = None, body: object = None, query: str = ""
) -> tuple[int, object, str]:
    # Yoʻlni kodlaymiz: tekshiruvda ataylab buzuq id lar yuboriladi va
    # ular `urllib` ni emas, SERVERNI sinashi kerak.
    xavfsiz = urllib.parse.quote(path, safe="/{}")
    req = urllib.request.Request(API + xavfsiz + query, method=method)  # noqa: S310
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:  # noqa: S310
            xom = r.read().decode()
            return r.status, (json.loads(xom) if xom else None), xom
    except urllib.error.HTTPError as e:
        xom = e.read().decode()
        return e.code, (json.loads(xom) if xom else None), xom
    except urllib.error.URLError as e:
        return 0, {"message": str(e)}, ""


def tekshir(shart: bool, matn: str, izoh: str = "") -> None:
    _natijalar.append((shart, matn))
    belgi = OK if shart else XATO
    qoshimcha = f"  ({izoh})" if izoh else ""
    print(f"  {belgi} {matn}{qoshimcha}")


def sarlavha(matn: str) -> None:
    print(f"\n── {matn} " + "─" * max(0, 58 - len(matn)))


def login(login_name: str, parol: str) -> str | None:
    st, body, _ = call("POST", "/auth/login", body={"login": login_name, "password": parol})
    if st != 200:
        return None
    return body["access_token"]  # type: ignore[index]


def reset(sa: str, user_id: str) -> tuple[str, str]:
    """Xodim paroliga yangi qiymat beradi va uni almashtiradi.

    Boshlangʻich parol bilan API yopiq (`must_change_password`), shuning
    uchun darhol doimiy parolga oʻtkaziladi — aynan odam qiladigan ish.
    """
    _, p, _ = call("POST", f"/school/staff/{user_id}/reset-password", sa)
    boshlangich = p["new_password"]  # type: ignore[index]
    tok = login(p["login"], boshlangich)  # type: ignore[index]
    doimiy = "SinovProbe2026!"
    call(
        "POST",
        "/auth/change-password",
        tok,
        {"current_password": boshlangich, "new_password": doimiy},
    )
    return p["login"], doimiy  # type: ignore[index]


def main() -> int:
    st, _, _ = call("GET", "/../health")
    if st == 0:
        print("Server ishlamayapti. `uvicorn app.main:app` ni ishga tushiring.")
        return 1

    sa_parol = input("Superadmin paroli: ").strip() if not sys.argv[1:] else sys.argv[1]
    sa = login("bekmurodov.ikrom", sa_parol)
    if sa is None:
        print("Superadmin bilan kirib boʻlmadi.")
        return 1

    # ─────────────────── Ishtirokchilarni tayyorlash ───────────────────

    sarlavha("Tayyorgarlik")
    _, xodimlar, _ = call("GET", "/school/staff", sa)
    # ATAYLAB sinf rahbari BOʻLMAGAN ustozlar: 4-qoida (oʻrtacha fan
    # ustoziga koʻrinmaydi) faqat shunda tekshiriladi. Sinf rahbari
    # oʻrtachani koʻrishi — toʻgʻri xatti-harakat.
    ustozlar = [
        x
        for x in xodimlar  # type: ignore[union-attr]
        if "teacher" in x["roles"] and "homeroom_teacher" not in x["roles"]
    ]
    if len(ustozlar) < 2:
        print("  Sinf rahbari boʻlmagan ikkita ustoz topilmadi.")
        return 1
    ustoz_a, ustoz_b = ustozlar[0], ustozlar[1]

    a_login, a_parol = reset(sa, ustoz_a["user_id"])
    b_login, b_parol = reset(sa, ustoz_b["user_id"])
    tok_a = login(a_login, a_parol)
    tok_b = login(b_login, b_parol)
    print(f"  ustoz A: {a_login} | ustoz B: {b_login}")

    _, jadval_a, _ = call("GET", "/schedule/entries", sa, query=f"?teacher_id={ustoz_a['user_id']}")
    if not jadval_a:
        print("  Ustoz A ning jadvali boʻsh — tekshiruvni davom ettirib boʻlmaydi.")
        return 1
    slot = jadval_a[0]  # type: ignore[index]

    _, oquvchilar, _ = call("GET", "/school/students", sa, query=f"?class_id={slot['class_id']}")
    ali = oquvchilar[0]  # type: ignore[index]
    _, kartochka, _ = call("GET", f"/school/students/{ali['id']}", sa)
    vasiy = kartochka["guardians"][0]  # type: ignore[index]
    ota_login, ota_parol = reset(sa, vasiy["user_id"])
    tok_ota = login(ota_login, ota_parol)

    # Boshqa sinfdan begona ota-ona.
    _, sinflar, _ = call("GET", "/school/classes", sa)
    ozga_sinf = next(c for c in sinflar if c["id"] != slot["class_id"])  # type: ignore[union-attr]
    _, ozga_oquvchilar, _ = call(
        "GET", "/school/students", sa, query=f"?class_id={ozga_sinf['id']}"
    )
    begona_ota_tok = None
    if ozga_oquvchilar:
        _, k2, _ = call("GET", f"/school/students/{ozga_oquvchilar[0]['id']}", sa)  # type: ignore[index]
        if k2["guardians"]:  # type: ignore[index]
            bl, bp = reset(sa, k2["guardians"][0]["user_id"])  # type: ignore[index]
            begona_ota_tok = login(bl, bp)
    print(f"  ota-ona: {ota_login} | farzand: {ali['full_name']}")

    # ─────────────────── 1. Autentifikatsiya ───────────────────

    sarlavha("1. Autentifikatsiya")

    st, _, _ = call("GET", "/school/students")
    tekshir(st == 401, "tokensiz soʻrov rad etiladi", f"{st}")

    st, _, _ = call("GET", "/school/students", "yaroqsiz.token.qiymat")
    tekshir(st == 401, "soxta token rad etiladi", f"{st}")

    # `alg: none` hujumi — imzosiz token.
    soxta = (
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0."
        "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJ0eXAiOiJhY2Nlc3MifQ."
    )
    st, _, _ = call("GET", "/school/students", soxta)
    tekshir(st == 401, "imzosiz token (alg=none) rad etiladi", f"{st}")

    # Refresh tokenni access oʻrnida ishlatish.
    st, _, _ = call("GET", "/auth/me", "x" * 200)
    tekshir(st == 401, "uzun axlat token rad etiladi", f"{st}")

    st, _, _ = call("POST", "/auth/login", body={"login": a_login, "password": "notogri-parol"})
    tekshir(st == 401, "notoʻgʻri parol rad etiladi", f"{st}")

    st, body, _ = call("POST", "/auth/login", body={"login": "bunday.login.yoq", "password": "x"})
    tekshir(
        st == 401 and "topilmadi" not in str(body).lower(),
        "mavjud boʻlmagan login uchun xabar UMUMIY (enumeration yoʻq)",
        str(body.get("message"))[:40] if isinstance(body, dict) else "",
    )

    # ─────────────────── 2. Ota-ona — X-1 ───────────────────

    sarlavha("2. Ota-ona faqat oʻz farzandini koʻradi (X-1)")

    st, royxat, _ = call("GET", "/school/students", tok_ota)
    tekshir(
        st == 200 and len(royxat) == 1,  # type: ignore[arg-type]
        "oʻquvchilar roʻyxati faqat oʻz farzandi",
        f"{len(royxat) if isinstance(royxat, list) else '?'} ta",
    )

    if begona_ota_tok:
        st, _, _ = call("GET", f"/school/students/{ali['id']}", begona_ota_tok)
        tekshir(st == 403, "begona ota-ona kartochkani ocha olmaydi", f"{st}")

        st, _, _ = call("GET", f"/journal/students/{ali['id']}/grades", begona_ota_tok)
        tekshir(st == 403, "begona ota-ona baholarni ocha olmaydi", f"{st}")

        st, _, _ = call("GET", f"/journal/students/{ali['id']}/homework", begona_ota_tok)
        tekshir(st == 403, "begona ota-ona vazifalarni ocha olmaydi", f"{st}")

        st, _, _ = call("GET", f"/tests/students/{ali['id']}/available", begona_ota_tok)
        tekshir(st == 403, "begona ota-ona testlarni ocha olmaydi", f"{st}")

    st, kartochka2, _ = call("GET", f"/school/students/{ali['id']}", tok_ota)
    tekshir(st == 200, "oʻz farzandi kartochkasi ochiladi", f"{st}")

    st, r2, _ = call("GET", "/school/students", tok_ota)
    maydonlar = set(r2[0]) if isinstance(r2, list) and r2 else set()  # type: ignore[index]
    tekshir(
        maydonlar == {"id", "full_name", "class_name", "is_archived"},
        "roʻyxatda shaxsiy maʼlumot yoʻq (X-6)",
        ", ".join(sorted(maydonlar)),
    )

    st, _, _ = call(
        "POST",
        "/school/students",
        tok_ota,
        {"last_name": "Soxta", "first_name": "Oquvchi"},
    )
    tekshir(st == 403, "ota-ona oʻquvchi qoʻsha olmaydi", f"{st}")

    # ─────────────────── 3. Ustoz kesimi ───────────────────

    sarlavha("3. Ustoz oʻz sinfi va oʻz fani bilan cheklanadi")

    # Bugun dars boʻlmasligi mumkin (dam olish kuni). Tekshiruv
    # oʻtkazib yuborilmasligi uchun butun hafta olinadi.
    bugun = dt.date.today()
    dush = bugun - dt.timedelta(days=bugun.weekday())
    oraliq = f"?date_from={dush}&date_to={dush + dt.timedelta(days=6)}"

    st, darslar, _ = call("GET", "/attendance/my-lessons/range", tok_a, query=oraliq)
    tekshir(st == 200, "ustoz A oʻz darslarini oladi", f"{len(darslar) if darslar else 0} ta")

    st, darslar_b, _ = call("GET", "/attendance/my-lessons/range", tok_b, query=oraliq)
    a_idlar = {d["id"] for d in darslar} if darslar else set()  # type: ignore[union-attr]
    b_idlar = {d["id"] for d in darslar_b} if darslar_b else set()  # type: ignore[union-attr]
    tekshir(not (a_idlar & b_idlar), "ikki ustozning darslari aralashmaydi")

    if darslar:
        dars = darslar[0]  # type: ignore[index]
        st, _, _ = call("GET", f"/attendance/lessons/{dars['id']}", tok_b)
        tekshir(st == 403, "begona ustoz boshqaning darsini ocha olmaydi", f"{st}")

        st, _, _ = call("GET", f"/journal/lessons/{dars['id']}", tok_b)
        tekshir(st == 403, "begona ustoz boshqaning jurnalini ocha olmaydi", f"{st}")

        st, _, _ = call(
            "POST",
            f"/journal/lessons/{dars['id']}",
            tok_b,
            {"rows": [{"student_id": ali["id"], "value": 5}]},
        )
        tekshir(st == 403, "begona ustoz baho qoʻya olmaydi", f"{st}")

    st, _, _ = call("GET", f"/journal/classes/{slot['class_id']}/averages", tok_a)
    tekshir(st == 403, "fan ustoziga sinf oʻrtachasi berilmaydi", f"{st}")

    st, _, _ = call(
        "POST",
        "/school/staff",
        tok_a,
        {"last_name": "Soxta", "first_name": "Xodim", "roles": ["teacher"]},
    )
    tekshir(st == 403, "ustoz xodim hisobi ocha olmaydi", f"{st}")

    st, _, _ = call(
        "POST",
        "/schedule/entries",
        tok_a,
        {
            "class_id": slot["class_id"],
            "subject_id": slot["subject_id"],
            "teacher_id": ustoz_a["user_id"],
            "weekday": 6,
            "period": 9,
        },
    )
    tekshir(st == 403, "huquqsiz ustoz jadval tuza olmaydi", f"{st}")

    # ─────────────────── 4. Huquq oshirish ───────────────────

    sarlavha("4. Huquqni oshirishga urinish")

    st, _, _ = call(
        "PUT",
        f"/access/users/{ustoz_a['user_id']}/permissions",
        tok_a,
        {"permissions": ["users.create", "permissions.grant"]},
    )
    tekshir(st == 403, "ustoz oʻziga huquq bera olmaydi", f"{st}")

    st, _, _ = call(
        "PUT",
        f"/access/users/{ustoz_a['user_id']}/sections",
        tok_a,
        {"sections": ["/admin/sozlamalar"]},
    )
    tekshir(st == 403, "ustoz oʻziga boʻlim qoʻsha olmaydi", f"{st}")

    st, _, _ = call(
        "POST",
        "/school/staff",
        sa,
        {"last_name": "Soxta", "first_name": "Super", "roles": ["parent"]},
    )
    tekshir(st == 422, "xodim endpointidan ota-ona hisobi ochilmaydi", f"{st}")

    st, _, _ = call("POST", f"/school/staff/{ustoz_b['user_id']}/reset-password", tok_a)
    tekshir(st == 403, "ustoz boshqaning parolini tiklay olmaydi", f"{st}")

    # ─────────────────── 5. Testlar — javob sizib chiqishi ───────────────────

    sarlavha("5. Test javoblari sizib chiqmaydi (eng muhim)")

    hozir = dt.datetime.now(dt.UTC)
    st, test, _ = call(
        "POST",
        "/tests",
        tok_a,
        {
            "class_id": slot["class_id"],
            "subject_id": slot["subject_id"],
            "title": "Xavfsizlik tekshiruvi (sinov)",
            "duration_minutes": 10,
            "attempts_allowed": 1,
            "opens_at": (hozir - dt.timedelta(minutes=5)).isoformat(),
            "closes_at": (hozir + dt.timedelta(hours=2)).isoformat(),
        },
    )
    if st != 201:
        tekshir(False, "test yaratildi", f"{st} {test}")
        return _yakun()

    st, savol, _ = call(
        "POST",
        f"/tests/{test['id']}/questions",  # type: ignore[index]
        tok_a,
        {
            "text": "2 + 2 = ?",
            "kind": "single",
            "points": 1,
            "options": [
                {"text": "4", "is_correct": True},
                {"text": "5", "is_correct": False},
            ],
        },
    )
    call("PUT", f"/tests/{test['id']}/status", tok_a, {"status": "published"})  # type: ignore[index]

    st, _, xom_ustoz = call("GET", f"/tests/{test['id']}/questions", tok_a)  # type: ignore[index]
    tekshir("is_correct" in xom_ustoz, "ustoz toʻgʻri javobni koʻradi")

    st, _, _ = call("GET", f"/tests/{test['id']}/questions", tok_ota)  # type: ignore[index]
    tekshir(st == 403, "ota-ona ustoz endpointidan javob ololmaydi", f"{st}")

    st, boshlandi, xom_oquvchi = call(
        "POST",
        f"/tests/{test['id']}/students/{ali['id']}/start",  # type: ignore[index]
        tok_ota,
    )
    tekshir(st == 200, "oʻquvchi testni boshlaydi", f"{st}")
    tekshir("is_correct" not in xom_oquvchi, "oʻquvchi javobida `is_correct` YOʻQ")
    if st == 200:
        variant = boshlandi["questions"][0]["options"][0]  # type: ignore[index]
        tekshir(
            set(variant) == {"id", "text"},
            "variant faqat id va matn",
            ", ".join(sorted(variant)),
        )

        # Ball frontenddan berilmaydi: soxta ball yuboramiz.
        st, natija, _ = call(
            "POST",
            f"/tests/attempts/{boshlandi['attempt_id']}/submit",  # type: ignore[index]
            tok_ota,
            {
                "answers": [{"question_id": savol["id"], "selected": []}],  # type: ignore[index]
                "score": 100,
                "max_score": 100,
            },
        )
        tekshir(
            st == 200 and natija["score"] == 0,  # type: ignore[index]
            "yuborilgan soxta ball eʼtiborga olinmaydi",
            f"ball={natija.get('score') if isinstance(natija, dict) else '?'}",
        )

        st, _, _ = call(
            "POST",
            f"/tests/{test['id']}/students/{ali['id']}/start",  # type: ignore[index]
            tok_ota,
        )
        tekshir(st == 409, "urinishlar chegarasi serverda ushlanadi", f"{st}")

    call("POST", f"/tests/{test['id']}/archive", tok_a)  # type: ignore[index]

    # ─────────────────── 6. Mass assignment ───────────────────

    sarlavha("6. Ortiqcha maydon yuborish (mass assignment)")

    st, _, _ = call(
        "POST",
        "/auth/login",
        body={"login": a_login, "password": a_parol, "roles": ["superadmin"]},
    )
    tekshir(st == 200, "login javobi ortiqcha maydondan oʻzgarmaydi", f"{st}")

    st, me, _ = call("GET", "/auth/me", tok_a)
    tekshir(
        "superadmin" not in me["roles"],  # type: ignore[index]
        "yuborilgan `roles` rol bermaydi",
        ",".join(me["roles"]) if isinstance(me, dict) else "",
    )

    if darslar:
        st, _, _ = call(
            "POST",
            f"/attendance/lessons/{darslar[0]['id']}",  # type: ignore[index]
            tok_a,
            {
                "rows": [{"student_id": ali["id"], "status": "present"}],
                "topic": "Sinov",
                "marked_by_id": "00000000-0000-0000-0000-000000000001",
                "is_archived": True,
            },
        )
        tekshir(st in (200, 403), "davomatda ortiqcha maydon tashlanadi", f"{st}")

    # ─────────────────── 7. Yaroqsiz kiritish ───────────────────

    sarlavha("7. Yaroqsiz kiritish")

    st, _, _ = call("GET", "/school/students/' OR 1=1--", sa)
    tekshir(st == 422, "SQL kiritishga oʻxshash id rad etiladi", f"{st}")

    st, _, _ = call("GET", "/school/students", sa, query="?limit=100000")
    tekshir(st == 422, "juda katta `limit` rad etiladi", f"{st}")

    st, _, _ = call("GET", "/school/students", sa, query="?class_id=not-a-uuid")
    tekshir(st == 422, "notoʻgʻri UUID rad etiladi", f"{st}")

    if darslar:
        st, _, _ = call(
            "POST",
            f"/journal/lessons/{darslar[0]['id']}",  # type: ignore[index]
            tok_a,
            {"rows": [{"student_id": ali["id"], "value": 999}]},
        )
        tekshir(st == 422, "chegaradan tashqari baho rad etiladi", f"{st}")

    # ─────────────────── 8. Sarlavhalar ───────────────────

    sarlavha("8. Javob sarlavhalari")

    req = urllib.request.Request(f"{BASE}/health")  # noqa: S310
    with urllib.request.urlopen(req) as r:  # noqa: S310
        h = {k.lower(): v for k, v in r.headers.items()}

    tekshir(h.get("x-content-type-options") == "nosniff", "X-Content-Type-Options: nosniff")
    tekshir(h.get("x-frame-options") == "DENY", "X-Frame-Options: DENY")
    tekshir("content-security-policy" in h, "Content-Security-Policy qoʻyilgan")
    tekshir("referrer-policy" in h, "Referrer-Policy qoʻyilgan")
    tekshir(
        "server" not in h or "uvicorn" not in h.get("server", "").lower(),
        "server versiyasi oshkor qilinmaydi",
        h.get("server", "yoʻq"),
    )

    return _yakun()


def _yakun() -> int:
    otdi = sum(1 for ok, _ in _natijalar if ok)
    jami = len(_natijalar)
    print(f"\n{'=' * 62}")
    print(f"  {otdi}/{jami} tekshiruv oʻtdi")
    yiqilgan = [m for ok, m in _natijalar if not ok]
    if yiqilgan:
        print("\n  Oʻtmaganlari:")
        for m in yiqilgan:
            print(f"    {XATO} {m}")
        return 1
    print("  Barcha xavfsizlik tekshiruvlari oʻtdi.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
