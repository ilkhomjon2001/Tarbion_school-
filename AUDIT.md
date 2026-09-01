# TARBION — Loyiha auditi

Sana: 2026-09-01 · Usul: toʻliq kod oʻqish (backend 22 router + 27 service, frontend 244 fayl,
migratsiyalar, testlar) + 4 yoʻnalishli chuqur tekshiruv. Hech qanday kod oʻzgartirilmadi.
KRITIK va YUQORI topilmalarning barchasi kodda qayta tasdiqlangan (fayl:satr bilan).

---

## 1. XULOSA

Loyihaning **backend yadrosi kuchli**: BOLA/IDOR himoyasi (`services/access.py`) juda izchil,
pul butun sonda (float yoʻq), vaqt bilan ishlash (UTC/Tashkent) namunali, DELETE yoʻq — hamma joyda
arxiv/storno, audit jadvali DB darajasida oʻzgarmas, JWT rotatsiya + reuse-detection bor, 470 ta test oʻtadi.
Bu daraja odatiy maktab tizimlaridan ancha yuqori.

Lekin **topshirishga hozircha tayyor emas**. Eng xavfli 5 muammo:

1. **Frontendning katta qismi hali mock/demo maʼlumot koʻrsatadi** — eng yomoni, real sahifalar ichiga
   aralashgan holda: ota-ona bosh sahifasi qarzdorga **"Toʻlangan"** deb koʻrsatadi, ustoz bosh sahifasi
   soxta "tekshirilmagan ishlar" chiqaradi, direktor "Hisobotlar" sahifasi ~400 uydirma oʻquvchi statistikasini
   beradi, admin bosh sahifasi soxta moliya koʻrsatadi. Foydalanuvchi qaysi raqam real, qaysi soxta ekanini bila olmaydi.
2. **Baho oʻrtachasi buzilishi mumkin**: 100 ballik uy vazifasi bahosi 5 ballik jurnal oʻrtachasiga
   shkala normalizatsiyasisiz qoʻshiladi — oʻquvchining "oʻrtacha bahosi" 20+ boʻlib chiqadi.
3. **Ustoz baho qoʻya olmay qolishi mumkin**: baho paneli hardcoded demo roʻyxatga (`TEACHING`)
   bogʻlangan — real ustozning sinfi roʻyxatda yoʻq, jurnal ochilmaydi.
4. **Parol almashtirilganda eski sessiyalar bekor boʻlmaydi** — hisob oʻgʻirlangan boʻlsa,
   parol yangilangandan keyin ham oʻgʻrining refresh tokeni 30 kungacha ishlaydi.
5. **Direktor koʻrsatkichlari ishonchsiz**: "Tushum" hisobi yopiq ketgan oʻquvchilar toʻlovlarini
   tushirib qoldiradi; davomat foizi va oʻrtacha baho direktor panelida boshqa formulada — jurnal bilan hech qachon mos kelmaydi.

Umumiy baho: backend biznes-mantiqning ~85% i ishonchli; frontendning ~60% i real APIʼga ulangan,
qolgani demo. Quyidagi 1–2-bosqich tuzatishlarsiz mijozga koʻrsatish xavfli — tizim "notoʻgʻri
ishlayapti" degan taassurot qoldiradi, vaholanki koʻp joyda shunchaki "hali ulanmagan".

---

## 2. LOYIHA XARITASI

### Texnologiyalar
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind v4. Tiplar OpenAPIʼdan generatsiya
  (`@hey-api/openapi-ts` → `src/lib/api/`), enum pariteti `pnpm check:contracts` bilan.
  ⚠ CLAUDE.md "TanStack Query" vaʼda qiladi — **kodda ham, package.jsonʼda ham yoʻq** (oddiy fetch-wrapper ishlatiladi).
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic (18 migratsiya, zanjir butun), Pydantic v2.
- **Baza**: PostgreSQL. **Auth**: JWT httpOnly cookie, access 15 daq / refresh 30 kun, rotatsiya + reuse-detection,
  2FA (admin/direktorga majburiy), login lockout PostgreSQLʼda.
- **Deploy**: GitHub Actions → SSH (test + build oʻtmasa chiqmaydi), jonli: tarbion.robbitonline.uz.
- **Yoʻq (vaʼda qilingan, qurilmagan)**: Telegram bot (`bot/` boʻsh), `notification_outbox` + worker,
  R2 fayl servisi (boto3 yoʻq), PayTechUZ (oʻrnida "sinov" provayder), Playwright.

### Rollar (kodda haqiqatda bor)
| Rol | Kabinet | Qila oladi |
|---|---|---|
| superadmin | /admin | hammasi + huquq berish, superadmin yaratish |
| admin | /admin | oʻquvchi/xodim/jadval/toʻlov/hujjat/soʻrovnoma/audit (huquqlar bilan boshqariladi) |
| director | /rahbar | faqat oʻqish: agregatlar, toʻlov jamlanmasi, murojaatlar |
| academic (oʻquv boʻlimi) | /oquv-bolim | imtihonlar, dars rejalari, sifat; **moliyaga ataylab kira olmaydi** |
| teacher | /teacher | davomat, jurnal, uy vazifasi, test, eʼlon, tarbiya (oʻz sinf+fani kesimida) |
| homeroom_teacher | /teacher | ustoz + oʻz sinfi boʻyicha kengaytirilgan koʻrish |
| student | /student | jadval, vazifa, test, oʻz baholari |
| guardian (ota-ona) | /ota-ona | faqat oʻz farzandi: davomat, baho, toʻlov, murojaat, soʻrovnoma |

### Asosiy entitylar
`users` (rollar M2M) → `students` (→`classes`) ←`guardians` (M2M `student_guardians`);
`schedule_entries` (hafta shabloni) → **`lessons`** (konkret sana; davomat/baho DARSGA bogʻlanadi,
jadvalga emas) → `attendance_records` (unique lesson+student), `grades` (⚠ unique yoʻq);
`homeworks`→`homework_submissions`→`grades`; `tests`→`test_attempts`;
`tuition_contracts`→`tuition_charges` (unique student+yil+oy) / `tuition_discounts` / `tuition_credits` / `payments`
(storno zanjiri, `provider_tx_id` unique) / `payment_intents`; `academic_years`→`terms`/`holidays`/`bells`;
`appeals`, `announcements`, `notifications`, `wellbeing_notes`, `exams`, `lesson_plans`, `staff_profiles`,
`document_requests`, `surveys`, `audit_log` (DB-trigger bilan immutable).

### Sahifa → maʼlumot manbai (qisqartirilgan; toʻliq tahlil 4-boʻlim topilmalarida)
**REAL** (backendga ulangan): login/2FA; oʻquvchi: bosh, jadval, vazifa, baholar, testlar, eʼlonlar;
ustoz: jadval, jurnal, vazifa, test, eʼlon, murojaat, tarbiya, davomat (saqlash qismi); ota-ona: davomat,
baholar, toʻlov, murojaat, eʼlonlar, tarbiya, soʻrovnoma; admin: oʻquvchilar, toʻlovlar, kadrlar,
maʼlumotnomalar (hujjatlar), murojaatlar, soʻrovnomalar, baza (sinf/fan/xona/kalendar/jadval), audit,
sozlamalar→huquqlar; rahbar: bosh, jadval, sinflar, ustozlar, toʻlovlar, jonli, murojaatlar; oʻquv boʻlimi: hammasi.

**MOCK yoki ARALASH** (foydalanuvchi qisman/toʻliq soxta maʼlumot koʻradi):
| Sahifa | Holat |
|---|---|
| /admin (bosh) | MOCK — soxta moliya, qarzdorlar |
| /admin/lidlar, /qongiroqlar, /shartnomalar, /qabul (navbat), /profil, /sozlamalar→maktab | MOCK (client-side seed store) |
| /rahbar/hisobotlar, /rahbar/ustozlar/[id] | MOCK (+ mock CSV eksport) |
| /student/reyting, /student/ustozlar, /student/profil (kontakt/qurilmalar) | MOCK/soxta saqlash |
| /ota-ona (bosh: toʻlov, vazifa, baho kartalari), /ota-ona/oshxona, /ota-ona/sozlamalar | MOCK/ARALASH |
| /teacher (bosh: "amal talab qiladi"), /teacher/davomat (reja, baho-huquq) | ARALASH |
| Direktor barcha sahifa sarlavhasi | DEMO_DIRECTOR ismi |

### Oʻlik kod (qisqacha; toʻliq — topilmalar)
- 11 ta import qilinmaydigan frontend fayl (`Live*` refaktoringidan qolgan eski nusxalar).
- Backend: `auth_service.change_password` (sessiya bekor qiladigan TOʻGʻRI variant — hech qayerdan
  chaqirilmaydi!), `academic_service.term_on`, `is_holiday`, `user_service.count_users`.
- Frontend UI'siz endpointlar: `POST /academic/years` (+update/make-current — oʻquv yilini UI'dan ochib boʻlmaydi!),
  `GET /attendance/stats`, `POST /attendance/generate` (sana-oraliq varianti).
- TODO/FIXME/console.log: **0 ta** — toza. `tarbion-claude-setup/` — hujjatlarning toʻliq dublikati gitʼda.
- Repo ildizida 4 ta `photo_2026-08-29_*.jpg` chiqindi fayl.

---

## 3. TOPILMALAR JADVALI

### KRITIK — notoʻgʻri maʼlumot / maʼlumot yoʻqotish / xavfsizlik

| № | Yoʻnalish | Joy | Muammo | Foydalanuvchiga taʼsiri | Taklif |
|---|---|---|---|---|---|
| K1 | Maʼlumot | `backend/app/services/grade_service.py:596-603` + `homework_service.py:404-414` + `api/v1/director.py:109-113` | Uy vazifasi bahosi `grades`ga `max_value=homework.max_score` (100 gacha, `schemas/journal.py:122`) bilan yoziladi, lekin BARCHA oʻrtacha formulalar `max_value`ni eʼtiborsiz qoldiradi | 85/100 olgan oʻquvchining "oʻrtacha bahosi" jurnal, ota-ona va direktor ekranida 20+ boʻlib chiqadi | Oʻrtachada `value/max_value` normalizatsiya yoki 5 balldan boshqa shkala baholarini jurnaldan ajratish |
| K2 | Frontend | `frontend/src/app/(parent)/ota-ona/page.tsx:67-84` | Bosh sahifa toʻlov/vazifa/baho kartalari mockʼdan; real bola idʼsi mock kalitga mos kelmagani uchun fallback: balans 0 | **Qarzdor ota-ona bosh sahifada "Toʻlangan" koʻradi**, vazifa "Hammasi topshirilgan"; /ota-ona/tolov esa real qarzni koʻrsatadi — ikki sahifa bir-biriga zid | fetchLedger/fetchHomeworkList/fetchSubjectGrades ga ulash |
| K3 | Frontend | `frontend/src/lib/teacher/roles.ts:24-33` + `davomat/[lessonId]/page.tsx:180` | `canGrade()` hardcoded `TEACHING` lugʻati ("11-A Matematika"…) — real jadval emas | Real ustoz roʻyxatda yoʻq sinfda davomat saqlaydi, **jurnal paneli ochilmaydi — baho qoʻya olmaydi**; teskarisi: begonaga panel ochiladi (server 403 beradi, UI adashtiradi) | `useMyTeaching` (lib/teacher/me.ts — real jadvaldan) ishlatish |
| K4 | Frontend | `frontend/src/app/(teacher)/teacher/davomat/[lessonId]/page.tsx:169-186` | `saveAttendance` try/catch'siz; xato holati yoʻq | Tarmoq/server xatosida tugma abadiy "Saqlanmoqda…", **ustoz davomat saqlandi deb ketadi — maʼlumot jimgina yoʻqoladi** (DAV-01 yadro oqimi) | try/catch + xato banneri + qayta urinish |
| K5 | Xavfsizlik | `backend/app/api/v1/auth.py:282` → `user_service.py:153-188, 191-221` | Parol almashtirish/tiklash refresh tokenlarni bekor QILMAYDI. Bekor qiladigan toʻgʻri variant (`auth_service.change_password`, :293) oʻlik kod | Hisob egallanganda parol yangilansa ham oʻgʻrining sessiyasi 30 kungacha tirik (AUT-08 buzilgan) | Routerni `auth_service.change_password`ga ulash; resetʼga ham revoke qoʻshish |
| K6 | Xavfsizlik | `backend/app/services/homework_service.py:612-616`, `test_service.py:677, 768` | Topshirish amallari oʻqish ruxsati toʻplami (`accessible_student_ids`) bilan himoyalangan | **Ota-ona farzandi oʻrniga testni yechib bera oladi**, ustoz oʻquvchi nomidan topshira oladi — natijalar butunligi buziladi | `Student.user_id == user.id` (faqat oʻquvchining oʻzi) talab qilish |
| K7 | Frontend | `frontend/src/components/features/student/DeviceSecurity.tsx:16-47` | Soxta "Faol qurilmalar" roʻyxati; "Chiqarish" faqat lokal state oʻchiradi | **Xavfsizlik yolgʻoni**: oʻquvchi oʻgʻirlangan sessiyani "chiqardim" deb oʻylaydi, real sessiya ochiq qoladi | Blokni butunlay olib tashlash (backend tayyor boʻlmaguncha) |
| K8 | Frontend | `frontend/src/components/features/student/ContactInfoForm.tsx:13-16,59`, `NotificationPreferencesForm.tsx`, `ota-ona/sozlamalar/page.tsx:57-79` | Formalar "Saqlandi" deydi, lekin API chaqiruvi YOʻQ; ota-ona sozlamalarida hardcoded "Telegram ulangan" + begona mock bolalar ("Abdullayev Alisher") | Foydalanuvchi kontakt/bildirishnoma sozlamalarini yangiladim deb oʻylaydi — hech narsa saqlanmagan; begona ismlar ishonchni sindiradi | Endpoint bitmaguncha formalarni olib tashlash yoki "tayyorlanmoqda" holati |

### YUQORI — asosiy oqim ishlamaydi yoki chalgʻitadi

| № | Yoʻnalish | Joy | Muammo | Taʼsiri | Taklif |
|---|---|---|---|---|---|
| Y1 | Maʼlumot | `backend/app/services/payment_service.py:606-609` + `930-940` | `summary` roʻyxat filtridan KEYIN yigʻiladi — balansi 0 boʻlgan arxivlangan oʻquvchilar `charged`/`paid` dan tushib qoladi | Direktor "Tushum" koʻrsatkichi real kassadan KAM — ketgan-yopilganlarning butun yillik toʻlovi jamlanmada yoʻq | `summary`ni alohida SQL agregat bilan, filtrsiz hisoblash |
| Y2 | Maʼlumot | `backend/app/services/payment_service.py:154-197, 302-334` | Shartnoma oʻzgarsa eskisi arxivlanadi; oʻtgan oy uchun `generate_charges` keyin ishga tushirilsa hech qaysi shartnoma tanlanmaydi — qarz jimgina yozilmaydi | Oʻtgan oy qarzi yoʻqoladi — maktab pul yoʻqotadi | Oʻtgan oy uchun "oʻsha sanada amalda boʻlgan" shartnomani (arxividan ham) tanlash |
| Y3 | Maʼlumot | `backend/app/services/payment_service.py:180` vs docstring `310-314` | `set_contract` `starts_on`ni oy boshiga majburan suradi — 15-sentyabrda kelganga sentyabr uchun TOʻLIQ oylik qarz | Ota-onaga yarim oy uchun toʻliq qarz; docstring "birinchi oy qoʻlda" deydi, kod bunga yoʻl qoʻymaydi | Asl kunni saqlab generatsiyada istisno/proratsiya, yoki jarayonni hujjatlashtirish (kredit-yozuv bilan tuzatish) |
| Y4 | Maʼlumot | `backend/app/services/schedule_service.py:261-352` | Jadval oʻzgarsa/arxivlansa allaqachon yaratilgan KELAJAK darslar sinxronlashmaydi (kodda `Lesson.is_archived=True` qiladigan joy umuman yoʻq) | Bekor qilingan jadval boʻyicha darslar oʻquvchi/ota-ona/eski ustoz jadvalida koʻrinaveradi; yangi ustoz koʻrmaydi | Jadval oʻzgarganda davomatsiz kelajak darslarni qayta bogʻlash/arxivlash |
| Y5 | Maʼlumot | `backend/app/api/v1/director.py:58-61, 103-124, 151-165, 206-225` | Direktor paneli oʻz SQLʼini yozadi: davomat foizi filtrlarsiz va davrsiz, oʻrtacha baho vaznsiz `avg(value)`, ustoz yuklamasi butun tarixdan | Direktor koʻrgan foiz/baho/yuklama jurnal va jadval sahifalari bilan HECH QACHON mos kelmaydi | Formulalarni service qatlamiga jamlash (`attendance_stats`, `_average`, `teacher_load` qayta ishlatish) |
| Y6 | Xavfsizlik | `frontend/src/components/admin/PaymentsBoard.tsx:906-933` | `printReceipt` — `document.write`ga ism/izoh escape'siz qoʻshiladi | Ismiga HTML kiritilgan yozuv admin sessiyasida skript ishlatadi (saqlangan XSS) | escapeHtml yoki DOM `textContent` bilan qurish |
| Y7 | Maʼlumot | `backend/app/models/homework.py:159-166`, `grade_service.py:330-337` | `grades`da `(lesson_id, student_id)` unique YOʻQ — parallel soʻrovda dublikat baho | Oʻrtacha ikkalasini sanaydi, jurnalda bittasi koʻrinadi — raqamlar mos kelmaydi | Partial-unique indeks (`WHERE NOT is_archived AND submission_id IS NULL`) |
| Y8 | Frontend | `frontend/src/components/admin/EnrollWizard.tsx:93-174` | Arizalar navbati mock, lekin "Qabul qilish" REAL createStudent/createGuardian/setContract chaqiradi | Admin demo arizani tasdiqlasa **real bazaga soxta oʻquvchi va shartnoma yoziladi** | Demo navbatni olib tashlash, faqat "yangi ariza" oqimini qoldirish |
| Y9 | Frontend | `frontend/src/components/teacher/TodaySummary.tsx:19-33` | "N ta ish tekshirilmagan", "davomati past oʻquvchilar" — DEMO_HOMEWORK + localStorage, sinf "11-A" hardcoded | Ustoz soxta "amal talab qiladi" bloklari boʻyicha ish qiladi; havola real sahifaga olib boradi — u boshqa raqam koʻrsatadi | Real journal-api hisobiga ulash yoki blokni olib tashlash |
| Y10 | Maʼlumot | `frontend/src/lib/parent/data.ts:190` vs `lib/student/api.ts:196-198` | Davomat foizi ikki kabinetda ikki formulada (sababli=kelmagan vs sababli=kelgan) | Bir bola uchun ota-ona va oʻquvchi kabineti turli foiz koʻrsatadi | Foizni backend bersin (Y5 bilan birga yagona formula) |
| Y11 | Frontend | `frontend/src/app/(director)/rahbar/hisobotlar/page.tsx:8,50,55` + `lib/director/school-data.ts` | "Hisobotlar" butunlay mock (~400 uydirma oʻquvchi) + mock CSV eksport | Direktor qaror qabul qiladigan raqamlar toʻqima; eksport auditʼsiz (X-13) | Sahifani yopish/"DEMO" banner; real hisobotlar T-046+ |
| Y12 | Frontend | `frontend/src/app/(app)/student/reyting/page.tsx:5`, `student/ustozlar/page.tsx:8-9`, `/admin` bosh, `/admin/lidlar`, `/qongiroqlar`, `/shartnomalar`, `/admin/profil` | Toʻliq mock sahifalar (soxta sinfdoshlar reytingi, soxta moliya, seed lidlar) | Foydalanuvchi soxta ismlar/raqamlar koʻradi; yangilashda "maʼlumot yoʻqoladi" | Navʼdan olib qoʻyish yoki aniq DEMO belgisi; CRM real spetsifikatsiya kutmoqda |
| Y13 | Xavfsizlik | `backend/app/api/v1/school.py:112-127` → `school_service.py:427-472` | `GET /school/staff` — rol tekshiruvisiz, `login` maydoni bilan | Oʻquvchi/ota-ona barcha xodim loginlarini oladi (brute-force nishonlari; boshlangʻich parol 5 xonali raqam) | staff_wide bilan cheklash; loginni oddiy foydalanuvchiga qaytarmaslik |
| Y14 | Frontend | `frontend/src/components/admin/StaffBoard.tsx:610-617`, `teacher/test/page.tsx:263-270` | Xodim/test arxivlash — bir bosishda, tasdiqsiz, sababsiz (StudentCardʼda ikki bosqich + sabab bor — namuna mavjud) | Tasodifiy bosish — xodim hisobi darhol oʻchadi | StudentCard namunasidagi ikki bosqichli tasdiq |

### OʻRTA — noqulaylik, izchilsizlik

| № | Yoʻnalish | Joy | Muammo | Taklif |
|---|---|---|---|---|
| O1 | Maʼlumot | `attendance_service.py:351-355` | `excused` (sababli) maxrajda, suratda yoʻq — kasallik foizni "kelmadi" kabi tushiradi | Biznes-qaror: maxrajdan chiqarish yoki hujjatlashtirish |
| O2 | Maʼlumot | `attendance_service.py:381-400, 434-447` | Statistika `Lesson.is_archived`ni filtrlamaydi (hozircha lesson arxivlanmaydi — Y4 bilan bogʻliq) | Y4 yechilganda birga filtr qoʻshish |
| O3 | Maʼlumot | `attendance_service.py:74-75` | Kelajakdagi (hali boshlanmagan) darsga davomat belgilash mumkin | `starts_at` tekshiruvi qoʻshish |
| O4 | Maʼlumot | `payment_service.py:286-296` | Chegirma davri faqat oy 1-kuni bilan solishtiriladi — chekka oylarda kutilmagan natija | Qoidani hujjatlashtirish yoki oy kesishmasi boʻyicha qoʻllash |
| O5 | Maʼlumot | `payment_service.py:421-432` | Kvitansiya raqami `COUNT+1` — poygada dublikat; `receipt_no` unique emas | DB sequence yoki unique + retry |
| O6 | Maʼlumot | `payment_service.py:140-151` | Kelajak sanali shartnoma darhol "amaldagi" boʻlib koʻrinadi | `starts_on <= local_today()` sharti |
| O7 | Maʼlumot | `parent_service.py:255-264` vs `access.py:138-144` | `my_children` arxivlangan farzandni chiqaradi — qarzi qolgan ketgan bolaning toʻloviga ota-ona YETIB BORA OLMAYDI (ruxsat esa bor) | Balansi noldan farqli arxivlanganlarni "ketgan" belgisi bilan koʻrsatish |
| O8 | Maʼlumot | `access.py:128-136`, `grade_service.py:686` | Oʻquvchi arxivlanishi bilan sinf tarixiy statistikasidan yoʻqoladi — oʻtgan oy koʻrsatkichlari oʻzgarib ketadi | Tarixiy hisobotlarda arxiv filtrini davr bilan bogʻlash |
| O9 | Maʼlumot | `academic_service.add_holiday` + `lesson_service.py:503-513` | Taʼtil keyin qoʻshilsa oʻsha kundagi yaratilgan darslar qoladi | Taʼtil qoʻshilganda davomatsiz darslarni arxivlash/ogohlantirish |
| O10 | Maʼlumot | `grade_service.py:485-487, 573` | Jurnal qatori kaliti — sana: bir kunda bir fandan 2 dars boʻlsa ikkinchi baho koʻrinmaydi (oʻrtacha esa sanaydi) | Kalitga period qoʻshish |
| O11 | Maʼlumot | `grade_service.py:636-643` | Sana filtri darssiz (homework) baholarni chiqarib tashlaydi — filtrli/filtrsiz oʻrtacha farq qiladi | `or_(lesson_date >= x, lesson_id IS NULL)` |
| O12 | Maʼlumot | `academic_service.py:369` (`term_on` — hech qayerdan chaqirilmaydi) | Chorak chegarasi serverda majburlanmaydi — "chorak bahosi" hozircha clientdagi sana oraligʻi | JUR-04 da server tomonda qoʻllash |
| O13 | Xavfsizlik | `core/middleware.py:253-261` | Rate-limit kaliti tekshirilmagan Bearer tokendan — tasodifiy token bilan limit chetlab oʻtiladi (DB lockout qoladi) | Decode muvaffaqiyatsiz boʻlsa IP kalitiga qaytish |
| O14 | Xavfsizlik | `wellbeing_service.py:60-64` vs `:208-209` | Mavjud boʻlmagan oʻquvchi → 404, ruxsatsiz → 403 — id-enumeratsiya (X-3) | Ruxsat tekshiruvini oldin qoʻyish |
| O15 | Xavfsizlik | `payment_service.py:408-413` | `skip_permission` bayrogʻi public signaturada — kelajakda notekshirilgan chaqiruv xavfi | Webhook uchun alohida ichki funksiya |
| O16 | Xavfsizlik | `core/config.py` (`_assert_production_safe`) | `sinov_provider_key` va `trusted_proxies` prod tekshiruvida yoʻq — default kalit bilan prod ishga tushadi, audit IPʼlari 127.0.0.1 boʻlib qoladi | Ikkalasini prod tekshiruviga qoʻshish |
| O17 | Frontend | `frontend/src/components/director/DirectorTopbar.tsx:19-27` | Har direktor sahifasida DEMO_DIRECTOR ismi | `getUser()` dan olish (AdminShell buni toʻgʻri qiladi) |
| O18 | Frontend | `rahbar/page.tsx:180-184` | "Toʻlov moduli ulanmagan" eskirgan yozuv — /rahbar/tolovlar allaqachon ishlaydi | Real fetchSummary raqami |
| O19 | Frontend | `ota-ona/page.tsx:88`, `ota-ona/davomat/page.tsx:95` | `if (loading) return null` — sekin tarmoqda oq ekran | Shell + Skeleton |
| O20 | Frontend | `lib/grades.ts:16-30`, `lib/student/api.ts:188-198`, `EnrollWizard.tsx:301,852` | Chorak bahosi/foiz/chegirma frontendda hisoblanadi — backend bilan farq xavfi | Hisobni backendga koʻchirish |
| O21 | Frontend | `components/ui/BottomNav.tsx:17-41` | Pastki nav 7 band × 68px = 476px — 360px ekranga sigʻmaydi, asosiy bandlar koʻrinmaydi | 5 band + "Yana" menyusi |
| O22 | Frontend | `AuditLog.tsx:144`, `CallsBoard.tsx:97`, `ContractsBoard.tsx:92`, `LeadsBoard.tsx:95`, `ExportReportButton.tsx:30-34` | CSV eksport brauzerda quriladi — auditʼga tushmaydi (X-13) | Eksportni backend endpointidan berish |
| O23 | Frontend | `lib/teacher/plan-data.ts` (butun fayl) | ASCII `'` apostrofli reja sarlavhalari TopicField orqali BAZAGA yoziladi (8-qoida buziladi) | `'` → `ʻ` almashtirish yoki faylni olib tashlash |
| O24 | Frontend | `lib/format.ts:40` vs `lib/parent/data.ts:315` (formatSom ×2), `localToday` ×3, `formatMoment` ×4, davomat yorliqlari ×3 (`director/school-data.ts:429` "Sababsiz" — maʼno FARQLI!) | Takror utillar — bir kabinetda ikki xil pul formati, bir status ikki nom | Yagona lib/formatʼga jamlash |
| O25 | Kod | `.env.example` — `R2_BUCKET` IKKI marta; `PAYMENT_DUE_DAY`, `DB_POOL_*` yoʻq; R2/PAYME/CLICK kalitlari config.py oʻqimaydi | Konfiguratsiya drifti chalgʻitadi | Sinxronlash, dublikatni olib tashlash |
| O26 | Kod | `api/v1/director.py` — 17 ta select routerda | Router-service konvensiyasi buzilgan (yagona jiddiy joy) | `director_service.py`ga koʻchirish (Y5 bilan birga) |
| O27 | Kod | CLAUDE.md "TanStack Query" vs kod (yoʻq); `tarbion-claude-setup/` hujjat dublikati | Hujjat-kod nomuvofiqligi yangi dasturchini adashtiradi | Hujjatni haqiqatga moslash |
| O28 | Frontend | Admin UI'da oʻquv yilini yaratish/almashtirish YOʻQ (`academicCreateYear` va h.k. faqat testlarda) | Yangi oʻquv yili faqat qoʻlda API orqali ochiladi | Kalendar tabiga yil boshqaruvi |
| O29 | Frontend | `ota-ona/oshxona` — statik menyu (2026-08-29…09-04 sanalari qotirilgan) | Bir haftadan keyin eskirgan menyu | "Namuna" belgisi yoki yopish |

### PAST — kod tozaligi

| № | Joy | Muammo |
|---|---|---|
| P1 | 11 ta oʻlik frontend fayl (SurveyBuilder, director/{ClassesBoard,TeacherTable,ScheduleBuilder,PaymentsBoard,TeacherKpiPanel}, TestRunner, GradeTrend, ExamResultsCard, GradeBook, LessonPlanPanel + `lib/school/{quality,wellbeing,exams,hr}.ts` 1250+ satr mock) | Oʻchirish — kimdir adashib ulashi mumkin |
| P2 | `rahbar/ustozlar/[id]` | Yetim mock sahifa (navʼdan havola yoʻq) — oʻchirish yoki real endpointga ulash |
| P3 | `attendance_service.py:265` | `attendance_marked_at` qisman belgilashda ham qoʻyiladi |
| P4 | `attendance_service.py:493-498` | Tarixiy dars kartochkasida roster JORIY roʻyxatdan |
| P5 | `payment_service.py:723` | Kredit sanasi UTC kun (mahalliy emas) |
| P6 | `payment_service.py:811` | `payment_due_day` > 28 boʻlsa fevralda ValueError |
| P7 | `payment_service.py:1002-1031` | Parallel webhook retry — IntegrityError/500 ("allaqachon" oʻrniga) |
| P8 | `payments`/`tuition_charges`da `amount > 0` CHECK yoʻq (faqat servis) |
| P9 | `document_service.py:126` | Hujjat raqami yili UTC dan |
| P10 | `api/v1/director.py:95-97, 151-157` | `total_teachers` arxivlanganlarni sanaydi; sinf qatorida foiz va soni ikki xil toʻplamdan |
| P11 | `audit_query.py:119` | JSONB matnga ilike — indekssiz skan (audit cheksiz oʻsadi) |
| P12 | `lib/session.ts:25` fallback localhost (maqbul); `lib/teacher/plan-data.ts:3` — tashqi IP hardcode |
| P13 | `lib/admin/store.tsx:1202` | `today = new Date("2026-09-20")` qotirilgan "bugun" (mock store ichida) |
| P14 | Repo ildizida 4 ta jpg; `python-multipart` ishlatilishi topilmadi |
| P15 | Auth refresh-rotatsiya/reuse-detection uchun alohida test yoʻq; frontend testlari 0; Playwright yoʻq |
| P16 | Terminologiya: "Vazifalar" (BottomNav) vs "Uy vazifasi" (Sidebar); "Tushum" vs "toʻlov"; ContactInfoForm "Saqlash" (fe'l-qoida: "Oʻzgarishlarni saqlash") |
| P17 | Saqlanmagan oʻzgarish himoyasi faqat davomat sahifasida (yaxshi namuna bor — umumiy hook qilish) |
| P18 | `homework_service.py:419-429` | Vazifa bahosi oʻzgarishi auditʼda faqat submission sifatida (grade kesimida topilmaydi) |

---

## 4. ROL BOʻYICHA FOYDALANUVCHI TAJRIBASI

**Ota-ona** (eng koʻp aziyat chekadigan rol): Kirgach bosh sahifada farzandining davomatini koʻradi — bu real.
Lekin yonidagi toʻlov kartochkasi doim "Toʻlangan" deydi (K2) — u xotirjam boʻladi, keyin "Toʻlov"
sahifasiga kirsa real qarzni koʻradi va tizimga ishonchi yoʻqoladi. Yoki teskarisi — bosh sahifaga ishonib
toʻlamay yuradi. "Sozlamalar"da begona bolalar ismini koʻradi (K8) — "bu mening kabinetimmi?" degan
savol tugʻiladi. "Oshxona" menyusi eski haftani koʻrsatadi. Farzandi ketgan-u qarzi qolgan boʻlsa,
uni roʻyxatda umuman topa olmaydi (O7). Telefonda pastki menyuning oxirgi bandlari koʻrinmaydi (O21).

**Ustoz**: Bosh sahifada real darslarini koʻradi — yaxshi. Lekin "3 ta ish tekshirilmagan" bloki soxta (Y9):
bosib kirsa boshqa raqam. Davomat belgilaydi, saqlaydi — agar tarmoq uzilsa, hech qanday xato koʻrmaydi
va davomat yoʻqoladi (K4). Baho qoʻymoqchi boʻlsa — sinfi demo roʻyxatda boʻlmagani uchun jurnal paneli
umuman ochilmaydi (K3), ustoz "menda huquq yoʻq ekan" deb oʻylaydi. Jurnal sahifasining oʻzi esa ishlaydi —
ikki yoʻl ikki xil natija beradi.

**Direktor**: Bosh sahifa real, lekin sarlavhada oʻz ismi emas, demo-direktor ismi (O17). "Hisobotlar"ga
kirsa — chiroyli, batafsil… va butunlay uydirma raqamlar (Y11). "Sinflar"dagi real foizlar bilan
"Hisobotlar"dagi soxta foizlar yonma-yon yashaydi — qaysi biriga ishonishni bilmaydi. Bosh sahifada
"toʻlov moduli ulanmagan" deb yozilgan, holbuki "Toʻlovlar" sahifasi ishlaydi (O18). Real koʻrsatkichlar
ham jurnal bilan mos kelmaydi (Y5) — "nega sinf sahifasida 87%, panelda 84%?" degan savolga javob yoʻq.

**Oʻquvchi**: Asosiy oqimlar (jadval, vazifa topshirish, test yechish, baholar) real va yaxshi ishlaydi.
Lekin "Reyting"da soxta sinfdoshlar ismlarini koʻradi (Y12), "Ustozlar"da soxta roʻyxat. Profilda telefon
raqamini "saqlaydi" — aslida saqlanmaydi (K8); "Faol qurilmalar"dan sessiya "chiqaradi" — aslida chiqmaydi (K7).

**Administrator**: Eng qorishiq tajriba. "Oʻquvchilar", "Toʻlovlar", "Kadrlar", "Baza" — real va puxta.
Lekin bosh sahifa (dashboard) soxta moliya koʻrsatadi — "Toʻlovlar"dagi real raqamlar bilan toʻgʻri kelmaydi.
"Lidlar/Qoʻngʻiroqlar/Shartnomalar" — sahifa yangilanishida oʻzgarishi yoʻqoladigan demo. Eng xavflisi:
"Qabul" navbatidagi demo arizani tasdiqlasa, bazaga REAL soxta oʻquvchi yoziladi (Y8).

---

## 5. TUSHUNARSIZ QISMLAR (birga aniqlashtirish uchun)

1. **`payment_service.py:679`** — refund va storno farqi faqat `storno_of_id is None` orqali implicit;
   `LedgerRow.kind` docstringʼida (65-satr) "credit"/"refund" turlari yozilmagan. Ishlaydi, lekin turlar
   roʻyxati kod bilan mos emas — ataylabmi?
2. **`api/v1/director.py:210`** — yuklama `count(distinct schedule_entry_id)` NULL entryʼli darslarni
   sanamaydi. Hozircha darslar faqat generatsiyadan yaratiladi, lekin bu ataylab qilinganmi?
3. **Chorak bahosi (JUR-04)** umuman qaysi bosqichda? `GradeKind.TERM/ANNUAL` enumʼda bor, servis yoʻq,
   frontend `estimateQuarterGrade` bilan "taxmin" qiladi — bu vaqtinchalik yechimmi yoki unutilganmi?
4. **CRM bloklari** (lidlar, qoʻngʻiroqlar, shartnomalar) — TZʼda bormi? Backend modeli umuman yoʻq,
   frontend demo. Bu buyurtmaga kiradimi yoki keyingi bosqichmi — aniqlik kerak.
5. **`attendance_service.py:375-379`** — `attendance_stats` ichida lokal import bilan qayta
   `assert_can_view_student` chaqiruvi: shart allaqachon tekshirilgan, nima uchun takror — izohsiz.

---

## 6. TUZATISH REJASI (tartib: bogʻliqlik + jiddiylik; hajm: K=kichik ~1 soatgacha, O=oʻrta ~yarim kun, KT=katta 1+ kun)

**1-bosqich — topshirishdan oldin MAJBURIY (KRITIK):**
1. K5 — parol → sessiya revoke: tayyor `auth_service.change_password`ni ulash (K)
2. K6 — submit/test faqat oʻquvchining oʻzi (K)
3. K4 — saveAttendance xato holati (K)
4. K3 — canGrade → useMyTeaching (K)
5. K1 — baho oʻrtachasida shkala normalizatsiyasi + migratsiyasiz tuzatish mumkinligini tekshirish (O)
6. K7, K8 — soxta saqlash formalari va DeviceSecurityʼni olib tashlash (K)
7. K2 — ota-ona bosh sahifasini real APIʼga ulash (O)
8. Y6 — printReceipt escape (K)
9. Y8 — EnrollWizard demo navbatini oʻchirish (K)

**2-bosqich — asosiy oqimlar toʻgʻri koʻrsatsin (YUQORI):**
10. Y1 — summary SQL agregat (K)
11. Y5 + O26 — direktor formulalarini serviceʼga jamlash, davomat/baho yagona formula (O)
12. Y10 — davomat foizi backenddan (Y5 bilan birga) (K)
13. Y2, Y3 — shartnoma tarixiy lookup + birinchi oy siyosati (O)
14. Y7 — grades partial-unique migratsiya (K)
15. Y4 — jadval → kelajak darslar sinxroni (O)
16. Y13 — /school/staff cheklash (K)
17. Y9, Y11, Y12, O17, O18 — mock bloklarni olib tashlash/real API/DEMO banner (O, sahifama-sahifa)
18. Y14 — arxivlash tasdiqlari (K)

**3-bosqich — izchillik va tozalik (OʻRTA):**
19. O7 (arxivlangan farzand qarzi), O1 (excused siyosati — biznes-qaror), O5 (kvitansiya raqami), O13, O14, O15, O16 (K har biri)
20. O24 — format/util dedupe; O21 — BottomNav; O19 — skeletonlar; O23 — apostrof (K har biri)
21. O22 — eksport audit (O); O20 — frontend hisoblarni koʻchirish (O); O28 — oʻquv yili UI (O)
22. O25, O27 — .env va hujjat sinxroni (K)

**4-bosqich — texnik qarz (PAST):**
23. P1, P2 — oʻlik kodni oʻchirish (K); P15 — refresh-rotatsiya testi + Playwright kritik oqimlar (KT);
    qolgan P-bandlar navbat bilan (K har biri)

**Alohida (rejadagi ishlar, audit doirasidan tashqari):** bot + notification_outbox (T-017–T-019),
R2 fayl servisi, real toʻlov provayderlari, CRM spetsifikatsiyasi.
