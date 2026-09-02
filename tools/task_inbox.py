#!/usr/bin/env python3
"""Telegram guruhidagi tasklarni yigʻadi.

Guruh faqat tasklar uchun, shuning uchun **har bir xabar** olinadi —
buyruq prefiksi kerak emas. Xabarlar `tools/inbox/inbox.jsonl` ga
tushadi, keyin ular qoʻlda `TASKS.md` ga koʻchiriladi.

Ishlatish:

    export TASKS_BOT_TOKEN=...            # @BotFather bergan token
    python tools/task_inbox.py --chats    # guruh id sini topish
    export TASKS_CHAT_IDS=-1001234567890
    python tools/task_inbox.py --once     # navbatdagini olib, chiqadi
    python tools/task_inbox.py --serve    # doimiy (systemd uchun)
    python tools/task_inbox.py --show     # yigʻilganini koʻrsatadi

Bogʻliqlik yoʻq — faqat standart kutubxona.

──────────────────────────────────────────────────────────────────────
Ikki shart, ikkalasi ham majburiy

1. @BotFather da **privacy rejimi oʻchirilgan** boʻlsin
   (`/setprivacy` → Disable). Yoqiq boʻlsa bot faqat `/` bilan
   boshlangan xabarlarni koʻradi va oddiy tasklar yetib kelmaydi.
   Oʻzgartirgandan keyin botni guruhdan chiqarib, qayta qoʻshing.

2. `TASKS_CHAT_IDS` — ruxsat etilgan guruh. Usiz ishlamaydi: bot
   username'ini topgan istalgan odam unga yozib, inbox'ga qator
   qoʻsha olardi.

──────────────────────────────────────────────────────────────────────
Nega Telegram xabari BUYRUQ emas

Bu yerga tushgan matn — maʼlumot. Skript uni hech qachon bajarmaydi va
`TASKS.md` ga oʻzi yozmaydi. Har bir yozuv odam koʻrib chiqqandan
keyin taskka aylanadi.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
INBOX = BASE / "inbox" / "inbox.jsonl"
STATE = BASE / "inbox" / "state.json"
ENV = BASE / ".env"


def env_yukla() -> None:
    """`tools/.env` ni oʻqiydi. Muhitdagi qiymat ustun turadi.

    Token har safar `export` qilinmasin uchun. Fayl git'ga tushmaydi
    (`.gitignore` da `.env` bor).
    """
    if not ENV.exists():
        return
    for qator in ENV.read_text("utf-8").splitlines():
        qator = qator.strip()
        if not qator or qator.startswith("#") or "=" not in qator:
            continue
        kalit, _, qiymat = qator.partition("=")
        os.environ.setdefault(kalit.strip(), qiymat.strip().strip('"').strip("'"))

#: `getUpdates` uchun long-polling. Telegram shuncha kutadi, xabar
#: chiqsa darhol qaytaradi — ya'ni bu kechikish emas, tejamkorlik.
POLL_TIMEOUT = 50

#: Telegram olinmagan yangilanishlarni SHUNCHA saqlaydi. Skript bundan
#: uzoq ishlamasa xabarlar butunlay yoʻqoladi — ogohlantiramiz.
RETENTION_HOURS = 24


def api(token: str, method: str, **params: object) -> list | dict:
    """Telegram API chaqiruvi. Xato boʻlsa istisno koʻtaradi."""
    url = f"https://api.telegram.org/bot{token}/{method}"
    aniq = {k: v for k, v in params.items() if v is not None}
    if aniq:
        url += "?" + urllib.parse.urlencode(aniq)
    try:
        with urllib.request.urlopen(  # noqa: S310 — manzil qatʼiy https
            url, timeout=POLL_TIMEOUT + 15, context=ssl.create_default_context()
        ) as r:
            javob = json.loads(r.read())
    except urllib.error.HTTPError as e:
        matn = e.read().decode("utf-8", "replace")[:200]
        if e.code == 409:
            # Eng koʻp uchraydigan xato, shuning uchun alohida tushuntirish.
            raise SystemExit(
                "409: shu token bilan boshqa jarayon ham ishlayapti "
                "(maktab boti?). Bitta tokenni ikki joyda soʻrab boʻlmaydi — "
                "xabarlar ikkiga boʻlinib ketadi va qaysi biri qayerga "
                "tushgani bilinmaydi. Dev uchun ALOHIDA bot oching.\n" + matn
            ) from e
        raise SystemExit(f"Telegram {e.code}: {matn}") from e

    if not javob.get("ok"):
        raise SystemExit(f"Telegram rad etdi: {javob.get('description')}")
    return javob["result"]


def holat_oq() -> dict:
    if not STATE.exists():
        return {"offset": 0, "last_run": None}
    return json.loads(STATE.read_text("utf-8"))


def holat_yoz(holat: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(holat, ensure_ascii=False, indent=2), "utf-8")


def uzilish_ogohlantirishi(holat: dict) -> None:
    """Skript 24 soatdan uzoq ishlamagan boʻlsa baland ovozda aytadi.

    Yoʻqotish JIM boʻlmasligi kerak: odam guruhga yozgan, xabar
    yetmagan, va hech kim buni bilmay qolgan — eng yomon holat.
    """
    oxirgi = holat.get("last_run")
    if not oxirgi:
        return
    tafovut = (datetime.now(UTC) - datetime.fromisoformat(oxirgi)).total_seconds()
    if tafovut > RETENTION_HOURS * 3600:
        soat = int(tafovut // 3600)
        print(
            f"\n  DIQQAT: oxirgi tekshiruvdan {soat} soat oʻtdi.\n"
            f"  Telegram olinmagan xabarni faqat {RETENTION_HOURS} soat saqlaydi —\n"
            f"  undan eskisi YOʻQOLGAN boʻlishi mumkin. Guruhni qoʻlda koʻring.\n",
            file=sys.stderr,
        )


def matnni_ol(msg: dict) -> str | None:
    """Xabar matnini qaytaradi, olinmasa `None`.

    Tashlab ketiladi: bot yozgani (oʻz aks-sadosini yigʻmaymiz) va
    xizmat xabarlari — «X guruhga qoʻshildi», sarlavha oʻzgardi va
    hokazo. Ular matnsiz keladi, ya'ni oʻz-oʻzidan tushib qoladi.
    """
    if (msg.get("from") or {}).get("is_bot"):
        return None
    matn = (msg.get("text") or msg.get("caption") or "").strip()
    return matn or None


def kim(msg: dict) -> str:
    """Kim yozgani. Eski task guruhga forward qilinsa — asl muallifi."""
    asl = msg.get("forward_origin") or {}
    f = asl.get("sender_user") or msg.get("from") or {}
    ism = " ".join(x for x in (f.get("first_name"), f.get("last_name")) if x)
    ism = ism or asl.get("sender_user_name") or ""
    login = f.get("username")
    natija = f"{ism} (@{login})" if login else ism or "nomaʼlum"
    return f"{natija} · forward" if asl else natija


def yigish(token: str, ruxsat: set[int], *, once: bool) -> int:
    """Yangilanishlarni olib, tasklarni inbox'ga yozadi. Qaytaradi: nechta."""
    holat = holat_oq()
    uzilish_ogohlantirishi(holat)

    jami = 0
    while True:
        yangi = api(
            token,
            "getUpdates",
            offset=holat["offset"] or None,
            timeout=0 if once else POLL_TIMEOUT,
            allowed_updates=json.dumps(["message"]),
        )
        for u in yangi:
            msg = u.get("message") or {}
            chat = msg.get("chat") or {}
            matn = matnni_ol(msg)
            if matn and chat.get("id") in ruxsat:
                # Offset xabar SAQLANGANDAN keyin suriladi — skript shu
                # yerda yiqilsa xabar Telegram'da qoladi va qayta olinadi.
                INBOX.parent.mkdir(parents=True, exist_ok=True)
                # Forward qilingan eski task asl sanasini saqlab qolsin —
                # aks holda hammasi «bugun» boʻlib koʻrinardi.
                asl = msg.get("forward_origin") or {}
                sana = asl.get("date") or msg["date"]
                yozuv = {
                    "update_id": u["update_id"],
                    "vaqt": datetime.fromtimestamp(sana, UTC).isoformat(),
                    "kim": kim(msg),
                    "chat": chat.get("title") or str(chat.get("id")),
                    "matn": matn,
                }
                with INBOX.open("a", encoding="utf-8") as f:
                    f.write(json.dumps(yozuv, ensure_ascii=False) + "\n")
                jami += 1
                print(f"  + {yozuv['kim']}: {matn[:70]}")
            elif matn:
                print(
                    f"  - ruxsatsiz chat {chat.get('id')} "
                    f"({chat.get('title') or chat.get('type')}) — eʼtiborsiz",
                    file=sys.stderr,
                )
            holat["offset"] = u["update_id"] + 1

        holat["last_run"] = datetime.now(UTC).isoformat()
        holat_yoz(holat)
        if once:
            return jami
        if not yangi:
            time.sleep(1)


def chatlarni_korsat(token: str) -> None:
    """Bot qaysi chatlarda ekanini koʻrsatadi — id topish uchun."""
    yangi = api(token, "getUpdates", timeout=0, allowed_updates=json.dumps(["message"]))
    korilgan: dict[int, str] = {}
    for u in yangi:
        chat = (u.get("message") or {}).get("chat") or {}
        if chat.get("id"):
            nom = chat.get("title") or chat.get("username") or ""
            korilgan[chat["id"]] = f"{chat.get('type')} · {nom}"
    if not korilgan:
        print(
            "Hech narsa yoʻq. Tekshiring:\n"
            "  1. @BotFather → /setprivacy → Disable\n"
            "  2. Bot guruhda (privacy oʻzgargan boʻlsa chiqarib, qayta qoʻshing)\n"
            "  3. Guruhda biror xabar yozing\n"
            "keyin qaytadan ishga tushiring."
        )
        return
    print("Topilgan chatlar:\n")
    for cid, tavsif in korilgan.items():
        print(f"  {cid}   {tavsif}")
    print("\nKerakligini TASKS_CHAT_IDS ga yozing (vergul bilan).")


def korsat(*, hammasi: bool) -> None:
    """Inbox'ni chiqaradi.

    Sukut boʻyicha faqat OʻQILMAGANLARI — sessiya boshida butun tarixni
    qayta oʻqish shart emas. Kursor `state.json` da; `--show-all` uni
    eʼtiborsiz qoldiradi.
    """
    if not INBOX.exists():
        print("Inbox boʻsh.")
        return
    qatorlar = INBOX.read_text("utf-8").splitlines()
    holat = holat_oq()
    boshi = 0 if hammasi else holat.get("shown", 0)
    yangi = qatorlar[boshi:]
    if not yangi:
        print("Yangi task yoʻq.")
        return
    for qator in yangi:
        y = json.loads(qator)
        vaqt = datetime.fromisoformat(y["vaqt"]).strftime("%d-%m %H:%M")
        print(f"[{vaqt}] {y['kim']}\n    {y['matn']}\n")
    holat["shown"] = len(qatorlar)
    holat_yoz(holat)


def main() -> None:
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    p = argparse.ArgumentParser(description="Telegram guruhidan tasklarni yigʻadi")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--once", action="store_true", help="navbatdagini olib chiqadi")
    g.add_argument("--serve", action="store_true", help="doimiy ishlaydi")
    g.add_argument("--chats", action="store_true", help="chat id larini koʻrsatadi")
    p.add_argument("--show", action="store_true", help="oʻqilmagan tasklarni chiqaradi")
    p.add_argument("--show-all", action="store_true", help="butun inbox'ni chiqaradi")
    args = p.parse_args()

    if not (args.once or args.serve or args.chats or args.show or args.show_all):
        p.error("kamida bitta amal kerak (--once, --serve, --chats, --show)")

    if not (args.once or args.serve or args.chats):
        korsat(hammasi=args.show_all)
        return

    env_yukla()
    token = os.environ.get("TASKS_BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit("TASKS_BOT_TOKEN sozlanmagan.")

    if args.chats:
        chatlarni_korsat(token)
        return

    xom = os.environ.get("TASKS_CHAT_IDS", "").strip()
    if not xom:
        raise SystemExit(
            "TASKS_CHAT_IDS sozlanmagan. Ruxsat etilgan guruhsiz ishlamaydi —\n"
            "aks holda bot username'ini topgan har kim inbox'ga yoza olardi.\n"
            "Id ni topish: python tools/task_inbox.py --chats"
        )
    ruxsat = {int(x) for x in xom.replace(" ", "").split(",") if x}

    n = yigish(token, ruxsat, once=args.once)
    if args.once:
        print(f"{n} ta yangi xabar olindi." if n else "Yangi xabar yoʻq.")
        if args.show or args.show_all:
            print()
            korsat(hammasi=args.show_all)


if __name__ == "__main__":
    main()
