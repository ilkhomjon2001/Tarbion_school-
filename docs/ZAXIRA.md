# Zaxira nusxa va tiklash

**X-12: zaxira shifrlanadi va boshqa joyda saqlanadi. Tiklab
koʻrilmagan zaxira — zaxira emas.**

Bu hujjat ikkita savolga javob beradi: zaxira qanday olinadi va
falokat paytida undan qanday tiklanadi.

---

## Nega ochiq kalitli shifrlash

Oddiy yoʻl — arxivni parol bilan shifrlash. Lekin unda parol
serverning oʻzida (cron skriptida yoki `.env` da) turadi. Serverni
buzib kirgan odam avval ishchi bazani, keyin **butun zaxira tarixini**
ochib oladi. Yaʼni zaxira hujumchining ishini osonlashtiradi.

Shu sababli `age` ning **ochiq kalitli** rejimi ishlatiladi:

| Kalit | Qayerda turadi | Nima qila oladi |
|---|---|---|
| Ochiq (`age1...`) | serverda, `.env` da | faqat **shifrlash** |
| Maxfiy (`AGE-SECRET-KEY-...`) | serverdan TASHQARIDA | shifrni **ochish** |

Server buzib kirilsa ham hujumchi eski zaxiralarni ocha olmaydi.

Maxfiy kalit qayerda saqlanadi:
- direktorning parol menejerida (1Password, Bitwarden),
- qogʻozga chop etilib seyfda,
- ikkalasida ham — kalit yoʻqolsa zaxira ham yoʻqoladi.

### Kalitni kim ushlab turadi

**2026-09-03 dan boshlab maxfiy kalit loyiha egasida (Ilhomjon).**
Serverda yoʻq, repoda yoʻq, jamoaning ikkinchi aʼzosida yoʻq.

Kalit kerak boʻlsa (haqiqiy tiklash yoki oylik `restore_check.sh`) —
undan soʻraladi. **Yangi kalit yasab, eskisining oʻrniga qoʻyish
mumkin emas:** eski zaxiralar oʻsha eski kalit bilan shifrlangan va
kalit almashsa ular butunlay ochilmaydigan boʻlib qoladi. Bu qaytarib
boʻlmaydigan xato — shuning uchun `TEAMWORK.md` da ham yozib qoʻyilgan.

---

## Bir martalik sozlash

```bash
# 1. Kalit juftini yasang (SERVERDA EMAS — oʻz kompyuteringizda)
age-keygen -o backup-key.txt

# Fayl ichida:
#   # public key: age1qy8...        ← bu serverga
#   AGE-SECRET-KEY-1XYZ...          ← bu SEYFGA

# 2. Ochiq kalitni serverdagi .env ga yozing
BACKUP_AGE_RECIPIENT=age1qy8...
BACKUP_DIR=/var/backups/tarbion
BACKUP_KEEP_DAYS=30

# 3. Serverda `age` va `aws` (R2 uchun) oʻrnating
apt install age awscli

# 4. Xizmat va taymer
cp deploy/tarbion-backup.service deploy/tarbion-backup.timer \
   deploy/tarbion-backup-alert.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tarbion-backup.timer
```

Cron emas, `systemd` taymeri — sababi uchta: server oʻchiq boʻlgan
paytdagi ish `Persistent=true` bilan oʻtkazib yuborilmaydi, jurnal
`journalctl -u tarbion-backup` da boshqa xizmatlar bilan bir joyda
boʻladi, va eng muhimi — `OnFailure=` orqali **yiqilish jimgina
oʻtmaydi** (pastda).

`backup-key.txt` ni serverdan **oʻchiring**. U yerda qolsa butun
sxemaning maʼnosi yoʻqoladi.

---

## Kundalik zaxira

`scripts/backup.sh` quyidagini qiladi:

```
pg_dump → gzip -9 → age --encrypt → /var/backups + BOSHQA JOY
```

«Boshqa joy» — Telegram yoki R2 (yoki ikkalasi). **Kamida bittasi
sozlangan boʻlishi shart:** ikkalasi ham boʻsh boʻlsa skript ataylab
yiqiladi. Faqat oʻzi himoya qilayotgan mashinada turgan zaxira —
zaxira emas, va bu holat jimgina oʻtmasligi kerak.

Quvurda `set -o pipefail` yoqilgan: har qanday qadam yiqilsa skript
toʻxtaydi. **Yarim yozilgan zaxira eng xavfli holat** — u "bor" boʻlib
koʻrinadi, lekin tiklab boʻlmaydi.

Skript yana:
- fayl 1 KB dan kichik boʻlsa xato beradi (boʻsh dump belgisi),
- lokal papkada 30 kundan eskilarini oʻchiradi.

### Nega Telegram

Odatda zaxira obyekt xotirasiga (R2, S3) yuklanadi. Bu yerda Telegram
tanlandi va sabablari aniq:

- **Fayl allaqachon shifrlangan**, ochish kaliti esa na serverda, na
  Telegramda. Yaʼni u yerga ketayotgan narsa — hech kim oʻqiy
  olmaydigan bayt. Saqlovchiga ishonish talabi yoʻqoladi.
- Bot allaqachon ishlaydi (T-017). **Yangi hisob, karta yoki
  kredensial kerak emas** — bu esa «keyinroq sozlaymiz» degan
  kechikishni yoʻq qiladi. Ishlamayotgan mukammal rejadan koʻra
  bugun ishlaydigan nusxa yaxshiroq.
- Bot 50 MB gacha hujjat yuboradi; zaxira ~1 MB. Oʻquvchilar soni
  oʻn barobar oshsa ham chegara yaqin emas.

Kamchiligi ham bor: bu saqlash xizmati emas. Eski xabarlar avtomatik
oʻchmaydi (lokal papkadan farqli), va Telegram hisobi yoʻqolsa nusxa
ham yoʻqoladi. Shu sababli u lokal nusxa va R2 ning **oʻrnini
bosmaydi** — ular bilan yonma-yon turadi.

Sozlash:

```
BACKUP_TELEGRAM_CHAT_ID=123456789
```

Bir necha odam koʻrishi kerak boʻlsa — yopiq guruh ochib, botni aʼzo
qilib, guruh id sini qoʻying (manfiy son).

**Tekshirilgan (2026-09-03):** fayl yuborildi → `getFile` orqali
qaytarib olindi → `sha256` lokal nusxa bilan **bir xil** chiqdi.
Telegram hujjatni oʻzgartirmaydi.

---

## Tekshirish — oyiga bir marta

```bash
./scripts/restore_check.sh /var/backups/tarbion/tarbion-20260901-031500.sql.gz.age ~/backup-key.txt
```

Skript zaxirani **vaqtinchalik bazaga** tiklaydi, jadval sanoqlarini
tekshiradi va bazani oʻchiradi. Ishchi bazaga tegmaydi.

Nima tekshiriladi:
- `users`, `roles`, `students`, `classes`, `lessons`,
  `attendance_records` jadvallari **mavjud va boʻsh emas**,
- `audit_log` triggerlari tiklangan — ularsiz tiklangan bazada
  jurnalni oʻchirib boʻlardi (T-021).

Faqat "xatosiz tiklandi" degani yetarli emas: **boʻsh baza ham xatosiz
tiklanadi**.

### Muhim: kim ishga tushiradi

Tekshiruv skripti vaqtinchalik baza yaratadi, ilova roli esa
`CREATE DATABASE` qila olmaydi (X-11 — bu ataylab). Shuning uchun
skript ilovaning `DATABASE_URL` ini **ishlatmaydi**, administrator
ulanishini oladi:

- serverda — `sudo -u postgres` (peer auth, parolsiz), sukut boʻyicha;
- masofadan — `RESTORE_ADMIN_URL=postgresql://...` beriladi.

Bu ham ataylab: maxfiy kalit serverda turmasligi kerak, yaʼni
tekshiruvni avtomatlashtirib boʻlmaydi — uni **odam** oyiga bir marta
ishga tushiradi.

Natijani jurnalga yozib boring:

| Sana | Zaxira | Natija | Kim |
|---|---|---|---|
| 2026-09-03 | `tarbion-20260903-053929` | ✅ toza — 214 users · 98 students · 10816 lessons · 9982 audit_log · 3 trigger · `bf3e5898befd` | Claude (serverda, `age` bilan) |

---

## Falokat: haqiqiy tiklash

```bash
# 1. Ilovani toʻxtating — tiklash paytida yozuv kelmasin.
#    Xabarnoma worker'i va bot ham: ular tiklash oʻrtasida yarim
#    tiklangan bazadan oʻqib, ota-onaga notoʻgʻri xabar yuborardi.
systemctl stop tarbion-api tarbion-web tarbion-bot tarbion-outbox
systemctl stop tarbion-backup.timer tarbion-daily-summary.timer

# 2. JORIY holatdan ham nusxa oling (tiklash notoʻgʻri chiqsa kerak boʻladi)
pg_dump "$DATABASE_URL" | gzip > /root/tiklashdan-oldin.sql.gz

# 3. Tiklang
age --decrypt -i ~/backup-key.txt tarbion-YYYYMMDD-HHMMSS.sql.gz.age \
  | gunzip \
  | psql "$DATABASE_URL" -v ON_ERROR_STOP=1

# 4. Migratsiyalarni tekshiring — zaxira eski boʻlishi mumkin
cd /opt/tarbion/backend && uv run alembic upgrade head

# 5. Koʻtaring
systemctl start tarbion-api tarbion-web tarbion-bot tarbion-outbox
systemctl start tarbion-backup.timer tarbion-daily-summary.timer

# API Docker shlyuzida tinglaydi, `localhost` da emas:
curl -s http://172.18.0.1:8300/health/ready     # {"status":"ok","database":true}
```

Tiklangandan keyin **zaxirani darhol qayta oling** — endi ishchi baza
tiklangan nusxadan iborat, va oldingi zaxiralar boshqa tarixga tegishli:

```bash
systemctl start tarbion-backup.service
```

**Diqqat:** zaxira `pg_dump --clean` bilan olingan — u mavjud
jadvallarni **oʻchiradi**. 2-qadamni oʻtkazib yubormang.

---

## Zaxira olinmasa — kim biladi

Jimgina yiqilgan zaxira eng yomon holat: hamma «zaxira bor» deb
oʻylab yuradi, falokat kuni esa hech narsa yoʻqligi maʼlum boʻladi.

`tarbion-backup.service` da `OnFailure=tarbion-backup-alert.service`.
Skript administratorga Telegram orqali yozadi va xabarda **oxirgi
muvaffaqiyatli zaxira qachon boʻlgani** koʻrsatiladi — «zaxira
yiqildi» oʻzi kam maʼlumot beradi, «oxirgi zaxira 26 kun oldin» esa
vaziyatning ogʻirligini darhol koʻrsatadi.

Sana `backup.sh` skript **oxirigacha yetgandagina** yozadigan
`.oxirgi-muvaffaqiyat` faylidan olinadi — boshlangan, lekin uzilib
qolgan zaxira muvaffaqiyat deb hisoblanmaydi.

Sozlash:

```
BACKUP_ALERT_CHAT_ID=123456789   # administratorning Telegram id si
```

Berilmasa skript jurnalga yozadi va ochiq aytadi: «zaxira yiqilgani
HECH KIMGA yetkazilmadi».

**Kimga borishini oʻzgartirish** — serverdagi `.env` da shu qatorni
tahrirlash yetarli, qayta ishga tushirish shart emas: xizmat
`oneshot`, har safar `.env` ni yangidan oʻqiydi.

```bash
sed -i 's|^BACKUP_ALERT_CHAT_ID=.*|BACKUP_ALERT_CHAT_ID=YANGI_ID|' \
    /opt/tarbion/backend/.env
systemctl start tarbion-backup-alert.service   # sinov xabari
```

Oʻz id ingizni `@userinfobot` beradi. Bir nechta odamga kerak boʻlsa —
maxsus yopiq guruh ochib, botni aʼzo qilib, guruh id sini qoʻyish
mumkin (guruh id si manfiy son boʻladi).

Hozir: **loyiha egasi** (2026-09-03). Rahbar hisobiga oʻtkazilishi
rejalashtirilgan.

### Nega ogohlantirish outbox orqali ketmaydi

Loyihada xabar yuborishning toʻgʻri yoʻli — `notification_outbox`
(T-018). Bu yerda u **ataylab** ishlatilmagan: zaxira yiqilishining eng
ehtimolli sababi — PostgreSQL ishlamayotgani. Bazaga yozadigan
ogohlantirish aynan kerak boʻlgan paytda jim qolardi. Shuning uchun
Telegram API ga toʻgʻridan-toʻgʻri murojaat qilinadi.

---

## Sinovdan oʻtgan holat

**2026-09-03, ishlab chiqarish serverida, haqiqiy `age` kaliti bilan:**

```
pg_dump → gzip -9 → age --encrypt        868 KB (7.7 MB dump dan)
age --decrypt → gunzip → psql            vaqtinchalik bazaga tiklandi

  ✓ users: 214          ✓ classes: 8
  ✓ roles: 8            ✓ lessons: 10816
  ✓ students: 98        ✓ attendance_records: 37
  ✓ audit_log: 9982     ✓ audit triggerlari: 3 ta
  ✓ alembic versiyasi: bf3e5898befd
```

Yiqilish yoʻli ham sinaldi: `ExecStart` ataylab buzildi →
`tarbion-backup.service` `failed` holatiga oʻtdi →
`tarbion-backup-alert.service` ishga tushdi va xabar tuzdi.

Avvalgi (2026-08-31) sinov lokal muhitda `gpg` bilan qilingan edi —
u endi ahamiyatsiz, chunki quvur haqiqiy vositalar bilan qayta
tekshirildi.

---

## Hali qilinmagan

- **Uchinchi nusxa (R2).** Hozir ikkita: lokal papka va Telegram.
  `backup.sh` R2 ga yuklashga tayyor — faqat `R2_BUCKET`,
  `R2_ENDPOINT` va AWS kalitlari kerak. Yuklanadigan narsa
  shifrlangan fayl, ochish kaliti esa hech qaysi saqlovchida yoʻq;
  shu sababli maʼlumot joylashuvi masalasi (CLAUDE.md) bu yerda
  koʻtarilmaydi.
- **Telegramdagi eski nusxalarni tozalash.** Lokal papka 30 kundan
  eskilarini oʻzi oʻchiradi, Telegram esa hammasini saqlaydi. Hajm
  kichik (~1 MB/kun), lekin bir yildan keyin chat uzun boʻlib ketadi.
- **Nuqtaviy tiklash (PITR).** Hozirgi sxemada eng koʻpi bilan bir
  kunlik maʼlumot yoʻqoladi. WAL arxivlash buni daqiqagacha
  tushirardi, lekin sozlash va saqlash hajmi ancha oshadi.
