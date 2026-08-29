---
description: TASKS.md dan bitta taskni to'liq bajarish
argument-hint: "[task kodi, masalan T-013]"
---

`TASKS.md` dan **$1** taskini bajarasan. Quyidagi tartibni buzma.

## 1. Tushunish

- `TASKS.md` dan $1 ni o'qi: tavsif, TZ kodlari, "Tayyor" ro'yxati.
- Taskda ko'rsatilgan TZ kodlarini `docs/TZ.pdf` dan topib o'qi — u yerda tavsif to'liqroq.
- `CLAUDE.md` dagi domen qoidalarini eslab qol, ayniqsa: soft delete, pul BIGINT,
  vaqt UTC, audit, ota-ona faqat o'z farzandini ko'radi.
- "Kerak" ustunidagi tasklar bajarilganini tekshir. Bajarilmagan bo'lsa — to'xta va ayt.

## 2. Reja

Kod yozishdan **oldin** qisqa reja ber:
- qaysi fayllar yaratiladi/o'zgaradi
- baza sxemasiga qanday o'zgarish kiradi
- qanday testlar yoziladi
- aniq bo'lmagan joylar bormi

**Aniq bo'lmagan biznes qoidasi bo'lsa — taxmin qilma, so'ra.** Masalan: "sababli
qoldirishni sinf rahbari tasdiqlashi kerakmi yoki avtomatik qabul qilinsinmi?"

Rejani tasdiqlashimni kut.

## 3. Bajarish

- Model → migratsiya → schema → service → router → frontend tartibida.
- Router'da biznes mantiq yozma, `services/` ga qo'y.
- Har bir yangi endpoint uchun rol va ma'lumotga kirish testi yoz
  (`CLAUDE.md` 6- va 7-qoidalar).
- Migratsiyani `alembic revision --autogenerate` bilan yarat va **ko'zdan kechir** —
  autogenerate ba'zan ortiqcha o'zgarish yozadi.

## 4. Tekshirish

- `pytest -q` — hammasi o'tishi shart.
- "Tayyor" ro'yxatidagi har bir bandni **bittalab** tekshir va natijani ayt.
- Frontend bo'lsa: 360px va 1280px da ko'rinishini tekshir, loading/empty/error
  holatlari borligini tasdiqla.

## 5. Yopish

- `TASKS.md` da $1 ning katakchalarini `[x]` qil.
- Texnik qaror qabul qilgan bo'lsang — `docs/DECISIONS.md` ga 2-3 qatorda yoz.
- Commit: `feat(<modul>): <TZ kodlari> <qisqa tavsif>`
- Keyingi taskka **o'zing o'tma**. Nima qilinganini xulosa qilib to'xta.

## Cheklovlar

- TZ'da yo'q funksiyani qo'shma.
- Boshqa tasklarning fayllarini "yo'l-yo'lakay" tuzatma.
- Testni o'tkazish uchun testni yumshatma.
- Sekretni kodga yozma.
