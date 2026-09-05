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
#     FILE_STORAGE_DIR      — yuklangan fayllar papkasi (T-025).
#                             Sukut: <backend>/var/files — ilovaning
#                             sukuti bilan bir xil. Zaxiraga qoʻshiladi;
#                             boʻsh boʻlsa oʻtkazib yuboriladi, lekin
#                             bu logda yozib qoldiriladi
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
# Yuklangan fayllar alohida arxivda: baza tez tiklanadi, fayllar esa
# katta va kamdan-kam oʻzgaradi — ikkalasini bitta quvurga qoʻshish
# tiklashni sekinlashtirardi.
# Sukut ilovaning oʻz sukuti bilan bir xil boʻlishi SHART. Ilova
# `var/files` ni ishlatadi va u `WorkingDirectory` ga nisbatan
# hisoblanadi — yaʼni `<backend>/var/files`. Bu yerda boshqa yoʻl
# yozilsa zaxira jimgina boʻsh papkani koʻrib, «fayl yoʻq» deb
# oʻtib ketardi.
FILE_STORAGE_DIR="${FILE_STORAGE_DIR:-${BACKEND_DIR}/var/files}"
FAYL_NOM="tarbion-files-${SANA}.tar.gz.age"
FAYL_YOL="${BACKUP_DIR}/${FAYL_NOM}"

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

# ─────────────── Yuklangan fayllar (T-025, MET-03) ───────────────
#
# Fayl bazada emas, diskda yotadi (CLAUDE.md 10-qoida). Demak faqat
# `pg_dump` olingan zaxira TOʻLIQ EMAS: baza tiklanadi, lekin dars
# kartochkasidagi ilova va ariza fayli yoʻqoladi.
#
# Papka boʻsh boʻlishi normal (hali fayl yuklanmagan) — bu holda
# arxiv yasalmaydi, lekin logda iz qoladi.

FAYL_ARXIVI=""
if [ -d "$FILE_STORAGE_DIR" ] && [ -n "$(ls -A "$FILE_STORAGE_DIR" 2>/dev/null)" ]; then
    tar -czf - -C "$FILE_STORAGE_DIR" . | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$FAYL_YOL"
    chmod 600 "$FAYL_YOL"
    FAYL_ARXIVI="$FAYL_YOL"
    xabar "fayllar shifrlandi: $(du -h "$FAYL_YOL" | cut -f1) ($FILE_STORAGE_DIR)"
else
    xabar "yuklangan fayl yoʻq — fayl arxivi oʻtkazib yuborildi ($FILE_STORAGE_DIR)"
fi

# ─────────────────── Boshqa joyga nusxa (X-12) ───────────────────
#
# Zaxira faqat oʻzi himoya qilayotgan mashinada tursa — u zaxira emas.
# Shu sababli bu yerdagi xatolik BUTUN ISHNI yiqitadi: lokal fayl
# yozilgan boʻlsa ham, tashqi nusxasiz zaxira toʻliq hisoblanmaydi va
# `OnFailure` ogohlantirishi ishga tushishi kerak.
#
# Ikkala manzil ham qoʻllanadi: qaysi biri sozlangan boʻlsa, oʻsha.

NUSXA=0

if [ -n "${R2_BUCKET:-}" ] && command -v aws >/dev/null; then
    xabar "R2 ga yuklanmoqda"
    aws s3 cp "$YOL" "s3://${R2_BUCKET}/backups/${NOM}" \
        --endpoint-url "${R2_ENDPOINT}" \
        --only-show-errors
    xabar "R2 ga yuklandi"
    NUSXA=$((NUSXA + 1))
fi

# Telegram — fayl allaqachon shifrlangan, ochish kaliti esa na serverda,
# na Telegramda. Yaʼni bu yerga ketayotgan narsa hech kim oʻqiy
# olmaydigan bayt. Bot 50 MB gacha hujjat yuboradi; bizniki ~1 MB.
if [ -n "${BACKUP_TELEGRAM_CHAT_ID:-}" ] && [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
    xabar "Telegramga yuborilmoqda"
    IZOH="Tarbion zaxira · $(TZ=Asia/Tashkent date '+%Y-%m-%d %H:%M') (Toshkent) · ${OLCHAM}
Shifrlangan (age). Ochish uchun maxfiy kalit kerak."

    JAVOB="$(curl --silent --show-error --max-time 180 \
        --form "chat_id=${BACKUP_TELEGRAM_CHAT_ID}" \
        --form "document=@${YOL}" \
        --form "caption=${IZOH}" \
        "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" || true)"

    # Telegram xatoni ham `200` bilan qaytarishi mumkin — javob ichidagi
    # `"ok":true` ni tekshirish shart. HTTP kodiga ishonib boʻlmaydi.
    if printf '%s' "$JAVOB" | grep -q '"ok":true'; then
        xabar "Telegramga yuborildi"
        NUSXA=$((NUSXA + 1))

        # Fayl arxivi — alohida hujjat. Bot 50 MB gacha yuboradi;
        # undan kattasi Telegramga sigʻmaydi va bu YIQITADI, chunki
        # jimgina oʻtib ketsa fayllar bir joyda qolib ketardi (X-12).
        if [ -n "$FAYL_ARXIVI" ]; then
            F_JAVOB="$(curl --silent --show-error --max-time 600                 --form "chat_id=${BACKUP_TELEGRAM_CHAT_ID}"                 --form "document=@${FAYL_ARXIVI}"                 --form "caption=Tarbion yuklangan fayllar · $(TZ=Asia/Tashkent date '+%Y-%m-%d %H:%M')"                 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" || true)"
            printf '%s' "$F_JAVOB" | grep -q '"ok":true'                 || xato "fayl arxivini Telegramga yuborib boʻlmadi: $(printf '%s' "$F_JAVOB" | head -c 300)"
            xabar "fayl arxivi Telegramga yuborildi"
        fi
    else
        # Javobda token yoʻq (u URL da edi), lekin chat_id boʻlishi
        # mumkin — u maxfiy emas. Xato matni kerak: «yuborilmadi»
        # oʻzi sababni aytmaydi.
        xato "Telegramga yuborib boʻlmadi: $(printf '%s' "$JAVOB" | head -c 300)"
    fi
fi

if [ "$NUSXA" -eq 0 ]; then
    xato "zaxira FAQAT shu serverda — boshqa joy sozlanmagan (X-12).
     Kerak: BACKUP_TELEGRAM_CHAT_ID yoki R2_BUCKET/R2_ENDPOINT.
     Lokal fayl yozildi: $YOL"
fi

# ─────────────────────── Eskilarini tozalash ───────────────────────

find "$BACKUP_DIR" -name 'tarbion-*.sql.gz.age' -mtime "+${BACKUP_KEEP_DAYS}" -delete
find "$BACKUP_DIR" -name 'tarbion-files-*.tar.gz.age' -mtime "+${BACKUP_KEEP_DAYS}" -delete
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
