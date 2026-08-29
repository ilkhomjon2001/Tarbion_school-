# TASKS — Tarbion platformasi

Ishni shu fayldan ol. **Bir vaqtda bitta task.** Tugagach katakchani belgila va
commit qil.

Har bir taskda:
- **TZ** — texnik topshiriqdagi talab kodlari (`docs/TZ.pdf` da qidir)
- **Kerak** — oldin bajarilishi shart bo'lgan tasklar
- **Tayyor** — qabul mezonlari. Hammasi bajarilmaguncha task yopilmaydi.

Belgilar: `[ ]` boshlanmagan · `[~]` ishda · `[x]` tugagan

---

# 1-BOSQICH — Asos, davomat, ota-ona kabineti (1–4 hafta)

Maqsad: 4-hafta oxirida ustoz davomat belgilaydi, ota-ona telefonida ko'radi va
farzandi kelmasa Telegram'ga xabar keladi.

---

## Infratuzilma

### [ ] T-001 · Repo va muhit
**TZ:** —
**Kerak:** —

Monorepo skeletini yarat: `backend/`, `frontend/`, `bot/`, `docs/`.
Backend — FastAPI + uv, `app/main.py` da `/health` endpoint. Frontend — Next.js 15
+ TypeScript + Tailwind v4. `docker-compose.yml` da faqat PostgreSQL 16.
`.env.example`, `.gitignore`, `README.md` (ishga tushirish buyruqlari).

**Tayyor:**
- [ ] `docker compose up -d` bilan Postgres ko'tariladi
- [ ] `uvicorn app.main:app --reload` → `GET /health` `{"status":"ok"}` qaytaradi
- [ ] `pnpm dev` → Next.js bosh sahifasi ochiladi
- [ ] `.env.example` da barcha kerakli kalitlar bor, haqiqiy sekret yo'q

---

### [ ] T-002 · Baza ulanishi va migratsiya tizimi
**TZ:** —
**Kerak:** T-001

SQLAlchemy 2.0 async engine + session dependency. Alembic sozlanadi.
`Base` klassida umumiy maydonlar: `id` (UUID), `created_at`, `updated_at`,
`is_archived`. Barcha modellar shundan meros oladi (CLAUDE.md 1-qoida).

**Tayyor:**
- [ ] `alembic upgrade head` xatosiz ishlaydi
- [ ] `alembic revision --autogenerate` model o'zgarishini ko'radi
- [ ] Test uchun alohida baza va `pytest` fixture'lari tayyor

---

## Ma'lumot modeli va autentifikatsiya

### [ ] T-003 · Foydalanuvchi va rol modellari
**TZ:** AUT-04, AUT-07
**Kerak:** T-002

`users` (telefon, parol hash, F.I.Sh., holat), `roles`, `user_roles`.
Bir foydalanuvchi bir nechta rolga ega bo'la oladi. Parol `argon2` bilan
xeshlanadi (`passlib`).

Rollar: `student`, `parent`, `teacher`, `homeroom_teacher`, `admin`, `director`, `superadmin`.

**Tayyor:**
- [ ] Migratsiya yozilgan, rollar seed qilingan
- [ ] Parol hech qayerda ochiq saqlanmaydi va API javobida chiqmaydi
- [ ] Foydalanuvchini arxivlash mumkin, o'chirish endpoint'i yo'q

---

### [ ] T-004 · Login, JWT, sessiya
**TZ:** AUT-01, AUT-05, AUT-06, AUT-08
**Kerak:** T-003

Telefon + parol bilan kirish. Access token 15 daqiqa (JSON javobda),
refresh token 30 kun (`httpOnly`, `Secure`, `SameSite=Lax` cookie).
5 marta noto'g'ri urinishdan keyin hisob 15 daqiqaga bloklanadi (`login_attempts`
jadvali). Har kirish `login_log` ga yoziladi: sana, IP, user-agent.

**Tayyor:**
- [ ] `POST /api/v1/auth/login`, `/refresh`, `/logout`, `/me` ishlaydi
- [ ] Test: 5 xato urinish → 6-si `423 Locked`
- [ ] Test: muddati o'tgan access token `401` beradi, refresh yangilaydi
- [ ] Parolni o'zgartirish endpoint'i eski parolni so'raydi

---

### [ ] T-005 · Rolga asoslangan kirish nazorati
**TZ:** NFR-08, 6-domen qoidasi
**Kerak:** T-004

`require_roles("teacher", "admin")` ko'rinishidagi dependency.
Alohida: `get_accessible_student_ids(user)` — vasiy uchun faqat o'z farzandlari,
ustoz uchun o'z sinflari, direktor va admin uchun hammasi. **Barcha o'quvchi
bo'yicha so'rovlar shu funksiyadan o'tadi.**

**Tayyor:**
- [ ] Har bir himoyalangan endpoint'da rol tekshiruvi bor
- [ ] Test: A ota-ona B o'quvchining ma'lumotini so'raydi → `403`
- [ ] Test: ustoz o'zi dars bermaydigan sinf davomatini o'zgartira olmaydi

---

### [ ] T-006 · Parolni tiklash
**TZ:** AUT-02
**Kerak:** T-004, T-017

Telefon raqami bo'yicha bir martalik kod (6 raqam, 10 daqiqa) Telegram orqali
yuboriladi. Bot ulanmagan bo'lsa — administrator qo'lda tiklaydi.

**Tayyor:**
- [ ] Kod bir marta ishlaydi, ikkinchi urinishda bekor
- [ ] Kod so'rovi bir raqam uchun 3 daqiqada 1 marta (rate limit)
- [ ] Test: eski kod bilan tiklash `400`

---

## Ma'muriy yadro

### [ ] T-007 · O'quv yili, choraklar, qo'ng'iroqlar jadvali
**TZ:** ADM-01, ADM-07
**Kerak:** T-005

`academic_years` (boshlanish, tugash, joriy), `terms` (chorak, sanalar),
`holidays`, `bell_schedule` (para raqami, boshlanish, tugash vaqti).
Admin CRUD + frontend sahifasi.

**Tayyor:**
- [ ] Choraklar sanasi bir-birini qoplamaydi (validatsiya)
- [ ] Faqat bitta o'quv yili "joriy" bo'la oladi
- [ ] Admin sahifasida CRUD ishlaydi

---

### [ ] T-008 · Sinflar, fanlar, xodimlar
**TZ:** ADM-02, ADM-03, ADM-04
**Kerak:** T-007

`classes` (nomi, o'quv yili, sinf rahbari), `subjects`,
`class_subjects` (sinf + fan + haftalik soat), `teacher_subjects`.
Xodim yaratilganda `users` yozuvi va tegishli rol beriladi.

**Tayyor:**
- [ ] Sinf rahbari biriktirilganda unga `homeroom_teacher` roli qo'shiladi
- [ ] Bir sinfda bir fan bir marta (unique constraint)
- [ ] Admin sahifalarida CRUD ishlaydi

---

### [ ] T-009 · O'quvchilar va vasiylar
**TZ:** ADM-05, ADM-06, ADM-11
**Kerak:** T-008

`students` (F.I.Sh., tug'ilgan sana, sinf, holati), `guardians` — o'quvchi va
`users` orasidagi bog'lanish (`relation`: ota / ona / vasiy, `is_primary`).
Bir o'quvchida bir nechta vasiy, bir vasiyda bir nechta farzand.

Amallar: boshqa sinfga ko'chirish, arxivga o'tkazish (o'chirish emas).

**Tayyor:**
- [ ] Vasiy qo'shilganda unga `parent` roli va hisob yaratiladi
- [ ] Arxivlangan o'quvchi ro'yxatlarda ko'rinmaydi, hisobotlarda qoladi
- [ ] Sinfni o'zgartirish tarixi saqlanadi

---

### [ ] T-010 · Excel'dan o'quvchilarni import
**TZ:** ADM-05
**Kerak:** T-009

Shablon fayl (`docs/import-template.xlsx`) generatsiyasi + yuklash.
Import ikki qadamda: **avval tekshiruv** (xatoliklar jadvali qaytadi), keyin
tasdiqlash va yozish. Qisman import qilinmaydi — hammasi yoki hech nima.

**Tayyor:**
- [ ] Shablonni yuklab olish tugmasi ishlaydi
- [ ] Xato qatorlar raqami va sababi bilan ko'rsatiladi
- [ ] Takroriy o'quvchi (bir xil F.I.Sh. + tug'ilgan sana) aniqlanadi
- [ ] Test: 100 qatorli fayl 5 soniyada qayta ishlanadi

---

### [ ] T-011 · Dars jadvali
**TZ:** ADM-08, ADM-09
**Kerak:** T-008

`schedule_entries` (sinf, fan, ustoz, hafta kuni, para, xona).
**To'qnashuv nazorati:** bitta ustoz yoki xona bir vaqtda ikki joyda band bo'la
olmaydi — saqlashda tekshiriladi va aniq xato matni qaytariladi.

Frontend: haftalik grid ko'rinish, sinf yoki ustoz bo'yicha filtr.

**Tayyor:**
- [ ] Test: band ustozni qo'shishga urinish → `409` va qaysi sinf bilan to'qnashgani
- [ ] Jadval sinf va ustoz kesimida ko'rinadi
- [ ] Mobil ekranda jadval o'qish mumkin (gorizontal scroll yoki kun bo'yicha)

---

### [ ] T-012 · Darslarni generatsiya qilish
**TZ:** ADM-08 (hosila)
**Kerak:** T-011

`lessons` — jadval asosida konkret sanaga yaratiladigan yozuv (sinf, fan, ustoz,
sana, para). Davomat va baho **darsga** bog'lanadi, jadvalga emas.
Chorak boshlanganda avtomatik generatsiya, ta'til kunlari o'tkazib yuboriladi.

**Tayyor:**
- [ ] Chorak uchun darslar bir marta generatsiya qilinadi (idempotent)
- [ ] Ta'til va dam olish kunlarida dars yaratilmaydi
- [ ] Test: jadval o'zgarsa, o'tgan darslar o'zgarmaydi

---

## Davomat

### [ ] T-013 · Davomat modeli va API
**TZ:** DAV-01, DAV-03, DAV-06, DAV-07
**Kerak:** T-012

`attendance_records` (dars, o'quvchi, holat, izoh, kim belgiladi, qachon).
Holatlar: `present`, `absent`, `excused`, `late`.

Qoidalar:
- ustoz o'z darsini 24 soat ichida tahrirlaydi, keyin `403`
- administrator har doim o'zgartira oladi
- har o'zgarish `audit_log` ga tushadi

**Tayyor:**
- [ ] `POST /lessons/{id}/attendance` — butun sinf bir so'rovda
- [ ] Test: 25 soatdan keyin ustoz o'zgartira olmaydi, admin oladi
- [ ] Test: har o'zgarish audit'ga eski va yangi qiymat bilan yoziladi
- [ ] Davomat foizi endpoint'i: o'quvchi / sinf / fan / ustoz kesimida

---

### [ ] T-014 · Ustoz davomat ekrani
**TZ:** DAV-01
**Kerak:** T-013

Ustoz bosh sahifasi: bugungi darslari ro'yxati, har birida "Davomat belgilash".
Davomat ekrani — o'quvchilar ro'yxati, har birida 4 ta holat tugmasi.
Sukut bo'yicha hamma "keldi". Bir bosishda saqlanadi.

**Tayyor:**
- [ ] Mobilda (360px) barmoq bilan qulay ishlaydi, tugma ≥44px
- [ ] Saqlanmagan o'zgarish bo'lsa, sahifadan chiqishda ogohlantiradi
- [ ] Loading va error holatlari bor
- [ ] 24 soat o'tgan dars faqat o'qish rejimida ochiladi, sababi ko'rsatiladi

---

### [ ] T-015 · Sinf rahbari kunlik davomat ekrani
**TZ:** DAV-02
**Kerak:** T-013

Bitta ekranda butun sinfning kunlik davomati: qatorlar — o'quvchilar,
ustunlar — paralar. Tez to'ldirish uchun.

**Tayyor:**
- [ ] Bir kunlik butun sinf bitta so'rovda yuklanadi
- [ ] Kelmagan o'quvchilar vizual ajratilgan
- [ ] Sana bo'yicha oldinga/orqaga yurish

---

## Ota-ona kabineti va bot

### [ ] T-016 · Ota-ona kabineti — bosh sahifa va davomat
**TZ:** OTA-01, OTA-02, OTA-03, OTA-08
**Kerak:** T-013, T-005

Bosh sahifa: bugungi davomat, so'nggi e'lonlar. Bir nechta farzand bo'lsa —
yuqorida farzand almashtirgich.
Davomat sahifasi: oylik kalendar, sababli/sababsiz ranglar bilan ajratilgan,
pastda oylik foiz.

**Tayyor:**
- [ ] Mobil-birinchi, 360px da to'liq ishlaydi
- [ ] Bo'sh holat matnlari bor ("Bugun dars yo'q" va h.k.)
- [ ] Test: boshqa oilaning ma'lumotiga URL orqali kirib bo'lmaydi

---

### [ ] T-017 · Telegram bot: ulanish
**TZ:** BOT-01
**Kerak:** T-004

aiogram 3. `/start` → telefon raqamini so'raydi (contact tugmasi) →
bazadagi vasiy bilan solishtiradi → tasdiq kodi → `telegram_id` saqlanadi.
Raqam topilmasa aniq xabar: maktabga murojaat qilish kerakligi.

**Tayyor:**
- [ ] Ulangan foydalanuvchi `/start` bosса qayta ro'yxatdan o'tmaydi
- [ ] Bir telegram akkaunt bitta vasiyga bog'lanadi
- [ ] Uzish (`/uzish`) buyrug'i bor

---

### [ ] T-018 · Xabarnoma yadrosi (outbox + worker)
**TZ:** BOT-02, BOT-06, BOT-07
**Kerak:** T-017

`notification_outbox` (turi, qabul qiluvchi, kanal, matn, holati, urinishlar soni,
xato matni). Kod xabarni **to'g'ridan-to'g'ri yubormaydi** — outbox'ga yozadi.
Alohida worker sikli yuboradi, xatoda 3 marta qayta uriniladi (backoff bilan).

`notification_preferences` — foydalanuvchi qaysi turlarni olishini tanlaydi.

**Tayyor:**
- [ ] Telegram tushib qolsa xabar yo'qolmaydi, navbatda qoladi
- [ ] Yetkazilmagan xabarlar admin panelida ko'rinadi va qayta yuborish mumkin
- [ ] Bir foydalanuvchiga bir turdagi xabar kuniga bir marta jamlanadi (BOT-07)

---

### [ ] T-019 · Davomat xabarnomalari
**TZ:** DAV-05, Ilova B (1-bosqich qatorlari)
**Kerak:** T-018, T-013

- "Farzand darsga kelmadi" — davomat belgilangach 30 daqiqada (vaqt sozlanadi)
- "Kunlik davomat xulosasi" — darslar tugagach
- "Tizimga kirish ma'lumotlari" — hisob yaratilganda

Matnlar shablon jadvalida, o'rin egallovchi maydonlar bilan (`{student_name}` va h.k.).

**Tayyor:**
- [ ] Kechikish vaqti admin sozlamasidan o'zgaradi
- [ ] Davomat keyin tuzatilsa, yuborilmagan xabar bekor qilinadi
- [ ] Shablonni admin tahrirlay oladi

---

### [ ] T-020 · E'lonlar va ommaviy yuborish
**TZ:** ADM-12, BOT-04
**Kerak:** T-018

`announcements` (sarlavha, matn, fayl, auditoriya: butun maktab / sinf / rol).
Admin e'lon chop etadi → tegishli foydalanuvchilarga outbox orqali yuboriladi.

**Tayyor:**
- [ ] Auditoriya tanlanadi va yuborishdan oldin qabul qiluvchilar soni ko'rsatiladi
- [ ] E'lon kabinetlarda ham ko'rinadi (faqat Telegram emas)

---

## Yopish

### [ ] T-021 · Audit jurnali
**TZ:** NFR-10, DAV-07
**Kerak:** T-013

`audit_log` (obyekt turi, obyekt id, amal, eski qiymat JSON, yangi qiymat JSON,
foydalanuvchi, vaqt, IP). Yozuvlar o'zgartirilmaydi.
Admin uchun ko'rish sahifasi: filtr — obyekt turi, foydalanuvchi, sana.

**Tayyor:**
- [ ] Davomat va foydalanuvchi o'zgarishlari tushayapti
- [ ] Audit yozuvini o'zgartiruvchi/o'chiruvchi endpoint yo'q

---

### [ ] T-022 · Zaxira nusxa va deploy
**TZ:** NFR-07, NFR-09, NFR-12
**Kerak:** T-001

VPS: Nginx + HTTPS (Let's Encrypt), systemd birliklari (api, worker, bot).
Har kunlik `pg_dump` → siqish → R2 ga yuklash, 30 kun saqlash.
Tiklash skripti va uni sinovdan o'tkazish yo'riqnomasi.

**Tayyor:**
- [ ] HTTP → HTTPS yo'naltiriladi
- [ ] Xizmatlar qayta ishga tushirilganda avtomatik ko'tariladi
- [ ] Zaxiradan tiklash **amalda** sinovdan o'tkazilgan va hujjatlashtirilgan

---

### [ ] T-023 · 1-bosqich qabuliga tayyorlash
**TZ:** 9-bo'lim
**Kerak:** T-001…T-022

Bajarilgan talab kodlari ro'yxati (TZ bo'yicha), qisqa foydalanuvchi
yo'riqnomasi (ustoz uchun 1 sahifa, ota-ona uchun 1 sahifa), demo ma'lumotlari
bilan sinov muhiti.

**Tayyor:**
- [ ] AUT, ADM, DAV modullarining 1-bosqich talablari yopilgan
- [ ] Playwright: login → davomat belgilash → ota-ona ko'radi oqimi o'tadi
- [ ] Yo'riqnomalar `docs/` da

---

# 2-BOSQICH — Metodik baza, jurnal, uy vazifasi (5–10 hafta)

Batafsil tavsiflar 1-bosqich qabulidan keyin yoziladi. Hozircha doira:

- [ ] T-024 · Metodik baza ierarxiyasi va dars kartochkasi — MET-01, MET-02
- [ ] T-025 · R2 fayl yuklash va presigned URL — MET-03, NFR-11
- [ ] T-026 · Metodik bazada qidiruv va filtr — MET-05
- [ ] T-027 · Reja tasdiqlash oqimi va versiyalar — MET-06, MET-07
- [ ] T-028 · Ustoz kabineti: yuklama va sinflar — MET-09
- [ ] T-029 · Baholar jurnali: model va API — JUR-01, JUR-02, JUR-03
- [ ] T-030 · Jurnal ekrani (sinf × fan × sana) — JUR-01
- [ ] T-031 · Chorak bahosini hisoblash va qo'lda tuzatish — JUR-04
- [ ] T-032 · Uy vazifasi: berish va topshirish — UYV-01, UYV-02
- [ ] T-033 · Uy vazifasini tekshirish va qaytarish — UYV-03, UYV-06
- [ ] T-034 · O'quvchi kabineti — jadval, vazifalar, natijalar
- [ ] T-035 · Ota-ona kabineti: baholar va uy vazifasi — OTA-04, OTA-05
- [ ] T-036 · Murojaatlar moduli — MUR-01…MUR-04
- [ ] T-037 · Sababli qoldirish arizasi — DAV-04
- [ ] T-038 · 2-bosqich xabarnomalari — Ilova B (2-bosqich qatorlari)
- [ ] T-039 · Jadval istisnolari (dars almashtirish) — ADM-10
- [ ] T-040 · 2-bosqich qabuliga tayyorlash

---

# 3-BOSQICH — Testlar, to'lov, analitika (11–14 hafta)

- [ ] T-041 · Savollar banki va savol turlari — TST-01, TST-02
- [ ] T-042 · Test yaratish va parametrlar — TST-03
- [ ] T-043 · Test ishlash va avtomatik tekshiruv — TST-04
- [ ] T-044 · Test natijalari tahlili — TST-05
- [ ] T-045 · Savollarni Excel'dan import — TST-06
- [ ] T-046 · To'lov: shartnoma va to'lov jadvali — TOL-01, TOL-02
- [ ] T-047 · To'lov kiritish va kvitansiya — TOL-03, TOL-04, TOL-07
- [ ] T-048 · Qarzdorlik hisoboti va eslatmalar — TOL-05, TOL-06
- [ ] T-049 · Ota-ona kabinetida to'lov — OTA-06
- [ ] T-050 · Direktor paneli: KPI va grafiklar — DIR-01…DIR-06
- [ ] T-051 · Ustozlar faoliyati hisoboti — DIR-04
- [ ] T-052 · Xavf ostidagi o'quvchilar — DIR-07
- [ ] T-053 · Hisobotlarni eksport (Excel/PDF) — DIR-08
- [ ] T-054 · Ikki bosqichli tasdiqlash — AUT-09
- [ ] T-055 · Foydalanuvchi va administrator qo'llanmalari — NFR-16
- [ ] T-056 · Yakuniy qabul va topshirish

---

## Eslatma

TZ'da bor, lekin taskda yo'q talab topsang — menga ayt, backlogga qo'shamiz.
Taskda bor, lekin TZ'da yo'q narsa qilma.
