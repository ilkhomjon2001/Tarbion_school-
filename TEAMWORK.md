# Jamoada ishlash qoidalari (2 kishi)

Bu loyiha ikki kishi tomonidan qilinyapti. Konflikt va bir xil ishni ikki marta
qilishning oldini olish uchun quyidagi tartibga amal qilinadi. `CLAUDE.md` dagi
domen qoidalari va kodlash konvensiyalari bundan tashqari, ular ham amal qiladi.

---

## 1. Ish tartibi

**Branch va PR yo'q.** Ikkalamiz ham to'g'ridan-to'g'ri `main` da ishlaymiz —
robbitquiz loyihasidagidek. U yerda bu usul muammosiz ishlagan.

- Kunni `git pull` bilan boshlang.
- Push qilishdan **oldin yana `git pull`** qiling. Shu bitta odat konfliktning
  90 foizini yo'q qiladi.
- Tez-tez push qiling — kuniga bir marta emas. Har bir tugagan bo'lak
  push qilinsa, konflikt kichik va yechishga oson bo'ladi.
- `git push --force` **hech qachon** ishlatilmaydi.

To'liq tartib va konflikt yechish: `docs/GIT.md`.

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

- Migratsiya yozishdan **oldin** `git pull` qiling, eng oxirgi revisiyaga
  asoslaning.
- Migratsiya faylini task kodi bilan nomlang: `xxxx_t013_attendance_records.py`.
- Push qilishdan oldin `alembic upgrade head` bilan albatta tekshiring —
  chain uzilmaganini tasdiqlang.
- Agar `git pull` paytida ikkita migratsiya to'qnashsa: kim keyin pull qilsa,
  o'sha o'z migratsiyasining `down_revision`'ini yangilab qayta yozadi (fayl
  nomini o'zgartirmaydi, faqat zanjirni tuzatadi).

## 4. `.env` va sekretlar

- Har kim o'z lokal `.env` faylini saqlaydi, git'ga tushmaydi.
- Yangi kalit qo'shsangiz — `.env.example`ga ham qo'shing va sherigingizga
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

## 7. Commit

- Commit format o'zgarmaydi: `feat(attendance): DAV-01 davomat belgilash`.
- Bitta commit = bitta task. Aralashtirmang.
- Commit xabarida: qaysi task, qaysi "Tayyor" bandlari yopilgani. Test qilingan
  bo'lsa — nima tekshirilgani.

## 8. Aloqa

- Kim nima ustida ishlayotgani va bloklangan joylar haqida kundalik qisqa
  xabar almashing (masalan, ish kuni boshida/oxirida). Bu `TASKS.md`dagi
  `[~]` belgisidan tashqari, og'zaki/matnli tasdiq — fayl har doim ham
  darhol ko'rilmasligi mumkin.
