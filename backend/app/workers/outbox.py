"""Xabarnoma worker'i — navbatni boʻshatadi (T-018).

Ishga tushirish:

    uv run python -m app.workers.outbox

Serverda `systemd` xizmati sifatida turadi va `tarbion-api` bilan yonma-yon
ishlaydi. Alohida jarayon boʻlishi shart: web soʻrovi 200 ms da tugaydi,
Telegram esa 10 soniyagacha kutdirishi mumkin.

Toʻxtatilsa hech narsa yoʻqolmaydi — navbat bazada. Qayta ishga
tushganda qolgan xabarlar yetkaziladi.
"""

from __future__ import annotations

import asyncio
import signal
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionFactory, engine
from app.models import NotificationOutbox, OutboxChannel, User
from app.services import outbox_service
from app.workers import channels

#: Toʻxtatish signali kelganda oʻrnatiladi. Sikl joriy toʻplamni
#: tugatib, keyin chiqadi — yarim yuborilgan holat qolmasin.
_toxtat = asyncio.Event()


async def _yubor(row: NotificationOutbox, chat_id: int) -> None:
    if row.channel == OutboxChannel.TELEGRAM.value:
        await channels.send_telegram(chat_id, row.title, row.body)
        return
    raise channels.PermanentError(f"nomaʼlum kanal: {row.channel}")


async def bir_sikl() -> int:
    """Bitta toʻplamni yetkazadi. Qaytaradi: nechta xabar koʻrildi.

    Har xabar OʻZ tranzaksiyasida yakunlanmaydi — toʻplam birga
    saqlanadi. Sabab: `claim_batch` qatorlarni qulflab oladi, qulf esa
    tranzaksiya bilan birga tugaydi. Toʻplam kichik (50 ta), shuning
    uchun bu xavf tugʻdirmaydi.
    """
    async with SessionFactory() as session:
        rows = await outbox_service.claim_batch(session, settings.outbox_batch_size)
        if not rows:
            return 0

        for row in rows:
            chat_id = await session.scalar(
                select(User.telegram_id).where(User.id == row.user_id)
            )
            if chat_id is None:
                # Xabar navbatga qoʻyilgandan keyin Telegram uzilgan.
                outbox_service.mark_failed(row, "telegram_id yoʻq")
                continue
            try:
                await _yubor(row, chat_id)
            except channels.PermanentError as e:
                # Qayta urinish foyda bermaydi — darhol yakunlaymiz.
                row.attempts = outbox_service.MAX_ATTEMPTS
                outbox_service.mark_failed(row, str(e))
            except channels.DeliveryError as e:
                outbox_service.mark_failed(row, str(e))
            else:
                outbox_service.mark_sent(row)

        await session.commit()
        return len(rows)


async def main() -> None:
    for oqim in (sys.stdout, sys.stderr):
        if hasattr(oqim, "reconfigure"):
            oqim.reconfigure(encoding="utf-8", errors="replace")

    if not channels.telegram_configured():
        raise SystemExit(
            "TELEGRAM_BOT_TOKEN sozlanmagan — worker ishga tushmaydi.\n"
            "Navbat toʻplanaveradi va token qoʻyilgach hammasi yetkaziladi."
        )

    halqa = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            halqa.add_signal_handler(sig, _toxtat.set)
        except NotImplementedError:
            # Windows'da SIGTERM qoʻllab-quvvatlanmaydi — u yerda
            # Ctrl+C KeyboardInterrupt boʻlib keladi.
            pass

    print(f"Worker ishga tushdi. Interval: {settings.outbox_poll_seconds} s")
    while not _toxtat.is_set():
        try:
            n = await bir_sikl()
            if n:
                print(f"  {n} ta xabar koʻrildi")
        except Exception as e:  # noqa: BLE001 — sikl hech qachon toʻxtamasligi kerak
            # Bitta toʻplamdagi kutilmagan xato butun worker'ni
            # yiqitmasin: keyingi siklda qayta uriniladi.
            print(f"  sikl xatosi: {type(e).__name__}: {e}", file=sys.stderr)

        try:
            await asyncio.wait_for(_toxtat.wait(), timeout=settings.outbox_poll_seconds)
        except TimeoutError:
            pass

    await engine.dispose()
    print("Worker toʻxtadi.")


if __name__ == "__main__":
    asyncio.run(main())
