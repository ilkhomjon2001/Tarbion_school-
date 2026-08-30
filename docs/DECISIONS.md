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

## 2026-08-30 · Administrator kabineti — mijoz tomonidagi umumiy holat
Boshqa kabinetlar server komponentlari va `delay()` bilan ishlaydi, admin
esa boshqacha: u maʼlumot KIRITADI va kiritgani boshqa boʻlimlarda darhol
koʻrinishi kerak (toʻlov kiritildi → qarzdorlar roʻyxatidan chiqdi →
bosh sahifadagi raqam kamaydi → audit jurnaliga tushdi).

Shu sabab `lib/admin/store.tsx` — layout darajasidagi context + reducer.
Holat sahifalar orasida saqlanadi, brauzer yangilanganda boshlangʻich
holatga qaytadi (loyiha egasi bilan shunday kelishilgan; localStorage
tanlanmadi — sherikning maʼlumoti bilan farq qilib ketardi).

Boshlangʻich maʼlumot `lib/admin/seed.ts` da YARATILMAYDI, balki
`lib/director/school-data.ts` va `lib/school/staff.ts` dan olinadi —
admin, rahbariyat, ustoz va ota-ona bitta maktabni koʻradi. Backend
ulanganda reducer'ning har bir `case` i bitta API chaqiruviga aylanadi,
komponentlar oʻzgarmaydi.

Domen qoidalari reducer darajasida: toʻlov yozuvi tahrirlanmaydi, faqat
storno (9-qoida); oʻquvchi oʻchirilmaydi, arxivlanadi (1-qoida); har bir
amal `AuditEntry` qoldiradi (4-qoida).

## 2026-08-30 · Login rol boʻyicha yoʻnaltiradi
Avval login har doim `/student` ga olib borardi — beshinchi kabinet
qoʻshilgach bu yaroqsiz boʻldi. `lib/roles.ts` da rol → kabinet
xaritasi, login sahifasida DEMO uchun rol tanlagichi. Rol sessiyada
saqlanadi (`lib/auth.ts`), lekin bu HIMOYA EMAS — backend ulanganda rol
JWT ichidan keladi va tekshiruv serverda boʻladi (7-qoida).

## 2026-08-30 · PDF — brauzerning chop etish oynasi orqali
Maʼlumotnomani PDF qilish uchun jsPDF/pdfmake kabi kutubxona ulash
kerak boʻlardi (~200 KB bitta tugma uchun). Oʻrniga `globals.css` da
`@media print` qoidasi: hujjatdan boshqa hamma narsa yashiriladi va
`window.print()` chaqiriladi. Brauzerning "PDF sifatida saqlash"
imkoniyati haqiqiy PDF beradi. Backend ulanganda server tomonda
generatsiya qilinadi (muhr va imzo bilan).

## 2026-08-30 · Yozishmalar admin do'koniga koʻchirildi
Admin ota-onaga BIRINCHI boʻlib yoza olishi kerak edi, lekin murojaatlar
`lib/school/appeals.ts` dagi oʻzgarmas massivda turardi. Endi
`buildAppeals()` uni admin do'koniga chuqur nusxalaydi; `AppealThread`
ikki rejimli boʻldi — `onSend`/`onClose` berilsa yozishma tashqaridan
boshqariladi (admin), berilmasa komponentning oʻz holatida qoladi
(ota-ona va ustoz kabinetlari). Backend ulanganda ikkala rejim ham bitta
`appeal_messages` API chaqiruviga tushadi.

## 2026-08-30 · Sinf va fan maʼlumotnomasi admin do'konida
"Maʼlumot bazasi" boʻlimi boshqaruvni vaʼda qilardi-yu, sinf va fan
roʻyxati faqat oʻqish edi. Endi `classes`/`subjects` do'konda: sinf
ochish, sinf rahbari va sigʻimni oʻzgartirish, fan qoʻshish va rejadan
chiqarish. Boshlangʻich roʻyxat baribir `lib/school/staff.ts` dan
chiqadi. DEMO cheklovi: admin qoʻshgan sinf faqat admin kabinetida
koʻrinadi — boshqa kabinetlar hamon umumiy modulni oʻqiydi. Qabul,
toʻlov, oʻquvchilar va soʻrovnoma roʻyxatlari esa do'kondan oladi,
shuning uchun yangi sinf u yerlarda darhol tanlanadi.

## 2026-08-30 · Bildirishnomalar saqlanmaydi, hisoblanadi
Qoʻngʻiroqdagi roʻyxat alohida jadval emas — `useNotifications()` joriy
holatdan hisoblaydi (koʻrilmagan ariza, navbatdagi maʼlumotnoma, muddati
oʻtgan toʻlov, javobsiz murojaat, tugallanmagan soʻrovnoma). "Oʻqilgan"
holatini yuritish kerak emas: ish bajarilishi bilan bildirishnoma oʻzi
yoʻqoladi va son kamayadi.

## 2026-08-30 · Administrator — toʻqilgan ism emas, xodim yozuvi
`ADMIN_NAME` alohida konstanta edi va xodimlar roʻyxatidagi administrator
bilan mos kelmasdi. Endi `STAFF` dagi `role: "admin"` yozuvidan olinadi
(`ADMINISTRATOR`), profil esa do'konda saqlanadi. Audit yozuvidagi "kim"
ustuni `state.profile.fullName` dan yoziladi — profil oʻzgarsa faqat
KEYINGI yozuvlar yangi ism bilan tushadi, eskilari tegilmaydi (4-qoida).

## 2026-08-30 · Barcha kabinetlarga AuthGuard, rol bilan
Avval faqat oʻquvchi kabineti tekshirilardi; `/teacher`, `/ota-ona`,
`/rahbar`, `/admin` manzillari login qilmasdan ochilardi. Endi har bir
route guruhida `AuthGuard role="…"`: sessiya yoʻq boʻlsa `/login` ga,
rol boshqa kabinetniki boʻlsa oʻz kabinetiga qaytaradi. Bu HIMOYA EMAS
(7-qoida) — faqat toʻgʻri xatti-harakat. Yon taʼsiri: himoyalangan
sahifalar serverda boʻsh render qilinadi va tarkib gidratsiyadan keyin
chiqadi.

## 2026-08-30 · Huquqlar ikki qavatli: rol standarti + foydalanuvchi istisnosi
Maktab rahbari "super admin userlarga boʻlimlarni koʻrinadigan qilib
beradi" degan edi — yaʼni huquq ROL emas, ODAM darajasida. Shuning uchun
`lib/access.ts` da barcha kabinetlarning boʻlimlari reyestri, ustiga ikki
qavat: `ROLE_DEFAULT_SECTIONS` (yangi foydalanuvchi shuni oladi) va
`UserAccount.sections` (`null` boʻlsa standart, massiv boʻlsa istisno).
Kabinet boshi qulflangan — aks holda odam oʻz kabinetiga kira olmay
qoladi. Boʻlim manzili (`/admin/tolovlar`) ayni paytda kalit ham:
navigatsiya va reyestr bir joydan chiqadi, ikkinchi roʻyxat yuritilmaydi.

DEMO cheklovi: huquqlar admin do'konida yashaydi, shuning uchun
filtrlash faqat admin kabinetining menyusida ishlaydi. Boshqa kabinetlar
provider'dan tashqarida render qilinadi — ularga backend ulanganda
qoʻllanadi. Baribir bu HIMOYA EMAS (7-qoida): tekshiruv serverda.

## 2026-08-30 · Super administrator — rol, alohida kabinet emas
Super admin ham `/admin` da ishlaydi, farqi faqat "Sozlamalar" boʻlimi va
toʻliq huquq. Alohida kabinet qurish ikki marta menyu, ikki marta qidiruv
degani boʻlardi. `ROLE_CABINET` xaritasi qoʻshildi — AuthGuard rolni emas,
KABINETNI solishtiradi.

## 2026-08-30 · Shartnoma harakati qoʻlda kiritilmaydi
"Kelgan-ketgan" bazasi alohida forma emas: qabul qilinganda `start`,
arxivlanganda sabab va sana bilan `end` yozuvi tushadi. Shu sabab jadval
haqiqiy amallardan orqada qolmaydi. Arxivdan qaytarish eski `end` yozuvini
oʻchirmaydi — yangi `start` qoʻshadi, aks holda yil yakunidagi
"nechta kirdi / nechta chiqdi" notoʻgʻri chiqardi.

## 2026-08-30 · Ustoz KPI — toʻrtta koʻrsatkich, toʻrtinchisi taklif
Rahbar toʻrtta KPI aytgan, uchtasini eslagan: oylik imtihon natijasi,
ichki qoidalarga amal qilish, ota-ona bilan hamkorlik. Toʻrtinchi oʻrniga
"Jurnal va davomat intizomi" taklif qilindi — u allaqachon oʻlchanadigan
maʼlumot (davomat 24 soat ichida belgilangan darslar ulushi). Interfeysda
"Taklif — tasdiqlanmagan" belgisi bilan turadi, tasdiqlangach belgisi
olib tashlanadi yoki koʻrsatkich almashtiriladi. Har bir ball ostida
nimadan hisoblangani yozilgan: rahbar raqamni tekshira olmasa KPI
ishonchsiz boʻlib qoladi.

## 2026-08-30 · Imtihonlar — yagona manba, holat sanadan
`lib/school/exams.ts` — imtihon jadvali va natijalari uchun YAGONA manba.
Oʻquv boʻlimi kiritadi; ustoz KPI si, oʻquvchi va ota-ona kabinetlari
aynan shu yerdan oʻqiydi, ikkinchi roʻyxat yuritilmaydi.

Imtihon holati (`rejada` / `otkazildi`) SANADAN chiqadi, qoʻlda
yozilmaydi. Birinchi urinishda bosqichga qoʻlda `status` bergan edim —
natijada oktabr imtihonlari «oʻtkazildi» deb koʻrinib, natijasi
boʻlmasdi. Sanadan hisoblaganda bunday ziddiyat boʻlmaydi.

Imtihon bali oʻquvchining davomatiga bogʻlangan: kam qatnashgan
oʻquvchi pastroq ball oladi. Aks holda «92% davomat, 41 ball» kabi
bir-biriga qarama-qarshi raqamlar chiqib qolardi.

## 2026-08-30 · KPI: oʻlchanmagan koʻrsatkich 0 emas
Yuklamasi yoʻq ustoz (t-16 — sinf rahbari, lekin fan oʻqitmaydi)
imtihon KPI si boʻyicha 0 ball olardi va roʻyxatda eng yomon boʻlib
koʻrinardi. Bu yolgʻon: u yomon ishlagani emas, oʻlchanmagani.

Endi `KpiScore.available` bayrogʻi bor; umumiy ball faqat OʻLCHANGAN
koʻrsatkichlar oʻrtachasidan chiqadi va interfeysda «—» koʻrsatiladi.
Saralashda ham oʻlchanmaganlari oxirga tushadi, pastki ball sifatida
emas.

## 2026-08-30 · Oʻquv boʻlimi — oltinchi kabinet
Yangi rol `academic` va `/oquv-bolim` kabineti: imtihon eʼlon qilish,
natija kiritish, dars rejasi nazorati, ustozlar faoliyati. Rahbariyatdan
farqi — bu maʼlumot KIRITADIGAN rol, faqat kuzatmaydi.

Dars rejasi nazorati `lib/teacher/plan.ts` dagi qoidaga tayanadi: reja
OʻTILGAN darslar boʻyicha siljiydi, jadval boʻyicha emas. Shu sabab dars
bekor qilinsa reja oldinga ketmaydi va sinfning orqada qolgani
koʻrinadi.

## 2026-08-30 · Kabinetlar orasidagi id koʻprigi
Oʻquvchi va ota-ona kabinetlari alohida mock maʼlumotdan qurilgan
(`lib/mock/data.ts`, `lib/parent/data.ts`) va ularning id lari
`ALL_STUDENTS` bilan mos kelmaydi. Imtihon natijasini koʻrsatish uchun
`examIdentityFor(className, key)` — kabinet oʻquvchisini oʻsha sinfdagi
haqiqiy yozuvga BARQAROR bogʻlaydi. Backend ulanganda kerak boʻlmaydi:
id bitta boʻladi. Uni oʻsha vaqtda olib tashlash kerak.

## 2026-08-30 · Lid — ariza emas, alohida obyekt
Qabul arizasi (`Application`) allaqachon hujjat va shartnomani nazarda
tutadi. Lid esa faqat telefon raqami va qiziqish — hali hech narsa
yoʻq. Ikkalasini bitta modelga tiqish notoʻgʻri boʻlardi: lidda
boʻsh maydonlar koʻp boʻlib, «ariza toʻldirilmagan» kabi koʻrinardi.

Shu sabab `Lead` alohida: 5 bosqichli voronka (yangi → bogʻlanildi →
tashrif → sinov kuni → ariza) va yoʻqotilganlar. Oxirgi bosqichda
`/admin/qabul?lid=<id>` ga oʻtadi va sehrgar lid maʼlumotlari bilan
oldindan toʻldiriladi — ikkinchi marta yozilmaydi.

Lid OʻCHIRILMAYDI: «Yoʻqotildi» bosqichiga sabab bilan oʻtkaziladi.
Aks holda «nechta qoʻngʻiroqdan nechta oʻquvchi chiqdi» degan savolga
javob qolmasdi — marketing byudjeti shunga qarab belgilanadi.

## 2026-08-30 · Qoʻngʻiroq logi lid VA oʻquvchiga bogʻlanadi
`CallLog` da `leadId?` ham, `studentId?` ham bor. Shu sabab bitta yozuv
ikki joyda koʻrinadi: lid kartochkasida va oʻquvchi profilidagi «Butun
tarix» lentasida.

`useStudentHistory()` beshta manbani (toʻlov, storno, qoʻngʻiroq, suhbat
qaydnomasi, hujjat, shartnoma) bitta vaqt lentasiga yigʻadi. Rahbar
soʻragan «oʻquvchi boʻyicha sessiyalar» aynan shu — alohida jadval
qurilmadi, mavjud maʼlumot bir joyga keltirildi.
