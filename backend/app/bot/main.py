"""Botni ishga tushirish (T-017).

    uv run python -m app.bot.main

Serverda `systemd` xizmati sifatida `tarbion-api` va outbox worker
bilan yonma-yon turadi.

DIQQAT: bitta bot tokenini IKKI jarayon `getUpdates` bilan soʻrasa
Telegram `409` qaytaradi va xabarlar ikkiga boʻlinib ketadi. Ya'ni bu
bot va `tools/task_inbox.py` bir xil token bilan ishlay olmaydi.
"""

from __future__ import annotations

import asyncio
import sys

from aiogram import Bot, Dispatcher

from app.bot.handlers import router
from app.core.config import settings
from app.core.db import engine


async def main() -> None:
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    if not settings.telegram_bot_token:
        raise SystemExit(
            "TELEGRAM_BOT_TOKEN sozlanmagan — bot ishga tushmaydi.\n"
            "Tokenni @BotFather beradi, `.env` ga yozing."
        )

    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher()
    dp.include_router(router)

    me = await bot.get_me()
    print(f"Bot ishga tushdi: @{me.username}")
    try:
        # Eski, yetkazilmagan yangilanishlar tashlab yuboriladi: bot uzoq
        # oʻchiq turgan boʻlsa, qayta yoqilganda bir necha kunlik «/start»
        # toʻlqinini qayta ishlash foyda bermaydi.
        await dp.start_polling(
            bot, allowed_updates=["message"], drop_pending_updates=True
        )
    finally:
        await bot.session.close()
        await engine.dispose()
        print("Bot toʻxtadi.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
