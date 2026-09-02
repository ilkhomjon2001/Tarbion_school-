"""Xabar yetkazish kanallari (BOT-02).

Hozircha bitta kanal — Telegram. Abstraksiya baribir kerak: kanal
yiqilganda worker mantiqi oʻzgarmasligi va yangi kanal (masalan SMS)
qoʻshilganda faqat shu fayl toʻlishi uchun.

Xatolar ikkiga boʻlinadi va bu farq muhim: vaqtinchalik nosozlikda
xabar navbatda qoladi, doimiysida esa darhol `failed` boʻladi. Bloklab
qoʻygan foydalanuvchiga uch marta yozishga urinish — behuda ish va
navbatni band qiladi.
"""

from __future__ import annotations

import httpx

from app.core.config import settings

#: Telegram javob bermasa shuncha kutamiz. Uzoq kutish worker'ni
#: bloklaydi — navbatdagi qolgan xabarlar ham kechikadi.
TIMEOUT_SECONDS = 10.0


class DeliveryError(Exception):
    """Yetkazib boʻlmadi. Xabar navbatda qoladi va qayta uriniladi."""


class PermanentError(DeliveryError):
    """Qayta urinish foyda bermaydi.

    Masalan foydalanuvchi botni bloklagan yoki chat oʻchirilgan.
    """


def telegram_configured() -> bool:
    return bool(settings.telegram_bot_token)


async def send_telegram(chat_id: int, title: str, body: str) -> None:
    """Telegram'ga xabar yuboradi.

    HTML yoki Markdown rejimi ATAYLAB tanlanmadi: xabar matnida oʻquvchi
    ismi va ustoz izohi bor, ularda `<`, `&` yoki `_` uchrasa Telegram
    butun xabarni rad etardi. Oddiy matn hech qachon buzilmaydi.
    """
    if not telegram_configured():
        raise DeliveryError("TELEGRAM_BOT_TOKEN sozlanmagan")

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": f"{title}\n\n{body}",
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as e:
        # Tarmoq uzildi yoki Telegram javob bermadi — qayta uriniladi.
        raise DeliveryError(f"tarmoq: {type(e).__name__}") from e

    if resp.status_code in (400, 403):
        # Bot bloklangan, chat topilmadi, foydalanuvchi oʻchirilgan —
        # bular oʻz-oʻzidan tuzalmaydi.
        raise PermanentError(f"{resp.status_code}: {resp.text[:200]}")
    if resp.status_code >= 400:
        raise DeliveryError(f"{resp.status_code}: {resp.text[:200]}")

    javob = resp.json()
    if not javob.get("ok"):
        raise DeliveryError(str(javob.get("description", "nomaʼlum xato"))[:200])
