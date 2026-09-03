# Serverdagi xizmatlar

Ishlab chiqarish serverida toʻrtta `systemd` xizmati ishlaydi:

| Xizmat | Nima qiladi | Fayl |
|---|---|---|
| `tarbion-api` | FastAPI (uvicorn, `172.18.0.1:8300`) | serverda |
| `tarbion-web` | Next.js | serverda |
| `tarbion-bot` | Telegram bot — ulanish (T-017) | shu papkada |
| `tarbion-outbox` | Xabar navbatini boʻshatadi (T-018) | shu papkada |

`tarbion-api` va `tarbion-web` fayllari tarixan faqat serverda yozilgan
va bu yerga koʻchirilmagan — ularga tegilmadi. Yangi ikkitasi shu yerda
saqlanadi: server qaytadan qurilsa, sozlama esdan chiqmasin.

## Oʻrnatish

```bash
scp deploy/tarbion-bot.service deploy/tarbion-outbox.service \
    root@SERVER:/etc/systemd/system/
ssh root@SERVER 'systemctl daemon-reload && \
  systemctl enable --now tarbion-bot tarbion-outbox'
```

## Kerakli sozlamalar

Ikkala xizmat ham `/opt/tarbion/backend/.env` ni oʻqiydi (uv `.env` ni
oʻzi yuklaydi). Zarur kalitlar:

```
TELEGRAM_BOT_TOKEN=...      # @BotFather
TELEGRAM_BOT_USERNAME=...   # @ siz
```

Token boʻlmasa ikkala jarayon ham ataylab **darhol toʻxtaydi** va
sababini yozadi — jimgina ishlab, hech narsa qilmay turgandan koʻra
yaxshi.

**DIQQAT:** bitta bot tokenini ikki jarayon `getUpdates` bilan soʻrasa
Telegram `409` qaytaradi. `tarbion-bot` va `tools/task_inbox.py` bir xil
token bilan ishlay olmaydi.

## Tekshirish

```bash
systemctl status tarbion-bot tarbion-outbox
journalctl -u tarbion-bot -n 50 --no-pager
```
