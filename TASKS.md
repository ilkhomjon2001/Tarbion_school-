# TASKS — Tarbion platformasi

Ishni shu fayldan ol. **Bir vaqtda bitta task.** Tugagach katakchani belgila va
commit qil.

Har bir taskda:
- **TZ** — texnik topshiriqdagi talab kodlari (`docs/TZ.pdf` da qidir)
- **Kerak** — oldin bajarilishi shart bo'lgan tasklar
- **Tayyor** — qabul mezonlari. Hammasi bajarilmaguncha task yopilmaydi.

Belgilar: `[ ]` boshlanmagan · `[~]` ishda · `[x]` tugagan

**Frontend** qatori — mock maʼlumot ustidagi prototip holati:
✅ tayyor · 🟡 qisman · ⬜ yoʻq. Prototip tayyor boʻlishi taskni YOPMAYDI:
`[x]` uchun backend, migratsiya va testlar ham kerak. Bu qator faqat
backendga oʻtganda nima qolganini koʻrsatadi.

**Holat (30-avgust 2026):** 56 ta taskdan frontend prototipi
✅ 26 tasida tayyor · 🟡 12 tasida qisman · ⬜ 18 tasida yoʻq.
Backend tomondan **T-001 va T-002 yopildi**: `main.py`, `/health`,
alembic (23 jadval), docker-compose (PostgreSQL 18), test fixture'lari.

**Yangilik (30-avgust, kechqurun):** baza lokalda koʻtarildi va
seed yuklandi — 362 oʻquvchi, 776 dars, 17.6k davomat yozuvi
(`app/seed.py`). Birinchi ishlaydigan endpointlar chiqdi:
`/api/v1/auth/{login,refresh,logout,me}` va
`/api/v1/director/{overview,classes,teachers}`. Frontendda
`/rahbar/jonli` ular bilan uchi-uchiga ishlaydi. Testlar: 19 ta.

T-003, T-004, T-005 hamon `[~]`: endpointlar ishlaydi, lekin
«Tayyor» mezonlaridagi sessiya roʻyxati, parol almashtirish va
blokirovka testlari yozilmagan.

Qolgan boʻshliq: `bot/` da faqat README, moliya jadvallari yoʻq,
qolgan rahbariyat sahifalari hamon mock ustida.

---

# 1-BOSQICH — Asos, davomat, ota-ona kabineti (1–4 hafta)

Maqsad: 4-hafta oxirida ustoz davomat belgilaydi, ota-ona telefonida ko'radi va
farzandi kelmasa Telegram'ga xabar keladi.

---

## Infratuzilma

### [x] T-001 · Repo va muhit
**TZ:** —
**Kerak:** —
**Frontend:** 🟡 qisman — `frontend/` toʻliq ishlaydi: Next 15 + TS + Tailwind v4, 53 sahifa quriladi. `backend/app/` da core+models+services bor, `main.py` va `/health` yoʻq. `bot/`, `docker-compose.yml`, `.env.example`, `README.md` yoʻq.

Monorepo skeletini yarat: `backend/`, `frontend/`, `bot/`, `docs/`.
Backend — FastAPI + uv, `app/main.py` da `/health` endpoint. Frontend — Next.js 15
+ TypeScript + Tailwind v4. `docker-compose.yml` da faqat PostgreSQL 18.
`.env.example`, `.gitignore`, `README.md` (ishga tushirish buyruqlari).

**Tayyor:**
- [x] Postgres ko'tarildi — ish mashinasida lokal PostgreSQL 18.4 ishlatilyapti
      (`tarbion` roli, `tarbion` va `tarbion_test` bazalari). `docker-compose.yml`
      ham yozilgan, Docker o'rnatilgan mashinada `docker compose up -d` ishlaydi.
- [x] `uvicorn app.main:app --reload` → `GET /health` `{"status":"ok"}` qaytaradi
- [x] `pnpm dev` → Next.js bosh sahifasi ochiladi
- [x] `.env.example` da barcha kerakli kalitlar bor, haqiqiy sekret yo'q

---

### [x] T-002 · Baza ulanishi va migratsiya tizimi
**TZ:** —
**Kerak:** T-001
**Frontend:** ⬜ yoʻq — Backend ishi — frontendga aloqasi yoʻq. `models/base.py` bor, alembic sozlanmagan.

SQLAlchemy 2.0 async engine + session dependency. Alembic sozlanadi.
`Base` klassida umumiy maydonlar: `id` (UUID), `created_at`, `updated_at`,
`is_archived`. Barcha modellar shundan meros oladi (CLAUDE.md 1-qoida).

**Tayyor:**
- [x] `alembic upgrade head` xatosiz ishlaydi (`downgrade base` → `upgrade head` ham)
- [x] `alembic revision --autogenerate` model o'zgarishini ko'radi;
      o'zgarish bo'lmasa diff BO'SH chiqadi (sinovdan o'tkazilgan)
- [x] Test uchun alohida baza (`tarbion_test`) va `pytest` fixture'lari tayyor —
      sxema migratsiya bilan quriladi, har test tranzaksiyada, oxirida rollback

---

## Ma'lumot modeli va autentifikatsiya

### [~] T-003 · Foydalanuvchi va rol modellari
**TZ:** AUT-04, AUT-07
**Kerak:** T-002
**Frontend:** ✅ tayyor — `lib/roles.ts` — 6 rol (oʻquvchi, ustoz, ota-ona, rahbariyat, administrator, super administrator). `lib/access.ts` — 41 boʻlim reyestri, rol standarti + foydalanuvchi istisnosi. `/admin/sozlamalar` da rol biriktirish va huquq matritsasi.

`users` (telefon, parol hash, F.I.Sh., holat), `roles`, `user_roles`.
Bir foydalanuvchi bir nechta rolga ega bo'la oladi. Parol `argon2` bilan
xeshlanadi (`passlib`).

Rollar: `student`, `parent`, `teacher`, `homeroom_teacher`, `admin`, `director`, `superadmin`.

**Tayyor:**
- [ ] Migratsiya yozilgan, rollar seed qilingan
- [ ] Parol hech qayerda ochiq saqlanmaydi va API javobida chiqmaydi
- [ ] Foydalanuvchini arxivlash mumkin, o'chirish endpoint'i yo'q

---

### [~] T-004 · Login, JWT, sessiya
**TZ:** AUT-01, AUT-05, AUT-06, AUT-08
**Kerak:** T-003
**Frontend:** 🟡 qisman — `/login` — rol tanlash, «eslab qolish» (localStorage yoki sessionStorage). `lib/auth.ts` sessiyani saqlaydi. JWT, refresh va server sessiyasi yoʻq.

Telefon + parol bilan kirish. Access token 15 daqiqa (JSON javobda),
refresh token 30 kun (`httpOnly`, `Secure`, `SameSite=Lax` cookie).
5 marta noto'g'ri urinishdan keyin hisob 15 daqiqaga bloklanadi (`login_attempts`
jadvali). Har kirish `login_log` ga yoziladi: sana, IP, user-agent.

> **Qo'shimcha (2026-08-29, loyiha egasi so'rovi, TZ AUT-09 kengaytmasi):**
> umumiy/maktab kompyuterlarida hisob ochiq qolib ketmasligi uchun (a)
> login'da "ushbu qurilmada eslab qolish" katakchasi — belgilanmasa refresh
> token faqat sessiya davomida yashaydi (brauzer yopilsa/"Chiqish" bosilsa
> darhol bekor bo'lishi kerak); (b) profil/xavfsizlik bo'limida "Faol
> qurilmalar" ro'yxati — har bir `login_log`/refresh-token yozuvi alohida
> bekor qilinadigan (revoke) bo'lishi, "joriy qurilmadan tashqari
> barchasi"ni bir amalda bekor qilish imkoni bilan. Frontendda
> `lib/auth.ts` + `/student/profil` da `localStorage`/`sessionStorage`
> asosida demo qilib qo'yilgan — bu haqiqiy himoya emas, shu yerdagi
> `refresh_tokens`/`login_log` jadvali ulanganda almashtiriladi.

**Tayyor:**
- [ ] `POST /api/v1/auth/login`, `/refresh`, `/logout`, `/me` ishlaydi
- [ ] Test: 5 xato urinish → 6-si `423 Locked`
- [ ] Test: muddati o'tgan access token `401` beradi, refresh yangilaydi
- [ ] Parolni o'zgartirish endpoint'i eski parolni so'raydi
- [ ] "Eslab qolish" o'chirilgan bo'lsa, refresh token faqat sessiya
      cookie sifatida beriladi (brauzer yopilganda amalda tugaydi)
- [ ] `GET/DELETE /api/v1/auth/sessions` — foydalanuvchining faol
      qurilmalari ro'yxati va birini/barchasini (joriydan tashqari)
      bekor qilish

---

### [x] T-005 · Rolga asoslangan kirish nazorati
**TZ:** NFR-08, 6-domen qoidasi
**Kerak:** T-004
**Frontend:** 🟡 qisman — `AuthGuard` beshta kabinetda ham: sessiya yoʻq → `/login`, rol boshqa kabinetniki → oʻz kabinetiga. Boʻlim koʻrinuvchanligi `lib/access.ts` orqali. Bu koʻrinishni boshqarish — server tekshiruvi yoʻq (7-qoida).

`require_roles("teacher", "admin")` ko'rinishidagi dependency.
Alohida: `get_accessible_student_ids(user)` — vasiy uchun faqat o'z farzandlari,
ustoz uchun o'z sinflari, direktor va admin uchun hammasi. **Barcha o'quvchi
bo'yicha so'rovlar shu funksiyadan o'tadi.**

**Tayyor:**
- [x] Har bir himoyalangan endpoint'da rol tekshiruvi bor
- [x] Test: A ota-ona B o'quvchining ma'lumotini so'raydi → `403`
- [x] Test: ustoz o'zi dars bermaydigan sinf davomatini o'zgartira olmaydi
- [x] HUQUQLAR MARKAZI (loyiha egasi so'rovi, 31-avgust): super administrator
      kim qaysi bo'limni ko'rishini va qaysi amalni bajarishini belgilaydi.
      `/api/v1/access` — bo'limlar reyestri, huquqlar reyestri,
      foydalanuvchilar, bo'lim istisnolari, huquq berish.
- [x] `/auth/me` bo'lim va huquqlarni qaytaradi — frontend menyuni
      o'zi hisoblamaydi, serverdan oladi
- [x] Rol yolg'iz yetarli emas: DAV-03 muddatidan keyin tahrirlash uchun
      `attendance.edit_closed` HUQUQI kerak, admin roli emas

---

### [ ] T-006 · Parolni tiklash
**TZ:** AUT-02
**Kerak:** T-004, T-017
**Frontend:** ⬜ yoʻq — Parolni tiklash ekrani yoʻq.

Telefon raqami bo'yicha bir martalik kod (6 raqam, 10 daqiqa) Telegram orqali
yuboriladi. Bot ulanmagan bo'lsa — administrator qo'lda tiklaydi.

**Tayyor:**
- [ ] Kod bir marta ishlaydi, ikkinchi urinishda bekor
- [ ] Kod so'rovi bir raqam uchun 3 daqiqada 1 marta (rate limit)
- [ ] Test: eski kod bilan tiklash `400`

---

## Ma'muriy yadro

### [~] T-007 · O'quv yili, choraklar, qo'ng'iroqlar jadvali
**TZ:** ADM-01, ADM-07
**Kerak:** T-005
**Frontend:** ✅ tayyor — `/admin/baza` → «Oʻquv yili»: chorak sanalarini tahrirlash (`from < to` validatsiyasi, haftalar avtomatik qayta hisoblanadi), dars kunlari va dars vaqtlari roʻyxati. Bir nechta oʻquv yili va bayramlar yoʻq.

`academic_years` (boshlanish, tugash, joriy), `terms` (chorak, sanalar),
`holidays`, `bell_schedule` (para raqami, boshlanish, tugash vaqti).
Admin CRUD + frontend sahifasi.

**Backend:** ✅ `/api/v1/academic` — yillar, choraklar (yaxlit `PUT`),
ta'tillar, qo'ng'iroqlar jadvali (yaxlit `PUT`). Yozish `schedule.manage`
huquqini talab qiladi, o'qish kirgan har kimga ochiq. 20 ta test.

**Tayyor:**
- [x] Choraklar sanasi bir-birini qoplamaydi (validatsiya) — `409`
- [x] Faqat bitta o'quv yili "joriy" bo'la oladi
- [ ] Admin sahifasida CRUD ishlaydi — frontend hali mock'da

---

### [x] T-008 · Sinflar, fanlar, xodimlar
**TZ:** ADM-02, ADM-03, ADM-04
**Kerak:** T-007
**Frontend:** ✅ tayyor — `/admin/baza`: Sinflar (ochish, sinf rahbari va sigʻimni oʻzgartirish, arxivlash — oʻquvchisi bor sinf arxivlanmaydi), Fanlar (qoʻshish, oʻquv rejasidan chiqarish), Xonalar (qoʻshish, foydalanishdan chiqarish). Xodimlar — `/rahbar/ustozlar` va `/admin/sozlamalar`.

`classes` (nomi, o'quv yili, sinf rahbari), `subjects`,
`class_subjects` (sinf + fan + haftalik soat), `teacher_subjects`.
Xodim yaratilganda `users` yozuvi va tegishli rol beriladi.

**Backend:** ✅ Xodim hisobi ochish (`POST /school/staff` — login `familiya.ism`
avtomatik, boshlang'ich parol bir marta qaytadi), fan biriktirish, parol tiklash,
arxivlash. **Frontend:** `/admin/sozlamalar` → «Xodimlar».

**Tayyor:**
- [ ] Sinf rahbari biriktirilganda unga `homeroom_teacher` roli qo'shiladi
- [x] Bir sinfda bir fan bir marta (unique constraint)
- [x] Xodim yaratish va fan biriktirish ishlaydi

---

### [x] T-009 · O'quvchilar va vasiylar
**TZ:** ADM-05, ADM-06, ADM-11
**Kerak:** T-008
**Frontend:** ✅ tayyor — `/admin/oquvchilar` — roʻyxat, profil paneli, sinfga koʻchirish, arxivlash (sabab roʻyxatdan + sana), arxivdan qaytarish. `/admin/qabul` — vasiy maʼlumotlari bilan 4 bosqichli qabul. `/admin/shartnomalar` — kelgan-ketgan tarixi.

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
**Frontend:** ⬜ yoʻq — Excel import yoʻq. CSV EKSPORT bor (audit, soʻrovnoma natijalari, shartnomalar).

Shablon fayl (`docs/import-template.xlsx`) generatsiyasi + yuklash.
Import ikki qadamda: **avval tekshiruv** (xatoliklar jadvali qaytadi), keyin
tasdiqlash va yozish. Qisman import qilinmaydi — hammasi yoki hech nima.

**Tayyor:**
- [ ] Shablonni yuklab olish tugmasi ishlaydi
- [ ] Xato qatorlar raqami va sababi bilan ko'rsatiladi
- [ ] Takroriy o'quvchi (bir xil F.I.Sh. + tug'ilgan sana) aniqlanadi
- [ ] Test: 100 qatorli fayl 5 soniyada qayta ishlanadi

---

### [x] T-011 · Dars jadvali
**TZ:** ADM-08, ADM-09
**Kerak:** T-008
**Frontend:** ✅ tayyor — `/rahbar/jadval` — oy/hafta/kun koʻrinishlari, sinf va ustoz kesimida. `/teacher/jadval`, `/student/schedule`, `/rahbar/ustozlar/[id]` → «Dars jadvali». Toʻqnashuv nazorati backendda qoladi.

`schedule_entries` (sinf, fan, ustoz, hafta kuni, para, xona).
**To'qnashuv nazorati:** bitta ustoz yoki xona bir vaqtda ikki joyda band bo'la
olmaydi — saqlashda tekshiriladi va aniq xato matni qaytariladi.

Frontend: haftalik grid ko'rinish, sinf yoki ustoz bo'yicha filtr.

**Backend:** ✅ `/api/v1/schedule` — jadval (sinf/ustoz kesimida), qo'shish
(409 to'qnashuv nazorati bilan), ustoz/xona almashtirish, arxivlash, ustozlar
yuklamasi. **Frontend:** `/admin/baza` → «Dars jadvali» va `/rahbar/jadval`.

**Tayyor:**
- [x] Test: band ustozni qo'shishga urinish → `409` va qaysi sinf bilan to'qnashgani
- [x] Jadval sinf va ustoz kesimida ko'rinadi
- [x] Mobil ekranda jadval o'qish mumkin (gorizontal scroll)

---

### [x] T-012 · Darslarni generatsiya qilish
**TZ:** ADM-08 (hosila)
**Kerak:** T-011
**Frontend:** 🟡 qisman — `lib/teacher/schedule.ts` mock darslar generatsiyasi — sana boʻyicha dars roʻyxati chiqadi. Idempotentlik va taʼtil kunlari backend ishi.

`lessons` — jadval asosida konkret sanaga yaratiladigan yozuv (sinf, fan, ustoz,
sana, para). Davomat va baho **darsga** bog'lanadi, jadvalga emas.
Chorak boshlanganda avtomatik generatsiya, ta'til kunlari o'tkazib yuboriladi.

**Backend:** ✅ `POST /attendance/generate` (sana oralig'i) va
`POST /attendance/generate/term/{id}` (butun chorak). Vaqt qo'ng'iroqlar
jadvalidan, mahalliy → UTC. `GET /attendance/my-lessons/range` — ustoz
jadvali ekrani uchun.

**Tayyor:**
- [x] Chorak uchun darslar bir marta generatsiya qilinadi (idempotent)
- [x] Ta'til va dam olish kunlarida dars yaratilmaydi
- [x] Test: jadval o'zgarsa, o'tgan darslar o'zgarmaydi

---

## Davomat

### [x] T-013 · Davomat modeli va API
**TZ:** DAV-01, DAV-03, DAV-06, DAV-07
**Kerak:** T-012
**Frontend:** 🟡 qisman — `/teacher/davomat/[lessonId]` — 4 holat (keldi / kelmadi / sababli / kechikdi). 24 soat qulfi va audit backendda. Davomat foizi `lib/director/school-data.ts` da hisoblanadi (oʻquvchi / sinf / davr kesimida).

`attendance_records` (dars, o'quvchi, holat, izoh, kim belgiladi, qachon).
Holatlar: `present`, `absent`, `excused`, `late`.

Qoidalar:
- ustoz o'z darsini 24 soat ichida tahrirlaydi, keyin `403`
- administrator har doim o'zgartira oladi
- har o'zgarish `audit_log` ga tushadi

**Tayyor:**
- [x] `POST /attendance/lessons/{id}` — butun sinf bir so'rovda, bitta tranzaksiyada
- [x] Test: 25 soatdan keyin ustoz o'zgartira olmaydi (403), admin oladi
- [x] Test: har o'zgarish audit'ga eski va yangi qiymat bilan yoziladi
- [x] Davomat foizi endpoint'i: `GET /attendance/stats` —
      o'quvchi / sinf / fan / ustoz / sana kesimida, kesimlar birga ishlaydi
- [x] `GET /attendance/lessons/{id}` — sinf ro'yxati davomat belgilanmagan bo'lsa ham
- [x] `GET /attendance/my-lessons` — ustozning shu kundagi darslari
- [x] `GET /attendance/classes/{id}/students` — sinf jurnali kesimi
- [x] Salbiy testlar: begona ustoz 403, begona ota-ona 403, tokensiz 401

---

### [x] T-014 · Ustoz davomat ekrani
**TZ:** DAV-01
**Kerak:** T-013
**Frontend:** ✅ tayyor — `/teacher` — bugungi darslar va «Davomat belgilash». `/teacher/davomat/[lessonId]` — oʻquvchilar roʻyxati, sukut boʻyicha hammasi «keldi», bir bosishda saqlanadi. Mobil 360px da ishlaydi.

Ustoz bosh sahifasi: bugungi darslari ro'yxati, har birida "Davomat belgilash".
Davomat ekrani — o'quvchilar ro'yxati, har birida 4 ta holat tugmasi.
Sukut bo'yicha hamma "keldi". Bir bosishda saqlanadi.

**Tayyor:**
- [x] Mobilda (360px) barmoq bilan qulay ishlaydi, tugma ≥44px
- [x] Saqlanmagan o'zgarish bo'lsa, sahifadan chiqishda ogohlantiradi
- [x] Loading va error holatlari bor
- [x] 24 soat o'tgan dars faqat o'qish rejimida ochiladi, sababi ko'rsatiladi
      (`editable` maydoni backenddan keladi — frontend o'zi hisoblamaydi)
- [x] Ekran BACKENDGA ulandi: `lib/teacher/attendance-api.ts` orqali
      `my-lessons`, `lessons/{id}` va `POST lessons/{id}`. localStorage emas.

---

### [ ] T-015 · Sinf rahbari kunlik davomat ekrani
**TZ:** DAV-02
**Kerak:** T-013
**Frontend:** 🟡 qisman — `/rahbar/sinflar` → sinf tanlanganda oʻquvchilar kesimida kunma-kun davomat kalendari (bugungi / haftalik / oylik). Sinf rahbari uchun «qatorlar — oʻquvchi, ustunlar — para» koʻrinishidagi TEZ TOʻLDIRISH ekrani yoʻq.

Bitta ekranda butun sinfning kunlik davomati: qatorlar — o'quvchilar,
ustunlar — paralar. Tez to'ldirish uchun.

**Tayyor:**
- [ ] Bir kunlik butun sinf bitta so'rovda yuklanadi
- [ ] Kelmagan o'quvchilar vizual ajratilgan
- [ ] Sana bo'yicha oldinga/orqaga yurish

---

## Ota-ona kabineti va bot

### [x] T-016 · Ota-ona kabineti — bosh sahifa va davomat
**TZ:** OTA-01, OTA-02, OTA-03, OTA-08
**Kerak:** T-013, T-005
**Frontend:** ✅ tayyor — `/ota-ona` — bugungi davomat va soʻnggi eʼlonlar, farzand almashtirgich. `/ota-ona/davomat` — oylik kalendar, sababli/sababsiz ranglar, oylik foiz. 360px dan ishlaydi.

Bosh sahifa: bugungi davomat, so'nggi e'lonlar. Bir nechta farzand bo'lsa —
yuqorida farzand almashtirgich.
Davomat sahifasi: oylik kalendar, sababli/sababsiz ranglar bilan ajratilgan,
pastda oylik foiz.

**Tayyor:**
- [x] Mobil-birinchi, 360px da to'liq ishlaydi
- [x] Bo'sh holat matnlari bor ("Bugun dars yo'q", "Farzand biriktirilmagan")
- [x] Test: boshqa oilaning ma'lumotiga URL orqali kirib bo'lmaydi → `403`
      (`test_begona_bolaning_davomatini_kora_olmaydi`, jonli ham tekshirilgan)
- [x] BACKENDGA ulandi: `GET /parent/children` va
      `GET /parent/children/{id}/attendance`. Farzandlar ro'yxati
      `guardians` jadvalidan, kalendar bazadagi davomatdan.
- [x] Kalendar oyi endi dinamik (avval 2026-avgust qattiq yozilgandi),
      oldinga/orqaga yurish tugmalari bilan

---

### [ ] T-017 · Telegram bot: ulanish
**TZ:** BOT-01
**Kerak:** T-004
**Frontend:** ⬜ yoʻq — `bot/` papkasi yaratilmagan.

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
**Frontend:** 🟡 qisman — Frontendda eslatma yuborish tugmasi bor (`/admin/tolovlar` → «Eslatma», bot yoki SMS tanlanadi) va yozuv audit jurnaliga tushadi. Outbox jadvali va worker — backend ishi.

`notification_outbox` (turi, qabul qiluvchi, kanal, matn, holati, urinishlar soni,
xato matni). Kod xabarni **to'g'ridan-to'g'ri yubormaydi** — outbox'ga yozadi.
Alohida worker sikli yuboradi, xatoda 3 marta qayta uriniladi (backoff bilan).

`notification_preferences` — foydalanuvchi qaysi turlarni olishini tanlaydi.

**Tayyor:**
- [ ] Telegram tushib qolsa xabar yo'qolmaydi, navbatda qoladi
- [ ] Yetkazilmagan xabarlar admin panelida ko'rinadi va qayta yuborish mumkin
- [ ] Bir foydalanuvchiga bir turdagi xabar kuniga bir marta jamlanadi (BOT-07)

---

### [x] T-018a · Kabinet ichidagi bildirishnomalar
**TZ:** DAV-05, MUR-03 (kabinet qismi)
**Kerak:** T-013, T-029, T-032, T-036
**Frontend:** ✅ tayyor — qoʻngʻiroq va yon menyudagi sanoq oltita kabinetda.

TASKS.md da alohida task yoʻq edi. T-018/T-019/T-020 dan ATAYLAB ajratilgan:
ular xabarni TASHQARIGA (Telegram, SMS) yuborish haqida va outbox'ga bogʻliq.
Bu esa kabinetning ICHIDA — odam tizimga kirganda koʻradigan xabar. Outbox
yozilganda u shu jadvaldan oziqlanadi, qaytadan yozilmaydi.

`notifications` jadvali: qabul qiluvchi, turi, boʻlim, havola, matn, `read_at`.
Yozuv HODISA emas, QABUL QILUVCHI boʻyicha — «oʻqildi» har odamda oʻziniki
va kirish nazorati bitta shartga tushadi (`WHERE user_id = :men`).

Hodisalar: darsga kelmadi, darsga kechikdi, yangi murojaat, yangi xabar,
murojaat biriktirildi, murojaat yopildi, yangi baho, yangi uy vazifasi,
vazifa baholandi, vazifa qaytarildi.

Kim nimani oladi bitta jadvalda (`notifications_service._SECTION`):
uy vazifasi va qaytarilgan ish faqat OʻQUVCHIGA (kuniga 6-7 dars boʻladi,
ota-onaning qoʻngʻirogʻi shovqin bilan toʻlardi), baho va davomat esa
oilaga — ota-ona va oʻquvchiga.

**Tayyor:**
- [x] Oʻquvchi kelmasa/kechiksa ota-ona va oʻquvchi xabar oladi
- [x] Murojaatdagi har xabar narigi tomonga boradi
- [x] Baho qoʻyilsa oila, uy vazifasi berilsa oʻquvchi xabar oladi
- [x] Yon menyuda boʻlim boʻyicha oʻqilmaganlar soni koʻrinadi
- [x] Oʻz amalidan xabar kelmaydi, takror saqlashda takror xabar yoʻq
- [x] Begona bildirishnomani oʻqib ham, belgilab ham boʻlmaydi (34 test)

---

### [ ] T-019 · Davomat xabarnomalari
**TZ:** DAV-05, Ilova B (1-bosqich qatorlari)
**Kerak:** T-018, T-013, T-018a
**Frontend:** 🟡 qisman — Kabinet ichida xabar bor (T-018a). Telegram/SMS
shablonlari va yuborish yoʻq.

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
**Frontend:** ✅ tayyor — `/teacher/elon` — auditoriya tanlash (butun maktab / sinf) va yuborishdan oldin qabul qiluvchilar soni. Eʼlon `/student/announcements` va `/ota-ona/elonlar` da koʻrinadi.

`announcements` (sarlavha, matn, fayl, auditoriya: butun maktab / sinf / rol).
Admin e'lon chop etadi → tegishli foydalanuvchilarga outbox orqali yuboriladi.

**Tayyor:**
- [ ] Auditoriya tanlanadi va yuborishdan oldin qabul qiluvchilar soni ko'rsatiladi
- [ ] E'lon kabinetlarda ham ko'rinadi (faqat Telegram emas)

---

## Yopish

### [~] T-021 · Audit jurnali
**TZ:** NFR-10, DAV-07
**Kerak:** T-013
**Frontend:** ✅ tayyor — `/admin/audit` — 16 turdagi amal, filtr (amal turi va matn boʻyicha), CSV eksport. Tahrirlash va oʻchirish tugmasi ATAYLAB yoʻq. Admin panelidagi har bir amal yozuv qoldiradi.

`audit_log` (obyekt turi, obyekt id, amal, eski qiymat JSON, yangi qiymat JSON,
foydalanuvchi, vaqt, IP). Yozuvlar o'zgartirilmaydi.
Admin uchun ko'rish sahifasi: filtr — obyekt turi, foydalanuvchi, sana.

**Tayyor:**
- [ ] Davomat va foydalanuvchi o'zgarishlari tushayapti
- [ ] Audit yozuvini o'zgartiruvchi/o'chiruvchi endpoint yo'q

---

### [~] T-022 · Zaxira nusxa va deploy
**TZ:** NFR-07, NFR-09, NFR-12
**Kerak:** T-001
**Frontend:** ⬜ yoʻq — Deploy, HTTPS, zaxira nusxa — hech biri yoʻq.

VPS: Nginx + HTTPS (Let's Encrypt), systemd birliklari (api, worker, bot).
Har kunlik `pg_dump` → siqish → R2 ga yuklash, 30 kun saqlash.
Tiklash skripti va uni sinovdan o'tkazish yo'riqnomasi.

**Zaxira qismi tayyor:** `scripts/backup.sh` (age ochiq kalit bilan
shifrlash), `scripts/restore_check.sh` (tiklab tekshirish),
`docs/ZAXIRA.md`. Deploy (HTTPS, systemd) hali yo'q.

**Tayyor:**
- [ ] HTTP → HTTPS yo'naltiriladi
- [ ] Xizmatlar qayta ishga tushirilganda avtomatik ko'tariladi
- [~] Zaxiradan tiklash sinovdan o'tkazilgan — quvur lokal bazada
      tekshirildi (gpg bilan); serverda `age` bilan qayta sinash kerak

---

### [ ] T-023 · 1-bosqich qabuliga tayyorlash
**TZ:** 9-bo'lim
**Kerak:** T-001…T-022
**Frontend:** ⬜ yoʻq — Playwright testlari va yoʻriqnomalar yoʻq.

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
  - Frontend: ✅ tayyor — `/teacher/jadval` → fan boʻyicha baza brauzeri, `lib/teacher/plan-data.ts`
- [ ] T-025 · R2 fayl yuklash va presigned URL — MET-03, NFR-11
  - Frontend: ⬜ yoʻq
- [ ] T-026 · Metodik bazada qidiruv va filtr — MET-05
  - Frontend: 🟡 qisman — sinf boʻyicha filtr bor, toʻliq qidiruv yoʻq
- [ ] T-027 · Reja tasdiqlash oqimi va versiyalar — MET-06, MET-07
  - Frontend: ⬜ yoʻq
- [ ] T-028 · Ustoz kabineti: yuklama va sinflar — MET-09
  - Frontend: ✅ tayyor — `/rahbar/ustozlar/[id]` → «Sinflari» va «Statistika»
- [x] T-029 · Baholar jurnali: model va API — JUR-01, JUR-02, JUR-03 · backend tayyor (`/api/v1/journal`)
  - Frontend: ⬜ yoʻq — backend ishi
- [ ] T-030 · Jurnal ekrani (sinf × fan × sana) — JUR-01
  - Frontend: ✅ tayyor — `/teacher/jurnal`
- [ ] T-031 · Chorak bahosini hisoblash va qo'lda tuzatish — JUR-04
  - Frontend: 🟡 qisman — `GradeBook.tsx` da chorak ustuni bor, qoʻlda tuzatish yoʻq
- [x] T-032 · Uy vazifasi: berish va topshirish — UYV-01, UYV-02 · backend tayyor
  - Frontend: ✅ tayyor — `/teacher/vazifa`, `/student/homework`
- [x] T-033 · Uy vazifasini tekshirish va qaytarish — UYV-03, UYV-06 · backend tayyor
  - Frontend: ✅ tayyor — `/teacher/vazifa/[id]`
- [ ] T-034 · O'quvchi kabineti — jadval, vazifalar, natijalar
  - Frontend: ✅ tayyor — `/student/*` — 12 sahifa
- [ ] T-035 · Ota-ona kabineti: baholar va uy vazifasi — OTA-04, OTA-05
  - Frontend: ✅ tayyor — `/ota-ona/baholar`
- [~] T-036 · Murojaatlar moduli — MUR-01…MUR-04
  - Backend: ✅ `appeals` + `appeal_messages` + `appeal_notes`, 13 endpoint, 43 test
  - Frontend: ✅ ota-ona, administrator va rahbariyat sahifalari BAZADAN oʻqiydi
  - ADM-16: maktab ham yozishmani boshlay oladi — administrator oʻquvchini
    qidiradi, vasiy hisobi shundan olinadi. Yozishma oilaga tegishli
    (`author_id`), kim ochgani `created_by_id` da qoladi
  - Ustoz kabineti (`/teacher/murojaat`) hali mock ustida — keyingi qadam
- [ ] T-037 · Sababli qoldirish arizasi — DAV-04
  - Frontend: ⬜ yoʻq
- [ ] T-038 · 2-bosqich xabarnomalari — Ilova B (2-bosqich qatorlari)
  - Frontend: ⬜ yoʻq
- [ ] T-039 · Jadval istisnolari (dars almashtirish) — ADM-10
  - Frontend: ⬜ yoʻq
- [ ] T-040 · 2-bosqich qabuliga tayyorlash
  - Frontend: ⬜ yoʻq

---

# 3-BOSQICH — Testlar, to'lov, analitika (11–14 hafta)

- [x] T-041 · Savollar banki va savol turlari — TST-01, TST-02 · backend + ustoz ekrani
  - Frontend: 🟡 qisman — `/teacher/test` da savol qoʻshish bor, savollar banki yoʻq
- [x] T-042 · Test yaratish va parametrlar — TST-03 · backend + ustoz ekrani
  - Frontend: ✅ tayyor — `/teacher/test`
- [~] T-043 · Test ishlash va avtomatik tekshiruv — TST-04 · backend tayyor; o'quvchi ekrani T-034 (hisob) ni kutadi
  - Frontend: ✅ tayyor — `/student/tests/[id]`
- [~] T-044 · Test natijalari tahlili — TST-05 · ustoz uchun natijalar jadvali tayyor
  - Frontend: 🟡 qisman — natija koʻrsatiladi, tahlil kesimlari yoʻq
- [ ] T-045 · Savollarni Excel'dan import — TST-06
  - Frontend: ⬜ yoʻq
- [ ] T-046 · To'lov: shartnoma va to'lov jadvali — TOL-01, TOL-02
  - Frontend: ✅ tayyor — `/admin/shartnomalar` — kelgan-ketgan bazasi, sabab va sana bilan
- [ ] T-047 · To'lov kiritish va kvitansiya — TOL-03, TOL-04, TOL-07
  - Frontend: ✅ tayyor — `/admin/tolovlar` — toʻlov kiritish, chek raqami, STORNO (tahrirlash yoʻq)
- [ ] T-048 · Qarzdorlik hisoboti va eslatmalar — TOL-05, TOL-06
  - Frontend: ✅ tayyor — `/admin/tolovlar` — qarzdorlar, muddat choʻzish, chegirma, hisobdan chiqarish, eslatma
- [ ] T-049 · Ota-ona kabinetida to'lov — OTA-06
  - Frontend: ✅ tayyor — `/ota-ona/tolov`
- [ ] T-050 · Direktor paneli: KPI va grafiklar — DIR-01…DIR-06
  - Frontend: ✅ tayyor — `/rahbar` va `/rahbar/hisobotlar` — 6 ta grafik
- [ ] T-051 · Ustozlar faoliyati hisoboti — DIR-04
  - Frontend: ✅ tayyor — `/rahbar/ustozlar/[id]` → «KPI» — 4 koʻrsatkich, imtihon dinamikasi, sinflar kesimi
- [ ] T-052 · Xavf ostidagi o'quvchilar — DIR-07
  - Frontend: ✅ tayyor — `isAtRisk()` — `/rahbar/sinflar` va davomat kesimida ajratiladi
- [ ] T-053 · Hisobotlarni eksport (Excel/PDF) — DIR-08
  - Frontend: 🟡 qisman — CSV eksport va brauzer orqali PDF bor, Excel yoʻq
- [ ] T-054 · Ikki bosqichli tasdiqlash — AUT-09
  - Frontend: ⬜ yoʻq
- [ ] T-055 · Foydalanuvchi va administrator qo'llanmalari — NFR-16
  - Frontend: ⬜ yoʻq
- [ ] T-056 · Yakuniy qabul va topshirish
  - Frontend: ⬜ yoʻq

---

## Eslatma

TZ'da bor, lekin taskda yo'q talab topsang — menga ayt, backlogga qo'shamiz.
Taskda bor, lekin TZ'da yo'q narsa qilma.
