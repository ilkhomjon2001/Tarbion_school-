#!/usr/bin/env bash
#
# Zaxirani tiklab tekshirish (X-12).
#
# «Tiklab koʻrilmagan zaxira — zaxira emas.» Bu skript aynan shuni
# qiladi: zaxirani VAQTINCHALIK bazaga tiklaydi, jadval sanoqlarini
# tekshiradi va bazani oʻchiradi. Ishchi bazaga TEGMAYDI.
#
# Nega alohida skript: shifrlash uchun maxfiy kalit kerak, u esa
# serverda TURMAYDI (`backup.sh` ga qarang). Ya'ni tekshiruvni odam
# qoʻlda, kalit bilan ishga tushiradi — oyiga bir marta yetarli.
#
# Ishlatish:
#     ./scripts/restore_check.sh /var/backups/tarbion/tarbion-20260901-031500.sql.gz.age ~/backup-key.txt
#
# Haqiqiy tiklash (FALOKAT paytida):
#     age --decrypt -i KALIT ZAXIRA | gunzip | psql "$DATABASE_URL"
#   Diqqat: `pg_dump --clean` bilan olingan — u mavjud jadvallarni
#   OʻCHIRADI. Ishchi bazaga faqat bilib turib yuboring.

set -Eeuo pipefail

ZAXIRA="${1:-}"
KALIT="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# shellcheck disable=SC1091
[ -f "$BACKEND_DIR/.env" ] && set -a && . "$BACKEND_DIR/.env" && set +a

xato() {
    echo "XATO: $*" >&2
    exit 1
}

xabar() {
    echo "[$(date -u +%H:%M:%S)] $*"
}

[ -n "$ZAXIRA" ] || xato "foydalanish: $0 <zaxira.age> <maxfiy-kalit>"
[ -f "$ZAXIRA" ] || xato "zaxira topilmadi: $ZAXIRA"
[ -n "$KALIT" ] && [ -f "$KALIT" ] || xato "maxfiy kalit fayli topilmadi: $KALIT"
[ -n "${DATABASE_URL:-}" ] || xato "DATABASE_URL berilmagan"

command -v age >/dev/null || xato "age topilmadi"
command -v psql >/dev/null || xato "psql topilmadi"

PGURL="${DATABASE_URL/postgresql+asyncpg:/postgresql:}"
# Ulanish satridan baza nomini ajratamiz — vaqtinchalik bazaga
# oʻsha serverda ulanamiz.
ASOS="${PGURL%/*}"
SINOV_BAZA="tarbion_restore_check_$$"

tozalash() {
    xabar "vaqtinchalik bazani oʻchiryapmiz"
    psql "${ASOS}/postgres" -q -c "DROP DATABASE IF EXISTS ${SINOV_BAZA}" || true
}
trap tozalash EXIT

# ─────────────────────── Tiklash ───────────────────────

xabar "vaqtinchalik baza: $SINOV_BAZA"
psql "${ASOS}/postgres" -q -c "CREATE DATABASE ${SINOV_BAZA}"

xabar "shifrdan chiqarilmoqda va tiklanmoqda"
age --decrypt -i "$KALIT" "$ZAXIRA" \
    | gunzip \
    | psql "${ASOS}/${SINOV_BAZA}" -q -v ON_ERROR_STOP=1 >/dev/null

# ─────────────────────── Tekshiruv ───────────────────────
#
# Faqat "tiklandi" degani yetarli emas: boʻsh baza ham xatosiz
# tiklanadi. Shuning uchun eng muhim jadvallarda qator BORLIGI
# tekshiriladi.

xabar "tekshirilmoqda"

KUTILGAN_JADVALLAR=(users roles students classes lessons attendance_records audit_log)
XATOLAR=0

for jadval in "${KUTILGAN_JADVALLAR[@]}"; do
    if ! SONI="$(psql "${ASOS}/${SINOV_BAZA}" -tAc "SELECT count(*) FROM ${jadval}" 2>/dev/null)"; then
        echo "  ✗ ${jadval}: jadval yoʻq"
        XATOLAR=$((XATOLAR + 1))
        continue
    fi
    if [ "$SONI" -eq 0 ] && [ "$jadval" != "audit_log" ]; then
        echo "  ✗ ${jadval}: boʻsh"
        XATOLAR=$((XATOLAR + 1))
    else
        echo "  ✓ ${jadval}: ${SONI} qator"
    fi
done

# Audit triggeri ham tiklanganini tekshiramiz: u zaxirada boʻlmasa,
# tiklangan bazada jurnalni oʻchirib boʻlardi.
TRIGGER="$(psql "${ASOS}/${SINOV_BAZA}" -tAc \
    "SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'audit_log_no_%'")"
if [ "$TRIGGER" -ge 3 ]; then
    echo "  ✓ audit triggerlari: ${TRIGGER} ta"
else
    echo "  ✗ audit triggerlari tiklanmadi (${TRIGGER} ta)"
    XATOLAR=$((XATOLAR + 1))
fi

echo
if [ "$XATOLAR" -gt 0 ]; then
    xato "$XATOLAR ta muammo topildi — bu zaxiraga ISHONIB BOʻLMAYDI"
fi

xabar "zaxira toza: tiklandi va tekshirildi"
