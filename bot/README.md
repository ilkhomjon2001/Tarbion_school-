# Telegram bot

Kod `backend/app/bot/` da — bu papkada emas.

**Nega:** bot backend bilan bir xil SQLAlchemy modellari, konfiguratsiyasi
va `services/access.py` qatlamini ishlatadi (CLAUDE.md, X-8). Alohida papka
alohida muhit va bogʻliqliklar toʻplamini talab qilardi — yoki modellarning
ikkinchi nusxasini, va u vaqt oʻtib birinchisidan ajralib qolardi.
Sabab batafsil: `docs/DECISIONS.md`.

## Ishga tushirish

```bash
cd backend
uv run python -m app.bot.main       # TELEGRAM_BOT_TOKEN kerak
```

## Ulanish (T-017, BOT-01)

Ota-ona `/start` bosadi → «Raqamimni yuborish» tugmasi → kabinetidan olgan
6 raqamli kodni yuboradi → `telegram_id` bogʻlanadi.

Ikkala shart ham kerak: raqam SIM kartani, kod esa maktabdagi hisobning
parolini bilishini isbotlaydi.

Buyruqlar: `/start`, `/uzish`, `/yordam`.

**DIQQAT:** bitta bot tokenini ikki jarayon `getUpdates` bilan soʻrasa
Telegram `409` qaytaradi. Bu bot va `tools/task_inbox.py` bir xil token
bilan ishlay olmaydi.
