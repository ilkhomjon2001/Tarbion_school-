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

## 2026-08-29 · Rahbariyat kabineti — mock data bilan erta prototip (T-050 dan tashqarida)
`frontend/` ichida `/rahbar` (Direktor + Administrator) kabineti — bosh
sahifa (KPI/grafik), ustozlar roʻyxati va profili, sinflar, dars jadvali
quruvchisi, toʻlovlar, hisobotlar, murojaatlar — `lib/director/` orqali
soxta maʼlumot bilan qilindi. Bu rasman TASKS.md dagi T-050…T-053
(3-bosqich, DIR-01…DIR-08) bilan bir xil ish, lekin loyiha egasining
soʻroviga koʻra CLAUDE.md dagi bosqich tartibidan chetga chiqib erta
boshlandi (T-034 dagi kabi). Dars jadvali quruvchisi (`ScheduleBuilder`)
ustozning bir vaqtda ikki sinfda bandligini (ziddiyat) frontendda
ogohlantiradi — bu faqat UX yordamchisi, haqiqiy tekshiruv backend
tomonida boʻlishi kerak.

## 2026-08-29 · "Eslab qolish" va faol qurilmalar — frontend demo (AUT-09 kengaytmasi)
Loyiha egasi aniq muammo koʻrsatdi: oʻquvchilar maktab umumiy
kompyuterlariga kirib, hisobi ochiq qolib ketadi. TZ AUT-09 faqat kirish
jurnalini (sana/IP/qurilma) talab qiladi — faol qurilmalarni koʻrish va
bekor qilish, hamda "eslab qolish" tanlovi TZ'da yoʻq edi, lekin bu aniq
soʻrov boʻyicha qoʻshildi (TASKS.md T-004 ga izoh yozildi).

Backend hali yoʻq (T-004 bajarilmagan), shuning uchun hozircha faqat
frontend: `lib/auth.ts` — "eslab qolish" yoqilsa `localStorage`, boʻlmasa
`sessionStorage` (brauzer yopilsa/"Chiqish"da darhol oʻchadi). Profil
sahifasidagi "Faol qurilmalar" roʻyxati **namunaviy** — faqat joriy
qurilma haqiqiy (`navigator.userAgent`dan), qolganlari statik demo
maʼlumot. Bu haqiqiy xavfsizlik chegarasi emas; backendda `refresh_tokens`
jadvali (har biri alohida bekor qilinadigan) ulanganda almashtiriladi.

## 2026-08-29 · DIR-08 hisobot eksporti — XLSX/PDF emas, CSV
Rahbariyat hisobotlarini yuklab olish (DIR-08) uchun XLSX (`xlsx`/`exceljs`)
yoki PDF (`jspdf`) kutubxonasi ulanmadi — bitta demo tugma uchun ortiqcha
bog'liqlik. CSV browser ichida (`Blob` + `URL.createObjectURL`) hech qanday
kutubxonasiz generatsiya qilinadi va Excel'da to'g'ridan-to'g'ri ochiladi.
Backend qo'shilganda va real hisobot ehtiyoji kengaysa (formatlash, bir
nechta varaq) XLSX'ga o'tish mumkin.

## 2026-08-29 · Murojaat/xodim maʼlumoti — `lib/school/` yagona manbasi
Ilgari har kabinet ustozlarni va murojaatlarni oʻz mock faylida alohida
saqlar edi: ota-ona `/ota-ona/murojaat` dan yozgan murojaat rahbariyatga
umuman koʻrinmasdi. Endi `lib/school/staff.ts` (kim qaysi sinfda qaysi
fandan dars beradi, kim sinf rahbari) va `lib/school/appeals.ts` (barcha
murojaatlar + yozishmalar) — toʻrtala rol uchun ham yagona manba.
Backendda bular `teachers` + `teaching_assignments` + `appeals` +
`appeal_messages` jadvallariga almashtiriladi.

## 2026-08-29 · Murojaat mavzu boʻyicha emas, ADRESAT boʻyicha yoʻnaltiriladi
TZ MUR-02 "murojaat mavzusiga qarab masʼulga yoʻnaltiriladi" deydi. Loyiha
egasining soʻroviga koʻra ota-ona endi toʻgʻridan-toʻgʻri KIMGA yozishini
tanlaydi: rahbariyat / sinf rahbari / fan oʻqituvchisi (→ keyin fan).
Sabab: ota-ona koʻpincha aniq odam bilan gaplashmoqchi, mavzu tasnifi esa
noaniq boʻlib chiqadi. Har murojaat ochiq yozishma (chat) sifatida davom
etadi — bu ham TZ'da yoʻq, alohida soʻrov.

## 2026-08-29 · Tarbiyaviy va psixologik holat — TZ'dan tashqari
TZ'da bu boʻlim umuman yoʻq (matnda "psixolog"/"tarbiyaviy" soʻzi
uchramaydi). Loyiha egasi soʻrovi bilan qoʻshildi: tarbiyaviy izohni sinf
rahbari va fan oʻqituvchilari, psixologik xulosani faqat maktab psixologi
kiritadi. Yangi rol: `psychologist`. Maʼlumot nozik — backendda faqat
vasiy, sinf rahbari, psixolog va rahbariyat koʻra olishi soʻrov darajasida
cheklanishi SHART (CLAUDE.md 6-qoida), har biriga alohida test kerak.

## 2026-08-29 · Oshxona menyusi oʻquvchidan ota-onaga koʻchirildi
Menyu endi faqat `/ota-ona/oshxona` da. Sabab (loyiha egasi): ovqatni
ota-ona tanlaydi va toʻlaydi, oʻquvchiga koʻrsatish shart emas. Eslatma:
TZ 10-boʻlimi boʻyicha oshxona moduli shartnoma doirasidan tashqarida.

## 2026-08-30 · TZ hisoboti bekor — talab endi loyiha egasidan keladi
Loyiha egasi: "TZ da yoʻq juda koʻp narsalar qoʻshiladi, TZ boʻyicha
hisobot bermaymiz ham; TZ eng kam talab". Shu sabab bundan keyin yangi
funksiya TZ'da yoʻqligi uchun soʻroq qilinmaydi — TZ minimal chegara
sifatida qoladi, ustiga qoʻshilgani normal holat. DIR-xx/MUR-xx kabi
kodlar kodda izoh sifatida qoladi (kelib chiqishini bilish uchun), lekin
qamrov argumenti sifatida ishlatilmaydi.

## 2026-08-30 · Demo oʻquvchilar qoʻlda emas, deterministik generatsiya
16 sinf va ~370 oʻquvchi uchun mock maʼlumotni qoʻlda yozish amaliy emas.
`lib/director/school-data.ts` ism fondidan FNV-1a xesh asosida barqaror
generatsiya qiladi: bir xil sinf har safar bir xil oʻquvchi, toʻlov va
davomatni beradi (sahifa yangilanganda raqam sakramaydi).
Diqqat: bit siljitishda `>>` emas, `>>>` ishlatiladi — `>>` uint32 ni
int32 ga aylantirib manfiy indeks berib qoʻygan va build buzilgan edi.

## 2026-08-30 · Rahbariyat ustoz/sinf roʻyxati ham `lib/school/` dan
`lib/director/data.ts` dagi qoʻlda yozilgan `teachers` va `schoolClasses`
olib tashlandi — endi `lib/school/staff.ts` + `school-data.ts` dan hosil
qilinadi. Ustoz yuklamasi (`weeklyLoadHours`) ham qoʻlda emas, haqiqiy
dars biriktirmalari yigʻindisidan hisoblanadi.

## 2026-08-30 · Harakat qatlami `globals.css` da, komponentda emas
Animatsiya har komponentda alohida yozilsa, davomiylik va egri chiziq
har joyda boshqacha boʻlib ketadi. Shu sabab bitta manba:
`--ease-out-soft`, `--duration-fast/base` tokenlari va `animate-enter`,
`animate-expand`, `skeleton`, `bar-fill`, `card-interactive`,
`focus-ring`, `scroll-x` utilitalari. Komponentda xom `@keyframes` yoki
ixtiyoriy `duration-*` yozilmaydi.

`prefers-reduced-motion: reduce` butun loyihada animatsiya va
oʻtishlarni oʻchiradi — vestibulyar buzilishlarda siljish bosh
aylanishiga sabab boʻladi. Interfeys ishlaydi, faqat harakatsiz.

## 2026-08-30 · Skeleton kontent shaklini takrorlaydi
`<Card className="h-96 animate-pulse" />` kabi boʻsh kulrang qutilar
oʻrniga `StatCardSkeleton` / `ChartSkeleton` / `TableSkeleton`. Sabab:
maʼlumot kelganda sahifa sakramaydi (layout shift) va foydalanuvchi nima
kutayotganini oldindan koʻradi.

## 2026-08-30 · Xatolik va yuklanish chegaralari qoʻshildi
Loyihada `error.tsx` / `loading.tsx` umuman yoʻq edi — server
komponentidagi har qanday xato Next.js ning inglizcha standart ekranini
koʻrsatardi. Endi: ildizda `error.tsx` + `not-found.tsx`, rahbariyat
boʻlimida oʻz `error.tsx` (sidebar joyida qoladi) va `loading.tsx`.
Backend ulanganda `console.error` oʻrniga kuzatuv xizmatiga yuboriladi.

## 2026-08-30 · Eski bundle xatosi alohida ajratiladi
Ilova qayta qurilganda (deploy yoki dev serverni qayta ishga tushirish)
brauzerda ochiq turgan sahifa eski JS boʻlaklarini soʻrashda davom etadi —
ular serverda yoʻq va sahifa xatolik chegarasiga tushadi. Bunda `reset()`
foydasiz: boʻlak qaytib kelmaydi. `lib/errors.ts` shu holatni aniqlaydi
(ChunkLoadError va shunga oʻxshash xabarlar) va tugmani "Sahifani
yangilash" ga (`location.reload()`) almashtiradi.
