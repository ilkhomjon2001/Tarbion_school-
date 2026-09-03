#!/usr/bin/env bash
#
# Shifrlangan zaxira nusxa (X-12, T-022).
#
# Uchta qoida bu skriptni belgilaydi:
#
# 1. **Zaxira SERVERDA shifrlanadi va serverda ochiladigan kalit
#    YOʻQ.** `age` ochiq kalit bilan shifrlaydi; maxfiy kalit boshqa
#    joyda (masalan direktor seyfida, parol menejerida) saqlanadi.
#    Server buzib kirilsa ham hujumchi eski zaxiralarni ocha olmaydi —
#    aynan shu narsa oddiy "parolli arxiv" dan farq qiladi.
#
# 2. **Tiklab koʻrilmagan zaxira — zaxira emas.** Har bir zaxiradan
#    keyin u VAQTINCHALIK bazaga tiklanadi va jadval sanoqlari
#    tekshiriladi. Tekshiruvsiz zaxira "bor" degan tuygʻu beradi,
#    xolos.
#
# 3. **Boshqa joyda saqlanadi.** Lokal nusxa serverning oʻzida
#    qoladi (tez tiklash uchun), asosiysi esa R2 ga ketadi.
#
# Ishlatish:
#     ./scripts/backup.sh
#
# Kerakli muhit oʻzgaruvchilari `.env` dan olinadi:
#     DATABASE_URL          — qaysi bazadan nusxa olinadi
#     BACKUP_AGE_RECIPIENT  — age ochiq kaliti (age1...)
#     BACKUP_DIR            — lokal papka (sukut: /var/backups/tarbion)
#     BACKUP_KEEP_DAYS      — necha kun saqlanadi (sukut: 30)
#     R2_BUCKET, R2_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
#
# Cron:
#     15 3 * * *  /opt/tarbion/backend/scripts/backup.sh >> /var/log/tarbion-backup.log 2>&1

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
[ -f "$BACKEND_DIR/.env" ] && set -a && . "$BACKEND_DIR/.env" && set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tarbion}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
SANA="$(date -u +%Y%m%d-%H%M%S)"
NOM="tarbion-${SANA}.sql.gz.age"
YOL="${BACKUP_DIR}/${NOM}"

xato() {
    echo "XATO: $*" >&2
    exit 1
}

xabar() {
    echo "[$(date -u +%H:%M:%S)] $*"
}

# ─────────────────────── Tekshiruvlar ───────────────────────

command -v pg_dump >/dev/null || xato "pg_dump topilmadi"
command -v age >/dev/null || xato "age topilmadi (apt install age)"

[ -n "${DATABASE_URL:-}" ] || xato "DATABASE_URL berilmagan"
[ -n "${BACKUP_AGE_RECIPIENT:-}" ] || xato \
    "BACKUP_AGE_RECIPIENT berilmagan. Kalit juftini yasang:
       age-keygen -o backup-key.txt
     Maxfiy qismini SERVERDA QOLDIRMANG — parol menejeriga koʻchiring.
     Ochiq qismini (age1...) .env ga yozing."

# SQLAlchemy sxemasi (`postgresql+asyncpg://`) `pg_dump` ga tushunarsiz.
PGURL="${DATABASE_URL/postgresql+asyncpg:/postgresql:}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# ─────────────────────── Nusxa olish ───────────────────────

xabar "zaxira boshlandi: $NOM"

# `set -o pipefail` yoqilgan: quvurdagi har qanday qadam yiqilsa
# butun skript toʻxtaydi. Yarim yozilgan zaxira eng xavfli holat —
# u "bor" boʻlib koʻrinadi, lekin tiklab boʻlmaydi.
pg_dump --format=plain --no-owner --no-privileges --clean --if-exists "$PGURL" \
    | gzip -9 \
    | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$YOL"

chmod 600 "$YOL"
OLCHAM="$(du -h "$YOL" | cut -f1)"
xabar "shifrlandi: $OLCHAM"

# Boʻsh yoki juda kichik fayl — nimadir notoʻgʻri ketgan belgisi.
BAYT="$(stat -c%s "$YOL" 2>/dev/null || stat -f%z "$YOL")"
[ "$BAYT" -gt 1024 ] || xato "zaxira juda kichik ($BAYT bayt) — tekshiring"

# ─────────────────── R2 ga yuklash (boshqa joy) ───────────────────

if [ -n "${R2_BUCKET:-}" ] && command -v aws >/dev/null; then
    xabar "R2 ga yuklanmoqda"
    aws s3 cp "$YOL" "s3://${R2_BUCKET}/backups/${NOM}" \
        --endpoint-url "${R2_ENDPOINT}" \
        --only-show-errors
    xabar "R2 ga yuklandi"
else
    xabar "OGOHLANTIRISH: R2 sozlanmagan — zaxira FAQAT shu serverda."
    xabar "Server yoʻqolsa zaxira ham yoʻqoladi (X-12)."
fi

# ─────────────────────── Eskilarini tozalash ───────────────────────

find "$BACKUP_DIR" -name 'tarbion-*.sql.gz.age' -mtime "+${BACKUP_KEEP_DAYS}" -delete
QOLGAN="$(find "$BACKUP_DIR" -name 'tarbion-*.sql.gz.age' | wc -l)"
xabar "lokal zaxiralar: $QOLGAN ta (saqlash muddati ${BACKUP_KEEP_DAYS} kun)"

# ─────────────────────── Muvaffaqiyat belgisi ───────────────────────
#
# Faqat SKRIPT OXIRIGACHA yetib kelgandagina yoziladi. Shu sababli
# «oxirgi muvaffaqiyatli zaxira» sanasi haqiqatan ham muvaffaqiyatli
# zaxirani bildiradi — boshlangan, lekin uzilib qolganini emas.
#
# Buni `backup_alert.sh` oʻqiydi: «zaxira yiqildi» oʻzi kam maʼlumot
# beradi, «oxirgi zaxira 26 kun oldin» esa vaziyatning ogʻirligini
# darhol koʻrsatadi.
date -u +'%Y-%m-%dT%H:%M:%SZ' > "${BACKUP_DIR}/.oxirgi-muvaffaqiyat"

xabar "tayyor: $YOL"
echo "$YOL"
