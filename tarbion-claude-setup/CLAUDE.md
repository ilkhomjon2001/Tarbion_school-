# Tarbion — maktab boshqaruv platformasi

Bu fayl har bir sessiyada avtomatik o'qiladi. Kod yozishdan oldin shu yerdagi
qoidalarga amal qil. Ziddiyat chiqsa: `docs/TZ.pdf` (texnik topshiriq) ustun turadi.

---

## Loyiha nima

"Tarbion" xususiy maktabi uchun veb-platforma. To'rtta rol, to'rtta kabinet:

| Rol | Nima qiladi |
|---|---|
| Ustoz | Davomat, baho, uy vazifasi, testlar, metodik baza |
| O'quvchi | Jadval, uy vazifasi, testlar, o'z natijalari |
| Ota-ona (vasiy) | Farzandi bo'yicha davomat, baho, to'lov, murojaat |
| Direktor | Hisobotlar va analitika (ma'lumot kiritmaydi) |

Qo'shimcha: Administrator (ma'lumotnomalar, jadval, to'lov) va Sinf rahbari
(ustoz + o'z sinfi bo'yicha kengaytirilgan huquq).

**Mobil ilova YO'Q.** Veb, mobile-first, 360px dan boshlab.

---

## Stack

```
backend/     Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · Alembic · Pydantic v2
db           PostgreSQL 16
frontend/    Next.js 15 (App Router) · TypeScript · Tailwind v4 · TanStack Query
bot/         aiogram 3 (backend bilan umumiy DB)
fayllar      Cloudflare R2 (S3-mos, boto3) — presigned URL
test         pytest + pytest-asyncio (backend), Playwright (kritik oqimlar)
```

Redis **ishlatilmaydi**. Fon vazifalari `notification_outbox` jadvali + alohida
worker sikli orqali (T-018 ga qara).

---

## Repo tuzilishi

```
tarbion/
├── CLAUDE.md              ← shu fayl
├── TASKS.md               ← backlog, ishni shu yerdan ol
├── docs/
│   ├── TZ.pdf             ← texnik topshiriq (talab kodlari manbasi)
│   └── DECISIONS.md       ← qabul qilingan texnik qarorlar jurnali
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/          config, security, deps, exceptions
│   │   ├── models/        SQLAlchemy modellari
│   │   ├── schemas/       Pydantic sxemalari
│   │   ├── api/v1/        router'lar (bitta modul = bitta fayl)
│   │   ├── services/      biznes mantiq (router'da mantiq yozilmaydi)
│   │   └── workers/       outbox worker, cron vazifalar
│   ├── alembic/
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/(auth)/    login, parolni tiklash
│       ├── app/(app)/     kabinetlar — rol bo'yicha layout
│       ├── components/    ui/ (primitivlar) + features/
│       ├── lib/           api client, auth, utils
│       └── styles/
└── bot/
    ├── handlers/
    └── main.py
```

---

## Domen qoidalari — bularni buzma

Bular eng ko'p xato qilinadigan joylar. Har birining sababi bor.

1. **Hech narsa o'chirilmaydi.** `DELETE` yo'q. Har bir jadvalda `is_archived`
   (yoki `archived_at`). O'quvchi maktabdan chiqsa — arxivlanadi, chunki uning
   o'tgan yilgi baholari va to'lovlari hisobotda qolishi kerak.

2. **Pul — `BIGINT`, so'mda.** `float` ishlatilmaydi. Tiyin yo'q. 5 000 000 so'm
   bazada `5000000`.

3. **Vaqt — UTC da saqlanadi**, `Asia/Tashkent` da ko'rsatiladi. Bazada har doim
   `TIMESTAMPTZ`. "Bugungi davomat" hisoblanganda mahalliy kun chegarasi olinadi,
   UTC kuni emas.

4. **Baho, davomat, to'lovdagi har o'zgarish → `audit_log`.** Eski qiymat, yangi
   qiymat, foydalanuvchi, vaqt. Audit yozuvi o'chirilmaydi va tahrirlanmaydi.

5. **Davomat 24 soatdan keyin ustoz uchun yopiladi** (DAV-03). Faqat administrator
   o'zgartira oladi va bu audit'ga tushadi.

6. **Ota-ona faqat o'z farzandini ko'radi.** Bu tekshiruv **query darajasida**
   bo'lsin — `WHERE student_id IN (vasiyning farzandlari)`. Frontend'da yashirish
   yetarli emas. Har bir endpoint uchun shu holatga test yoz.

7. **Rol tekshiruvi har doim serverda.** Frontend'dagi ko'rinishni boshqarish —
   qulaylik, himoya emas.

8. **O'zbekcha matnda apostrof — `ʻ` (U+02BB).** `'` yoki `'` emas. Bu qidiruvni
   va shrift renderini buzadi. Butun loyihada bir xil.

9. **To'lov yozuvi o'chirilmaydi va tahrirlanmaydi.** Xato bo'lsa — storno yozuvi
   qo'shiladi (TOL-07).

10. **Fayl bazada saqlanmaydi.** R2 ga yuklanadi, bazada faqat kalit. Yuklab olish
    presigned URL orqali, muddati 15 daqiqa.

---

## Kodlash konvensiyalari

**Backend**
- Router faqat: validatsiya → service chaqiruvi → javob. Biznes mantiq `services/` da.
- Har bir endpoint `response_model` bilan. `dict` qaytarilmaydi.
- Xatolar `core/exceptions.py` dagi maxsus klasslar orqali → global handler.
- Migratsiyasiz model o'zgarishi bo'lmaydi. Model o'zgardi = `alembic revision --autogenerate`.
- Nomlash: jadval `snake_case` ko'plikda (`students`, `attendance_records`).

**Frontend**
- Server Component sukut bo'yicha. `"use client"` faqat kerak bo'lganda.
- Ma'lumot olish — TanStack Query, `lib/api` orqali. `fetch` komponent ichida yozilmaydi.
- Tailwind v4, `@theme` da token. Kodda xom hex yozilmaydi.
- Komponent holatlari to'liq: default / hover / focus-visible / disabled / loading / empty / error.
- Interfeys matni — o'zbekcha, fe'l bilan ("Saqlash" emas, "O'zgarishlarni saqlash").

**Umumiy**
- Kod va o'zgaruvchilar — inglizcha. Izohlar va UI matni — o'zbekcha.
- Commit: `feat(attendance): DAV-01 davomat belgilash` — tur, modul, TZ kodi.
- Bitta commit = bitta task. Aralashtirma.

---

## Sen qanday ishlaysan

1. `TASKS.md` dan **bitta** task ol. Bir vaqtda bir nechta taskni boshlama.
2. Taskdagi TZ kodlarini `docs/TZ.pdf` dan o'qib chiq — tavsif to'liqroq.
3. Aniq bo'lmagan joy bo'lsa — **taxmin qilma, so'ra.** Ayniqsa biznes qoidalarida.
4. Kod yoz → migratsiya → test → qo'lda tekshir.
5. `TASKS.md` da tegishli katakchani belgila.
6. Texnik qaror qabul qilsang (kutubxona tanlash, sxema o'zgarishi) —
   `docs/DECISIONS.md` ga 2-3 qatorda sabab bilan yoz.

**Qilma:**
- TZ'da yo'q funksiyani "foydali bo'lardi" deb qo'shma. Avval so'ra.
- Ishlayotgan migratsiyani tahrirlama — yangisini yoz.
- Test'ni o'tkazish uchun testni o'zgartirma.
- Bir necha faylni bir vaqtda katta hajmda qayta yozma — kichik qadamlar.
- Sekret, token, parolni kodga yozma. Hammasi `.env` da, `.env.example` yangilanadi.

---

## Bosqichlar

| Bosqich | Muddat | Tarkib | Holati |
|---|---|---|---|
| 1 | 1–4 hafta | Auth, ma'muriy yadro, davomat, ota-ona kabineti, bot | Ishda |
| 2 | 5–10 hafta | Metodik baza, uy vazifasi, jurnal, murojaatlar | Kutilmoqda |
| 3 | 11–14 hafta | Testlar, to'lov, direktor paneli, hujjatlar | Kutilmoqda |

Bosqich topshirilishi to'lovga bog'langan. 1-bosqich tugamaguncha 2-bosqich
tasklariga o'tma.

---

## Muhit

```bash
# backend
cd backend && uv sync && alembic upgrade head
uvicorn app.main:app --reload

# frontend
cd frontend && pnpm install && pnpm dev

# bot
cd bot && python main.py

# testlar
cd backend && pytest -q
```

`.env` kalitlari `.env.example` da. Yangi kalit qo'shsang — ikkalasini ham yangila.
