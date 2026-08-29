# Jamoada ishlash qoidalari (2 kishi)

Bu loyiha ikki kishi tomonidan qilinyapti. Konflikt va bir xil ishni ikki marta
qilishning oldini olish uchun quyidagi tartibga amal qilinadi. `CLAUDE.md` dagi
domen qoidalari va kodlash konvensiyalari bundan tashqari, ular ham amal qiladi.

---

## 1. Branch tartibi

- `main` — doim ishlaydigan holatda. To'g'ridan to'g'ri `main`ga push qilinmaydi.
- Har bir task o'z branch'ida: `feat/T-013-davomat-api` (task kodi + qisqa nom).
- Tugagach — Pull Request oching, `main`ga shu orqali qo'shiladi.
- PR kamida **bitta boshqa sherik tomonidan ko'rib chiqilgach** merge qilinadi.
  Kichik/xatarsiz o'zgarish (masalan, matn xatosi) bundan mustasno.

## 2. Task olish tartibi

- Ishni boshlashdan oldin `TASKS.md` da o'sha taskni `[ ]` dan `[~]` ga
  o'zgartirib, shu o'zgarishni darhol push qiling — sherikingiz kimda nima
  ishda ekanini ko'rib turadi.
- Bir vaqtda ikkovi bitta taskni boshlamaydi. "Kerak" ustunidagi bog'liq task
  hali `[x]` bo'lmasa — boshlanmaydi, sherikka yozib qo'ying.
- Ishni to'xtatib qo'ysangiz (bloklandi, kutish kerak) — `[~]` ni qaytarib
  `[ ]` qiling va sababini yozing, boshqa odam davom ettira olsin.

## 3. Migratsiya konfliktlari (Alembic)

Eng ko'p konflikt shu yerda chiqadi — ikkovi parallel ravishda yangi model
qo'shsa, migratsiya zanjiri (`down_revision`) to'qnashadi.

- Migratsiya yozishdan **oldin** `main`dan `git pull`, eng oxirgi revisiyaga
  asoslaning.
- Migratsiya faylini task kodi bilan nomlang: `xxxx_t013_attendance_records.py`.
- PR ochishdan oldin `alembic upgrade head` bilan o'z branch'ingizda albatta
  tekshiring — chain uzilmaganini tasdiqlang.
- Agar merge paytida ikkita migratsiya to'qnashsa: kim keyin merge qilsa, o'sha
  o'z migratsiyasining `down_revision`'ini yangilab qayta yozadi (fayl nomini
  o'zgartirmaydi, faqat zanjirni tuzatadi).

## 4. `.env` va sekretlar

- Har kim o'z lokal `.env` faylini saqlaydi, git'ga tushmaydi.
- Yangi kalit qo'shsangiz — `.env.example`ga ham qo'shing va PR'da sheriklarga
  aytib qo'ying (Telegram/chat orqali), aks holda ularning muhiti ishlamay
  qoladi.

## 5. Aniq bo'lmagan biznes qoida

- `CLAUDE.md`dagi "taxmin qilma, so'ra" qoidasi shu loyiha egasiga tegishli,
  lekin ikkovingiz orasida ham izchillik kerak: bitta modulga tegishli
  noaniqlik chiqsa, avval bir-biringiz bilan kelishib, keyin egasidan so'rang —
  ikkovi bir xil savolni alohida-alohida bermasin.

## 6. `docs/DECISIONS.md`

- Texnik qaror (kutubxona tanlash, sxema o'zgarishi) yozishdan oldin, agar u
  ikkovingizga ham tegishli bo'lsa (masalan umumiy modul, umumiy kutubxona) —
  qisqa kelishib oling, keyin yozing. Faqat o'z modulingizga tegishli lokal
  qaror bo'lsa — yozib, xabar berish yetarli.

## 7. Commit va PR

- Commit format o'zgarmaydi: `feat(attendance): DAV-01 davomat belgilash`.
- PR tavsifida: qaysi task, qaysi "Tayyor" bandlari yopilgani, qanday test
  qilingani yoziladi.
- Bitta PR = bitta task. Aralashtirmang.

## 8. Aloqa

- Kim nima ustida ishlayotgani va bloklangan joylar haqida kundalik qisqa
  xabar almashing (masalan, ish kuni boshida/oxirida). Bu `TASKS.md`dagi
  `[~]` belgisidan tashqari, og'zaki/matnli tasdiq — fayl har doim ham
  darhol ko'rilmasligi mumkin.
