# Texnik qarorlar jurnali

Har bir muhim texnik qaror shu yerga yoziladi: sana, qaror, sabab.
Format qisqa — 2-3 qator yetadi. Maqsad: 3 oydan keyin "nega shunday qilingan"
degan savolga javob bo'lishi.

---

## 2026-08-29 · Redis o'rniga outbox jadvali
Fon vazifalari va xabarnomalar uchun Redis/Celery emas, `notification_outbox`
jadvali va oddiy worker sikli tanlandi. Sabab: bitta VPS, kichik yuk, kamroq
harakatlanuvchi qism. Yuk oshsa arq/Celery ga o'tish oson.

## 2026-08-29 · Pul BIGINT so'mda
`Numeric` yoki `float` emas, `BIGINT` so'mda. Sabab: O'zbekistonda tiyin amalda
ishlatilmaydi, suzuvchi nuqta xatolari yo'q bo'ladi.

## 2026-08-29 · Hard delete yo'q
Barcha modellarda `is_archived`. Sabab: o'quvchi maktabdan chiqsa ham uning
o'tgan davr baholari va to'lovlari hisobotda qolishi kerak.

## 2026-08-29 · O'quvchi kabineti — mock data bilan erta prototip (T-034 dan tashqarida)
`frontend/` (Next.js 15) ichida o'quvchi kabineti (bosh sahifa, jadval, uy
vazifasi, testlar, baholar/davomat, e'lonlar) `lib/mock/` orqali soxta
ma'lumot bilan qilindi — backend hali yo'q (T-001 ham bajarilmagan). Bu
rasman TASKS.md dagi T-034 (2-bosqich) bilan bir xil ish, lekin loyiha
egasining "tezroq demo ko'rish" so'roviga ko'ra CLAUDE.md dagi bosqich
tartibidan chetga chiqib erta boshlandi. `lib/mock/fetchers.ts` real API
bilan almashtirilganda komponentlar o'zgarmasligi uchun funksiya
imzolari kelajakdagi endpoint javoblariga mos shakllantirilgan.
