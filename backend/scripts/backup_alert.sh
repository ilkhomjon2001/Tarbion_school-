#!/usr/bin/env bash
#
# Zaxira olinmaganini AYTADI (T-022, X-12).
#
# `tarbion-backup.service` yiqilganda systemd shu skriptni chaqiradi
# (`OnFailure=`). Sababi oddiy: jimgina yiqilgan zaxira eng yomon
# holat — hamma «zaxira bor» deb oʻylab yuradi, falokat kuni esa
# hech narsa yoʻqligi maʼlum boʻladi.
#
# ## Nega bazadan oʻtmaydi
#
# Loyihada xabar yuborishning toʻgʻri yoʻli — `notification_outbox`
# (T-018). Bu yerda u ATAYLAB ishlatilmagan: zaxira yiqilishining eng
# ehtimolli sababi — PostgreSQL ishlamayotgani. Bazaga yozadigan
# ogohlantirish aynan kerak boʻlgan paytda jim qolardi.
#
# Shuning uchun bu yerda Telegram API ga toʻgʻridan-toʻgʻri murojaat.
# Bu — qoidadan ONG BILAN qilingan istisno, adashish emas.
#
# ## Sozlash
#
#     BACKUP_ALERT_CHAT_ID=123456789   # administratorning Telegram id si
#
# `.env` da. Berilmasa skript jurnalga baland ovozda yozadi va
# muvaffaqiyatli chiqadi — ogohlantiruvchining oʻzi yiqilib,
# systemd jurnalini chalkashtirmasligi uchun.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
[ -f "$BACKEND_DIR/.env" ] && set -a && . "$BACKEND_DIR/.env" && set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tarbion}"
BELGI="${BACKUP_DIR}/.oxirgi-muvaffaqiyat"

# Oxirgi muvaffaqiyatli zaxira qachon boʻlgan — xabarning eng muhim
# qismi. «Zaxira yiqildi» oʻzi kam maʼlumot beradi: kecha olinganmi
# yoki bir oydan beri olinmayaptimi — javob choralari boshqa-boshqa.
if [ -f "$BELGI" ]; then
    OXIRGI="$(cat "$BELGI")"
    SONIYA=$(( $(date +%s) - $(date -d "$OXIRGI" +%s 2>/dev/null || echo 0) ))
    QANCHA="$(( SONIYA / 3600 )) soat oldin ($OXIRGI)"
else
    QANCHA="hech qachon — birinchi zaxira ham olinmagan"
fi

MATN="⚠️ Tarbion: ZAXIRA OLINMADI

Server: $(hostname)
Vaqt: $(TZ=Asia/Tashkent date '+%Y-%m-%d %H:%M') (Toshkent)
Oxirgi muvaffaqiyatli zaxira: ${QANCHA}

Sababni koʻrish:
  journalctl -u tarbion-backup.service -n 50"

# Jurnalga har doim yoziladi — Telegram ishlamasa ham iz qolsin.
echo "$MATN" >&2

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${BACKUP_ALERT_CHAT_ID:-}" ]; then
    echo "OGOHLANTIRISH: BACKUP_ALERT_CHAT_ID sozlanmagan —" \
         "zaxira yiqilgani HECH KIMGA yetkazilmadi." >&2
    exit 0
fi

# `--data-urlencode` matnni oʻzi kodlaydi; token URL da ketadi, lekin
# `--silent` va chiqishni yutish tufayli jurnalga tushmaydi (X-10).
curl --silent --show-error --max-time 20 \
    --output /dev/null \
    --data-urlencode "chat_id=${BACKUP_ALERT_CHAT_ID}" \
    --data-urlencode "text=${MATN}" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    && echo "ogohlantirish yuborildi" >&2 \
    || echo "OGOHLANTIRISH: Telegramga yuborib boʻlmadi" >&2

exit 0
