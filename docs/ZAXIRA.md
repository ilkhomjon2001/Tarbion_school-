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
ochib oladi. Ya'ni zaxira hujumchining ishini osonlashtiradi.

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

# 4. Cron
15 3 * * *  /opt/tarbion/backend/scripts/backup.sh >> /var/log/tarbion-backup.log 2>&1
```

`backup-key.txt` ni serverdan **oʻchiring**. U yerda qolsa butun
sxemaning maʼnosi yoʻqoladi.

---

## Kundalik zaxira

`scripts/backup.sh` quyidagini qiladi:

```
pg_dump → gzip -9 → age --encrypt → /var/backups + R2
```

Quvurda `set -o pipefail` yoqilgan: har qanday qadam yiqilsa skript
toʻxtaydi. **Yarim yozilgan zaxira eng xavfli holat** — u "bor" boʻlib
koʻrinadi, lekin tiklab boʻlmaydi.

Skript yana:
- fayl 1 KB dan kichik boʻlsa xato beradi (boʻsh dump belgisi),
- 30 kundan eskilarini oʻchiradi,
- R2 sozlanmagan boʻlsa **ogohlantiradi** — bir joyda turgan zaxira
  X-12 talabini bajarmaydi.

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
tekshiruvni **odam**, `postgres` roli bilan ishga tushiradi. Bu ham
ataylab: maxfiy kalit serverda turmasligi kerak, ya'ni tekshiruvni
avtomatlashtirib boʻlmaydi.

Natijani jurnalga yozib boring:

| Sana | Zaxira | Natija | Kim |
|---|---|---|---|
| | | | |

---

## Falokat: haqiqiy tiklash

```bash
# 1. Ilovani toʻxtating — tiklash paytida yozuv kelmasin
systemctl stop tarbion-api tarbion-worker tarbion-bot

# 2. JORIY holatdan ham nusxa oling (tiklash notoʻgʻri chiqsa kerak boʻladi)
pg_dump "$DATABASE_URL" | gzip > /root/tiklashdan-oldin.sql.gz

# 3. Tiklang
age --decrypt -i ~/backup-key.txt tarbion-YYYYMMDD-HHMMSS.sql.gz.age \
  | gunzip \
  | psql "$DATABASE_URL" -v ON_ERROR_STOP=1

# 4. Migratsiyalarni tekshiring — zaxira eski boʻlishi mumkin
cd /opt/tarbion/backend && uv run alembic upgrade head

# 5. Koʻtaring
systemctl start tarbion-api tarbion-worker tarbion-bot
curl -s localhost:8000/health/ready
```

**Diqqat:** zaxira `pg_dump --clean` bilan olingan — u mavjud
jadvallarni **oʻchiradi**. 2-qadamni oʻtkazib yubormang.

---

## Sinovdan oʻtgan holat

Quvur haqiqiy baza ustida tekshirildi (2026-08-31):

```
dump → gzip → shifrlash → shifrni ochish → tiklash
natija: 385 users · 362 students · 778 lessons
        17581 attendance_records · 2781 grades
        audit triggerlari: 3 ta — tiklandi
```

`age` oʻrniga `gpg` bilan sinaldi (lokal muhitda `age` yoʻq edi);
quvurning mantiqi bir xil. **Serverda `age` bilan qayta sinash kerak**
— bu birinchi deploy'ning majburiy qadami.

---

## Hali qilinmagan

- **Zaxira olinmaganini aniqlash.** Hozir cron jimgina yiqilsa hech
  kim bilmaydi. Kerak: har muvaffaqiyatli zaxiradan keyin belgi
  qoʻyish va uni monitoring tekshirishi (yoki botga xabar).
- **Nuqtaviy tiklash (PITR).** Hozirgi sxemada eng koʻpi bilan bir
  kunlik maʼlumot yoʻqoladi. WAL arxivlash buni daqiqagacha
  tushirardi, lekin sozlash va saqlash hajmi ancha oshadi.
