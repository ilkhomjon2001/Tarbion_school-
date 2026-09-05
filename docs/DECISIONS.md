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

## 2026-08-30 · Sifat nazorati KPI ga qoʻshilmadi — alohida turadi
Rahbar KPI uchun toʻrtta koʻrsatkich aytgan. Dars kuzatuvini beshinchi
qilib qoʻshish — kelishilmagan narsani KPI ga tiqish boʻlardi. Shu sabab
`lib/school/quality.ts` mustaqil: KPI raqamlardan (imtihon, davomat)
chiqadi, sifat nazorati esa darsning oʻzini koʻrib baholaydi. Ustozlar
jadvalida yonma-yon koʻrsatiladi, lekin umumiy ballga qoʻshilmaydi.

Imtihon oʻrtachasi kuzatuv shkalasiga toʻgʻridan-toʻgʻri boʻlinmaydi:
68 ball sinf uchun oddiy natija, lekin 3.4/5 — yomon dars. Markaz 4.0 ga
qoʻyilib, imtihon natijasi uni ±0.8 ga suradi. Birinchi variantda
boʻlish ishlatilgandi va 26 ta darsdan 23 tasi «tavsiya berildi» chiqdi —
maktabda hamma dars yomon degan maʼnoni berardi.

`CRITERION_BIAS` — ataylab qoʻyilgan ogʻish, tasodifiy emas: demo
maʼlumotda ham «eng zaif mezon» aniq koʻrinsin va oʻquv boʻlimi keyingi
seminar mavzusini bilsin.

## 2026-08-30 · Kadrlar — `STAFF` ustiga qurildi, ikkinchi roʻyxat emas
`lib/school/hr.ts` xodimlar roʻyxatini `lib/school/staff.ts` dan oladi va
faqat MEHNAT maʼlumotini qoʻshadi (lavozim, staj, toifa, maosh). Ikkinchi
roʻyxat tuzilganda kimdir ustozni bittasidan oʻchirib, ikkinchisida
qoldirib yuborardi.

Haftalik soat `weeklyLoadOf()` dan — toʻqilmaydi. Shu sabab «yuklama
normadan yuqori» ogohlantirishi haqiqiy dars jadvaliga mos keladi.

Tugʻilgan sana ishga kirgan sanadan chiqariladi (ishga kirganda 22–40
yosh). Avval ikkalasi mustaqil generatsiya qilingandi va 2008-yilda ishga
kirgan 1990-yilgi xodim — 18 yoshli direktor — paydo boʻlgandi.

Ishdan boʻshagan xodim oʻchirilmaydi: `status: "archived"` boʻladi va
`ExitRecord` sababi bilan qoladi. Kadrlar aylanmasi shundan hisoblanadi.

## 2026-08-30 · Stack yopildi: Next.js + FastAPI + PostgreSQL

Backend uchun Node (NestJS), Go (Fiber) va Python (FastAPI) solishtirildi.
Yuk hisoblandi: ~1000–2000 hisob, cho'qqi 30–80 so'rov/soniya. Eng past
o'rindagi framework ham 16 000 so'rov/soniya beradi — **tezlik hech qaysi
variantda cheklov emas.** Shu sababli boshqa mezonlar hal qildi:

1. `backend/app/` da 1898 qator kod allaqachon yozilgan (modellar,
   `access.py`, auth, audit). Tashlash — 2–3 hafta yo'qotish.
2. Payme/Click/Uzum uchun **PayTechUZ** FastAPI'ni native qo'llaydi. Node'da
   TS SDK bor, Go'da tayyor kutubxona yo'q. To'lov — eng katta integratsiya
   riski.
3. aiogram bot backend bilan **umumiy baza va umumiy `access.py`** ishlatadi.
   Node'da bot baribir alohida Python xizmat bo'lardi.
4. HolliHop CRM integratsiyasi kodi Pythonda mavjud (`rnd-counter/hollihop.py`).
5. Deploy yo'li sinalgan: o'sha serverda `rnd-counter` FastAPI systemd +
   autopull bilan ishlaydi.

Go rad etildi: 20 barobar tez, lekin bizga 200 barobar ortiqcha zaxira
allaqachon bor. Evaziga to'lov kutubxonasi yo'q va ikki kishilik jamoada
har funksiya sekinroq chiqadi.

Frontend o'zgarmaydi — Next.js 15 da 60 sahifa ishlab turibdi.

## 2026-08-30 · Frontend–backend shartnomasi: OpenAPI generatsiyasi

TypeScript tiplari qo'lda yozilmaydi. FastAPI `/openapi.json` dan
`@hey-api/openapi-ts` orqali tiplar va TanStack Query hooklari
generatsiya qilinadi.

Sabab: qo'lda yozilgan tip backend o'zgarganda **jimgina eskiradi** — xato
faqat ishlab chiqarishda, foydalanuvchi ekranida ko'rinadi. Generatsiya
qilinganda Pydantic sxemasi o'zgarsa `pnpm build` darhol yiqiladi.

tRPC ko'rib chiqilmadi: u faqat TS backend bilan ishlaydi.

## 2026-08-30 · Token localStorage'dan httpOnly cookie'ga

Hozirgi demo `localStorage` ishlatadi — backendsiz boshqa yo'l yo'q edi.
Ishlab chiqarishda token `HttpOnly; Secure; SameSite=Lax` cookie'da bo'ladi.

Sabab: `localStorage` ni sahifadagi har qanday JavaScript o'qiy oladi.
Bitta XSS — buzilgan npm paketi yoki matnni ekranga chiqarishdagi xato —
butun hisobni beradi. httpOnly cookie'ni JS umuman ko'rmaydi.

Brauzer to'g'ridan-to'g'ri `api.tarbion.uz` ga murojaat qiladi. Next.js
oraliq qatlam (BFF) qilinmadi: token httpOnly cookie'da bo'lgani uchun
qo'shimcha himoya bermaydi, faqat bitta tarmoq qadami qo'shadi.

## 2026-08-30 · Baza O'zbekistonda joylashtiriladi

O'RQ-547 ning 2026-yil 26-mart tahririga ko'ra biometrik ma'lumot majburiy
O'zbekistonda saqlanadi; qolgani chet elda mumkin, lekin Vazirlar Mahkamasi
tasdiqlagan mamlakatlar ro'yxati va shartlar bilan.

O'quvchi surati shaxsni aniqlash uchun ishlatilsa biometrik deb talqin
qilinishi mumkin, va ro'yxat holati noaniq. Contabo (Germaniya) o'rniga
O'zbekistondagi hosting tanlandi — huquqiy noaniqlik yo'qoladi va
Toshkentdan kechikish 60–80 ms o'rniga 5–10 ms bo'ladi.

Yuristdan tasdiq kutilmoqda. Hal bo'lmaguncha ishlab chiqarish serveriga
real o'quvchi ma'lumoti yuklanmaydi.

## 2026-08-30 · PostgreSQL 16 emas, 18

Ish mashinasida PostgreSQL 18.4 o'rnatilgan edi. Ikkita yo'l bor edi:
lokalga qo'shimcha 16 o'rnatish yoki hujjatdagi versiyani 18 ga ko'tarish.

18 tanlandi: hozir ishlab chiqarish bazasi hali yaratilmagan, demak
"pastga tushirish" majburiyati yo'q. Dev va prod bir xil major versiyada
bo'lishi kerak — aks holda 18 da ishlagan so'rov 16 da boshqacha
rejalashtirilishi mumkin.

`docker-compose.yml` ham `postgres:18-alpine` ga o'tkazildi — Docker
ishlatadigan odam ham xuddi shu versiyani oladi.

## 2026-08-30 · Backend bilan umumiy kodlar — `lib/contracts.ts`
Ikki odam ikki tomonda ishlaydi va enum'lar jimgina ajralib ketardi.
Tekshirganda uchta haqiqiy nomuvofiqlik chiqdi:

1. `GradeType` oʻzbekcha kalitlar bilan edi (`joriy | nazorat | chorak |
   yillik`), backendda esa `GradeKind` inglizcha (`current | control |
   term | annual`). CLAUDE.md «kod inglizcha» deydi. Frontend inglizchaga
   oʻtkazildi.
2. Nazorat ishining vazni ikki xil edi: `lib/grades.ts` da 2,
   `lib/teacher/store.ts` da 3. Bir xil baholardan oʻquvchi kabineti va
   ustoz jurnali ikki xil chorak oʻrtachasi chiqarardi. Yagona qiymat —
   3 (ustoz modulidagi izoh aniqroq edi).
3. `SubmissionStatus` da `returned` faqat ustoz kabinetida bor edi,
   oʻquvchi kabinetida yoʻq. Endi ikkalasi bitta roʻyxatdan oladi.

Barchasi `src/lib/contracts.ts` ga yigʻildi — u
`backend/app/models/` dagi enum'larning aksi va qaysi fayldan
kelganini koʻrsatadi. Qolgan modullar faqat qayta eksport qiladi.

## 2026-08-30 · `academic` roli backend enum'iga qoʻshildi
`RoleName` da oʻquv boʻlimi yoʻq edi, frontendda esa alohida kabinet bor.
Enum qiymati oddiy `String(32)` — PG enum emas, shuning uchun migratsiya
talab qilmaydi.

Teskari yoʻnalishda `homeroom_teacher` backendda alohida rol, frontendda
alohida KABINET emas: sinf rahbari ustoz kabinetida ishlaydi, farqi
huquqlarda (`lib/teacher/roles.ts`). Bu ataylab shunday va
`contracts.ts` da izohlangan.

## 2026-08-30 · Kontrakt ogʻishini skript tutadi
`pnpm check:contracts` backenddagi Python enum'larini va
`*_LABELS_UZ` lugʻatlarini oʻqib, `lib/contracts.ts` bilan solishtiradi.
TypeScript buni koʻrolmaydi — Python fayl unga begona.

Skript ikki xil ogʻishni tutadi: enum'ga qiymat qoʻshilishi va
oʻzbekcha yorliq matnining oʻzgarishi. Ikkalasi ham ataylab buzib
tekshirildi.

`scripts/` `tsconfig.json` dan chiqarildi: Node `--experimental-strip-types`
import yoʻlida `.ts` kengaytmasini talab qiladi, Next esa uni rad etadi.

## 2026-08-30 · `contracts.ts` va OpenAPI generatsiyasi — ikkalasi ham kerak
Ikki qaror bir-biriga zid koʻrinishi mumkin: biri «TS tiplari qoʻlda
yozilmaydi», ikkinchisi qoʻlda yozilgan `lib/contracts.ts` ni kiritadi.
Zidlik yoʻq, chunki ular boshqa narsani qoplaydi.

Generatsiya soʻrov/javob sxemalarini beradi va uning uchun ISHLAYDIGAN
API kerak. Hozir `api/v1/` boʻsh — generatsiya qiladigan narsa yoʻq,
frontend esa bugun ishlashi kerak.

Ikkinchidan, `ATTENDANCE_LABELS_UZ` va `SUBMISSION_LABELS_UZ` — Pydantic
sxemasi emas, oddiy `dict` konstantasi. Ular OpenAPI ga umuman tushmaydi.
Endpointlar chiqqanda ham yorliqlar qoʻlda koʻchiriladi (yoki backend
ularni alohida endpoint orqali beradi — hali kelishilmagan).

Shu sabab: endpoint paydo boʻlganda `contracts.ts` dagi enum union'lari
generatsiya qilingan tiplarga almashtiriladi va oʻchiriladi; yorliq va
vazn jadvallari qoladi. `pnpm check:contracts` shu oʻtish davrida
ogʻishni tutib turadi.

## 2026-08-30 · `academic` roli `is_staff_wide` ga qoʻshildi
Rolni enum'ga qoʻshishning oʻzi yetarli emas edi: `access.py` uni
bilmagani uchun oʻquv boʻlimi foydalanuvchisi `accessible_student_ids()`
dan BOʻSH toʻplam olardi — yaʼni bironta oʻquvchini koʻrmasdi.

Oʻquv boʻlimi imtihon, dars rejasi va ustozlar faoliyatini barcha sinflar
kesimida koʻradi, shuning uchun u `is_staff_wide` ga kiritildi.

MUHIM cheklov: bu faqat oʻquvchi va sinf koʻrinishi. Moliya endpointlari
paydo boʻlganda ular `is_staff_wide` ga TAYANMASLIGI kerak — oʻquv boʻlimi
toʻlov va qarzdorlikni koʻrmaydi. Izoh `access.py` da qoldirildi.


## 2026-08-30 — Murojaatlar moduli: kirish nazorati va ruxsat chegaralari

**Bitta endpoint, uchta kabinet.** `/api/v1/appeals` ota-onaga, ustozga va
administratorga bir xil javob beradi; kim nimani koʻrishini
`appeals_service._scope()` soʻrovga shart qoʻshib hal qiladi. Rol boʻyicha
uchta alohida endpoint yozilmadi: bu uchta joyda uchta kirish nazorati
degani va biri kechroq unutilardi.

**Oʻquv boʻlimi (`academic`) murojaatlarni koʻrmaydi.** `access.py` dagi
`is_staff_wide` unga butun maktab kesimini ochadi, lekin murojaatda oilaviy
holat, toʻlov qiyinchiligi va sogʻliq haqida gap boradi. Shu sabab bu modul
`is_staff_wide` ga tayanmaydi — ruxsat alohida roʻyxat bilan
(`APPEAL_WIDE_ROLES`). Bu `access.py` izohidagi «moliya endpointlari alohida
tekshiruv qoʻyadi» qoidasining aynan shu holati.

**Ichki qaydlar alohida endpointda.** `appeal_notes` — maktabning oʻz
kuzatuvi («otasi bilan telefonda gaplashildi, toʻlovni suradi»). U
`AppealOut` ichida qaytarilmaydi: bitta unutilgan maydon butun qaydni
ota-onaga koʻrsatib yuborardi.

**`assignee_id` soʻrovdan olinmaydi.** Sinf rahbari bolaning sinfidan
hisoblanadi; fan oʻqituvchisi esa tekshiriladi — tanlangan xodim shu bolaga
haqiqatan dars berayotgani `lessons` dan qaraladi. Aks holda ota-ona «fan
oʻqituvchisi» niqobida istagan xodimga yozib yuborardi.

**Murojaat yoʻnalishi kodlari inglizcha.** `management` / `homeroom` /
`subject_teacher` — mockdagi `rahbariyat` / `sinf_rahbari` /
`fan_oqituvchisi` oʻrniga. Sabab `GradeKind` bilan bir xil: kod inglizcha,
yorliq oʻzbekcha, va kod backend enum'idan `contracts.ts` orqali keladi.
`pnpm check:contracts` endi bu uchtasini ham tekshiradi.

**Javob muddati — 3 kun** (`RESPONSE_DAYS`). Yaratilishda `due_at` ga yozib
qoʻyiladi va keyin qayta hisoblanmaydi: aks holda konstanta oʻzgarganda
«muddati oʻtdi» hisoboti oʻtmishni ham qayta yozardi.

**Ichki qaydda ustoz baholash maydonlari saqlab qolindi.** Administrator
kabinetidagi mavjud forma suhbatni ustozga bogʻlab, 1..5 baho va izoh
soʻrardi. Integratsiya funksiya yoʻqotish boʻlmasligi uchun
`appeal_notes` ga `about_teacher_id`, `teacher_rating`, `teacher_comment`
qoʻshildi. Chegara (1..5) bazada ham — bu qiymat keyinchalik ustozlar
faoliyati hisobotiga tushadi.


## 2026-08-31 — Maktab ham yozishmani boshlay oladi (ADM-16)

Loyiha egasi tasdiqladi: administrator ota-ona bilan yozishmani birinchi
boʻlib boshlay oladi (telefon suhbatini qayd qilish, soʻrovnoma).

**`author_id` va `created_by_id` ajratildi.** Yozishma OILAGA tegishli —
`author_id` har doim vasiy hisobi, shuning uchun ota-ona uni oʻz kabinetida
koʻradi va javob yozadi. Kim ochgani `created_by_id` da. Ikkisi
aralashtirilsa bazada «maktab ota-ona nomidan gapirdi» degan yozuv paydo
boʻlardi; ota-ona kabinetida esa oʻzi yozmagan xat oʻz xati boʻlib turardi.
Interfeysda «Maktab boshladi» deb koʻrsatiladi — yashirilmaydi.

**Birinchi xabar muallifi — xodim.** Ota-onaning ogʻziga soʻz solinmaydi.

**Holat `in_review`, muddat yoʻq.** Maktab boshlagan yozishmada javob
kutayotgan tomon — ota-ona. Uni `new` qoldirish administrator ekranidagi
«javob berilmagan murojaat» sanogʻini yolgʻon oshirardi, MUR-04 muddati
qoʻyish esa maktabni oʻz savoliga javob berishga majburlardi. Muddat
ota-ona javob yozgan paytda qoʻyiladi — navbat shunda maktabga oʻtadi.

**Maktab boshlagan yozishma har doim `management`.** Yoʻnaltirish qoidalari
(sinf rahbari, fan oʻqituvchisi) ota-ona «kimga yozaman» deb tanlashi
uchun. Oila tomonidan qaralganda yozgan tomon bitta — maktab.

**Ustoz bu yoʻldan foydalana olmaydi.** Faqat administrator, rahbariyat va
superadmin. Aks holda har bir ustoz istagan oilaga toʻgʻridan-toʻgʻri,
nazoratsiz kanal ochardi. Ustoz ota-onaga yozmoqchi boʻlsa sinf rahbari
yoki administrator orqali boradi.

**Vasiy oʻquvchi orqali topiladi**, ota-onalar roʻyxatidan tanlanmaydi:
bir familiyali bir necha oila boʻladi. Server ham tekshiradi — tanlangan
hisob shu oʻquvchining vasiysi boʻlmasa `422`. Qidiruv javobida telefon,
manzil va hujjat raqami yoʻq (X-6).

Bu ish bilan `components/admin/ConversationsBoard.tsx` va
`components/director/AppealsBoard.tsx` oʻchirildi — ikkalasining
funksiyasi `LiveAppeals` da bazadan ishlaydi.


## 2026-08-31 — Kabinet ichidagi bildirishnomalar (T-018a)

Bildirishnoma yozuvi HODISA emas, **QABUL QILUVCHI** boʻyicha saqlanadi:
bitta «darsga kelmadi» ota-onaga ham, oʻquvchiga ham alohida qator boʻlib
tushadi.

Sabab uchta. «Oʻqildi» belgisi har odamda oʻziniki — bitta qatorda
saqlansa ota-ona oʻqigach oʻquvchida ham oʻqilgan boʻlib qolardi. Kirish
nazorati bitta shartga tushadi (`WHERE user_id = :men`): kim koʻrishi
mumkinligi yozuv yaratilayotgandayoq hal qilingan, oʻqishda qayta
hisoblanmaydi. Va yon menyudagi sanoq bitta `GROUP BY section` bilan
chiqadi.

**Boʻlim qabul qiluvchining KABINETI boʻyicha hisoblanadi.** Bitta
«kelmadi» ota-onada «Davomat», oʻquvchida «Bosh sahifa» boʻlimida
sanaladi — oʻquvchi kabinetida davomat boʻlimi yoʻq. Kabinet
`_SECTION` jadvalida boʻlmasa bildirishnoma umuman yaratilmaydi; oʻquv
boʻlimi murojaat xabarini shu sabab olmaydi (`APPEAL_WIDE_ROLES` dagi
qoidaning aynan aksi).

**Boʻlim kaliti — manzilning oʻzi** (`core/sections.py` dagi id). Shu
sabab menyuga yangi band qoʻshilganda frontendda hech narsa
yozilmaydi: son avtomatik paydo boʻladi.

**Oʻz amalidan xabar kelmaydi.** Ustoz davomatni oʻzi belgilagan — unga
«Ali kelmadi» deb qaytarish qoʻngʻiroqni foydasiz toʻldirardi. Tekshiruv
`notify()` ichida, chaqiruvchi servisda emas: aks holda har chaqiruv
joyida takrorlanardi va biri unutilardi.

**Takror xabar sharti — HOLAT oʻzgarishi**, yozuvning mavjudligi emas.
Ustoz jurnalni qayta saqlaganda yoki izohni tuzatganda ota-onaga
ikkinchi marta bir xil xabar bormaydi.

**«Sababli» xabar bermaydi.** Uni oila oʻzi maʼlum qilgan; qaytarib
xabar berish maʼnosiz.

**Bildirishnoma davomat bilan BIR tranzaksiyada yaratiladi.** Davomat
saqlanmasa bildirishnoma ham qolmaydi — aks holda ota-onaga «kelmadi»
deb xabar ketib, jurnalda hech narsa boʻlmasligi mumkin edi.

**Begona id yuborilsa `403` emas, `updated: 0`.** Xato qaytarish
«bunday bildirishnoma bor» degan maʼlumotni oshkor qilardi (X-3
mantigʻi). Tekshiruv soʻrov darajasida. Shu sababdan
`GET /notifications/{id}` endpointi ataylab yozilmagan.

**T-018 (outbox) dan ALOHIDA.** T-018/T-019/T-020 xabarni tashqariga —
Telegramga, SMS ga — yuborish haqida. Bu esa kabinetning ichida.
Outbox yozilganda u shu jadvaldan oziqlanadi, qaytadan yozilmaydi.

**Frontendda holat modul darajasida bitta.** Qoʻngʻiroq va yon menyudagi
sanoq bir vaqtda koʻrsatiladi; har biri oʻzi soʻrov yuborsa trafik ikki
barobar boʻlardi va bittasi oʻqilgandan keyin ikkinchisi eski sonni
koʻrsatib turardi. `useSyncExternalStore` ataylab: holat React'dan
tashqarida, lekin React uni toʻgʻri kuzatadi.

Bu ish bilan `components/admin/AdminNotifications.tsx` oʻchirildi — u
`localStorage` dagi mock ombordan sanoq koʻrsatardi va yonida haqiqiy
qoʻngʻiroq turishi chalgʻitardi. Ota-ona kabinetidagi eʼlonlar havolasi
karnay belgichasiga oʻtdi (ikkita bir xil qoʻngʻiroq boʻlmasin).

## 2026-08-31 — TOTP kutubxonasiz yoziladi

`pyotp` oʻrniga standart kutubxona (`hmac`, `hashlib`, `base64`) bilan
~40 qator. Sabab: har bogʻliqlik yangi hujum yuzasi (supply chain), va
RFC 6238 kichik hamda oʻzgarmaydigan standart. RFC ning oʻz sinov
vektorlari testda mahkamlangan — algoritm toʻgʻri yozilganini oʻsha
isbotlaydi.

## 2026-08-31 — 2FA sozlash ekranida QR kod YOʻQ

QR chizish uchun kutubxona kerak (Reed-Solomon ~250 qator — oʻzi
yozish oqilona emas). Oʻrniga `otpauth://` havolasi (telefonda ilovani
ochadi) va qoʻlda kiritiladigan sekret. Ikkalasini ham barcha
autentifikator ilovalari qoʻllaydi. QR kerak boʻlsa `qrcode` paketi
qoʻshiladi — loyiha egasidan ruxsat soʻralsin.

## 2026-08-31 — Rate limiting jarayon xotirasida, bazada emas

Redis yoʻq (avvalgi qaror). Har soʻrovda bazaga `INSERT` + `COUNT`
qilish 30-80 RPS da rate limit'ning oʻzini eng qimmat soʻrovga
aylantirardi. Xotiradagi sirpanuvchi oyna tanlandi.

Cheklovi ochiq: har worker oʻz hisobini yuritadi va qayta ishga
tushganda nolga tushadi. Bu qabul qilingan — chegaralar keng va ular
aniq hisob emas, birinchi toʻsiq. Uzoq muddatli hisob `login_attempts`
jadvalida qoladi.

## 2026-08-31 — Zaxira OCHIQ KALIT bilan shifrlanadi

`age` ning ochiq kalitli rejimi: server faqat shifrlay oladi, ochish
kaliti serverdan tashqarida. Parolli arxivda parol serverning oʻzida
turardi va serverni buzib kirgan odam butun zaxira tarixini ochib
olardi — ya'ni zaxira hujumchining ishini osonlashtirardi.

## 2026-08-31 — IP boʻyicha bloklash TURLI LOGINLAR sonini sanaydi

Xatolar sonini sanash butun maktabni bloklab qoʻyardi: hammasi bitta
NAT ortidan chiqadi va oʻquv yili boshida 500 kishi parolini xato
teradi. Oddiy foydalanuvchi oʻzining bitta loginida adashadi, hujumchi
esa oʻnlab login boʻyicha urinadi — bu ikkisini ajratadigan yagona
ishonchli belgi.


## 2026-08-31 — Baho va uy vazifasi bildirishnomalari (T-018a davomi)

Jurnal backendi kelgach (T-029, T-032, T-033) toʻrtta yangi turkum
qoʻshildi: `grade_new`, `homework_new`, `homework_graded`,
`homework_returned`.

**Uy vazifasi ota-onaga BORMAYDI.** Kunda olti-yetti dars boʻladi va har
biriga vazifa beriladi — ota-onaning qoʻngʻirogʻi kuniga oʻn marta
toʻlardi, «farzandingiz darsga kelmadi» esa shovqin ichida yoʻqolardi.
Ota-ona vazifani farzandi sahifasida koʻradi. Qoida `_SECTION` da
qatʼiy: ota-ona kabineti bu turkum uchun roʻyxatda yoʻq, shuning uchun
chaqiruvchi servis roʻyxatni filtrlashi shart emas.

**Baholangan ish — boshqa gap.** U kamdan-kam va bahoning oʻzi, shuning
uchun oilaga boradi va `/ota-ona/baholar` boʻlimida sanaladi.

**Qaytarilgan ish faqat oʻquvchiga.** U OʻQUVCHIDAN amal talab qiladi:
u koʻrmasa vazifa qayta ishlanmaydi. Bu baho emas, ish jarayoni.

**Vazifa bahosi ikki marta xabar bermaydi.** `grade_submission` `Grade`
yozuvini oʻzi yaratadi va `set_lesson_grades` dan oʻtmaydi — ikki
ilgak bir hodisaga tushmaydi. Test buni qatʼiy tekshiradi.

**Baho xabari faqat QIYMAT oʻzgarganda.** Izoh tuzatilgani yoki vazn
oʻzgargani oilaga xabar emas — ular baho emas. Xato baho olib
tashlanganda ham yangi xabar chiqmaydi. Davomatdagi qoidaning aynan
oʻzi.

**Oila roʻyxati bitta joyga koʻchdi** — `notifications_service.
family_recipients()`. Ilgari `attendance_service` ichida edi; uchinchi
chaqiruvchi paydo boʻlgach takrorlanish xavfi tugʻildi va biri
oʻquvchining oʻz hisobini unutishi mumkin edi.

## 2026-09-01 · `/auth/me` oʻquvchi uchun `student_id` qaytaradi
`UserOut` ga `student_id`, `class_id`, `class_name` qoʻshildi (faqat
oʻquvchi rolida toʻladi). Sabab: kabinet oʻz yozuvini bilishi kerak,
alohida `/student/me` endpointiga hojat yoʻq. Bu qulaylik — haqiqiy
tekshiruv baribir `services/access.py` da (X-1). Seed endi har
oʻquvchiga hisob ochadi (T-034).

## 2026-09-01 · Mock sahifalar API'ga ulandi, backend'i yoʻqlari mock qoldi
Oʻquvchi kabineti, ota-ona baholari, ustoz murojaatlari, admin qabul,
rahbariyat bosh sahifa/sinflar/ustozlar bazadan oʻqiydi. Qoida:
haqiqiy raqam yonida soxta raqam koʻrsatilmaydi — shuning uchun backend'i
yoʻq boʻlimlar (reyting, eʼlonlar, imtihonlar, moliya) yo olib qoʻyildi,
yo «modul ulanmagan» deb belgilandi. Maʼlumot qatlami naqshlari:
`lib/student/api.ts`, `lib/director/api.ts` (adapter + `withAuth`).


## 2026-09-01 — Toʻlov: haqiqiy provayder oʻrniga sinov provayderi

Payme/Click hozir ulanmaydi (shartnoma yoʻq). Modul ikkiga ajratildi:
hisob-kitob (shartnoma → oylik qarz → toʻlov → storno) provayderga
umuman bogʻlanmagan; onlayn qism esa «sinov provayderi» bilan qurildi —
HMAC imzoli webhook, idempotentlik, summa faqat intent yozuvidan (X-9).
Haqiqiy integratsiyada faqat imzo sxemasi va URL almashadi. Standart
shartnoma 3 500 000 soʻm/oy, oʻquv yili 9 oy (sentabr–may) — loyiha
egasining qarori.

## 2026-09-02 · Audit tuzatishlari boʻyicha uchta biznes-qoida

Audit (AUDIT.md) topilmalarini yopishda qabul qilindi:

1. **Davomat foizida sababli kun maxrajdan chiqadi** (O1). Foiz =
   kelgan / (jami − sababli). Kasal bola foizda jazolanmaydi; barcha
   kabinetlar va direktor paneli endi bitta formuladan
   (`AttendanceStat.percent`, `director_service`) oladi.

2. **Shartnoma boshlanish kuni oy oʻrtasi boʻlsa, oʻsha oy avtomatik
   hisoblanmaydi** (Y3). Admin 1-sanani tanlasa oy toʻliq qarz boʻladi,
   oy oʻrtasini tanlasa hisob keyingi oydan boshlanadi — «birinchi oy
   qoʻlda» qoidasining aniq ifodasi. Oʻtgan oy uchun hisoblashda oʻsha
   oyda amalda boʻlgan (arxivdagi) shartnoma tanlanadi (Y2).

3. **Reyting formulasi** (REY-01): vaznli, 5 ballik shkalaga
   normallashgan oʻrtacha baho; teng boʻlsa davomat foizi. X-6 —
   oʻquvchiga faqat OʻZ oʻrni va koʻrsatkichlari qaytadi, sinfdoshlar
   roʻyxati yoʻq.

## 2026-09-02 · Real oʻquvchi roʻyxati serverga yuklandi (egasining buyrugʻi)

Loyiha egasi Google Sheets'dagi real roʻyxatni (98 oʻquvchi, 18 ustoz,
ota-ona telefonlari) bazaga yuklashni buyurdi; demo maʼlumot toʻliq
almashtirildi (`app/import_real.py`). CLAUDE.md'dagi «yurist tasdigʻigacha
real maʼlumot yuklanmaydi» ogohlantirishi egaga eslatildi — qaror uniki.
Server hozircha Germaniyada; Oʻzbekistonga koʻchirish masalasi ochiq.
Vasiylar telefon boʻyicha birlashtirildi (aka-ukalar bitta hisobda),
apostroflar 8-qoidaga normalizatsiya qilindi. Barcha yangi hisoblar
5 xonali vaqtinchalik parol + majburiy almashtirish bilan ochildi;
parollar faqat lokal CSV faylda.

## 2026-09-02 · X-14 (majburiy 2FA) oʻchirildi — egasining qarori

Loyiha egasi administrator, direktor va rahbariyat hisoblariga ikki
bosqichli tasdiqlash TALAB QILINMASLIGINI aytdi. `REQUIRE_TWO_FACTOR=false`
— serverda allaqachon shunday edi, lokal muhit ham unga moslandi.

Funksiyaning oʻzi joyida qoladi: xohlagan foydalanuvchi 2FA'ni yoqsa,
unga kirishda kod soʻraladi. Faqat MAJBURIYLIK olib tashlandi.

Ogohlantirish egaga aytildi: bundan keyin administrator yoki rahbar
parolini bilgan har kim butun bazani — 98 voyaga yetmagan oʻquvchining
ismi, sinfi va ota-onasi telefonini — ochadi. Egasining javobi: sayt
faqat maktab rahbariyati uchun, qidiruvdan topilmaydi va har bir oila
bilan yozma shartnoma bor.

Buning natijasida CLAUDE.md dagi X-14 qoidasi endi amalda emas — u yerda
matn yangilanishi kerak, aks holda hujjat haqiqatga zid boʻlib qoladi.

## 2026-09-02 · Metodik baza CRUD — Excel shablon oqimi, openpyxl qoʻshildi

Egasining talabi: oʻquv boʻlimi dars rejalarini oʻzi ishlab chiqib
yuklaydi. Oqim: sayt Excel shablon beradi → toʻldiriladi → import
(QORALAMA, ogohlantirishlar bilan) → kartochkalarda koʻrib chiqish
(ustoz koʻrinishining oʻzi) → «Joriy qilish» (eski joriy ARXIVga).
`curriculum_plans` jadvali, darslar JSONB. Excel uchun **openpyxl**
kutubxonasi qoʻshildi (import + shablon + eksport — boshqa yoʻl bilan
xunuk boʻlardi). Robototexnika bazasi statik qoladi; ustoz kabinetida
fan tanlagich ikkala manbani birlashtiradi.

## 2026-09-02 · Majburiy parol almashtirish oʻchirildi (qabul qilingan xatar)

Egasining qarori: barcha rollar uchun berilgan boshlangʻich parol
doimiy — birinchi kirishda majburiy almashtirish YOʻQ (maktabda parol
tarqatish jarayonini soddalashtirish uchun). Xavfsizlik tekshiruvi buni
nazorat regressiyasi deb belgiladi — xatar ongli qabul qilindi.

Yumshatuvchi omillar: login-bloklash (5 xato → 15 daqiqa; IP boʻyicha
15 turli login), staff roʻyxati oddiy foydalanuvchiga yopiq (loginlar
sizmaydi), ixtiyoriy almashtirish /parol sahifasida ochiq. Tavsiya:
xodimlarga parolni almashtirish ogʻzaki tavsiya qilinsin; kelgusi
importlarda boshlangʻich parolni kuchliroq formatga oʻtkazish mumkin
(egasi xohlasa).


## 2026-09-02 · Bot kodi `backend/app/bot/` da, `bot/` papkasida emas

CLAUDE.md repo tuzilishida `bot/main.py` koʻrsatilgan. Amalda kod
`backend/app/bot/` ga qoʻyildi: bot backend bilan bir xil modellar,
`core/config.py`, `core/db.py` va `services/access.py` ni ishlatadi
(X-8 talabi). Ildizdagi alohida papka ikkinchi muhit va ikkinchi
bogʻliqliklar toʻplamini — yoki modellarning nusxasini — talab qilardi.
Outbox worker'i ham shu sababdan `app/workers/` da turadi. `bot/README.md`
shu yerga yoʻnaltiradi.

## 2026-09-02 · Botga ulanish: telefon + kod (deep-link EMAS)

CLAUDE.md X-8 va `bot/README.md` «deep-link token» deb yozilgan edi, TZ
esa BOT-01 da aniq: «Vasiy telefon raqami va bir martalik kod orqali botga
ulanadi». Ziddiyatda TZ ustun (CLAUDE.md ning oʻz qoidasi) — telefon + kod
qilindi, X-8 matni tuzatildi.

Ikkala omil boshqa narsani isbotlaydi: telefon (Telegram tasdiqlagan
contact) SIM kartani, kod esa maktabdagi hisobning parolini bilishni.
Faqat telefon boʻlsa, raqamni qayta olgan begona odam oilaning xabarlarini
ola boshlardi.

## 2026-09-02 · `aiogram 3` bogʻliqlik sifatida qoʻshildi

CLAUDE.md stack'ida allaqachon tanlangan edi; T-017 da amalda kerak boʻldi.
`backend/pyproject.toml` ga qoʻshildi — bot backend muhitida ishlaydi.

## 2026-09-03 · Zaxira: cron emas, `systemd` taymeri

`docs/ZAXIRA.md` da cron koʻrsatilgan edi. Amalda `tarbion-backup.timer`
qilindi: `Persistent=true` server oʻchiq boʻlgan paytdagi ishni
oʻtkazib yubormaydi, `OnCalendar=... Asia/Tashkent` mintaqani aniq
belgilaydi (server `Europe/Berlin` da), va eng muhimi — `OnFailure=`
orqali yiqilish jimgina oʻtmaydi. Cron'da bularning uchalasi ham
qoʻlda quriladi.

## 2026-09-03 · Zaxira ogohlantirishi outbox'dan OʻTMAYDI

Loyihada xabar yuborishning toʻgʻri yoʻli — `notification_outbox`
(T-018). `backup_alert.sh` uni ataylab chetlab oʻtadi va Telegram API
ga toʻgʻridan-toʻgʻri murojaat qiladi: zaxira yiqilishining eng
ehtimolli sababi — PostgreSQL ishlamayotgani. Bazaga yozadigan
ogohlantirish aynan kerak boʻlgan paytda jim qolardi.

## 2026-09-03 · `restore_check.sh` ilova roli bilan ishlamaydi

Tekshiruv vaqtinchalik baza yaratadi, ilova roli esa `CREATE DATABASE`
qila olmaydi (X-11 — ataylab huquqsiz). Skript `DATABASE_URL` ni
ishlatishga urinib jimgina yiqilardi. Endi u administrator ulanishini
oladi: serverda `sudo -u postgres`, masofadan `RESTORE_ADMIN_URL`.
Muqobil yoʻl — ilova roliga `CREATEDB` berish — rad etildi, chunki u
X-11 ni buzardi.

## 2026-09-03 · CI ning deploy oldidan oladigan nusxasi shifrlanmaydi

`tarbion-backup` shifrlaydi, CI niki yoʻq. Sabab: CI nusxasining
yagona vazifasi — deploy notoʻgʻri ketsa DARHOL orqaga qaytish, maxfiy
kalit esa ataylab serverdan tashqarida. Shifrlangan nusxa tez
qaytishga yaramaydi. Evaziga `umask 077` va saqlanadigan nusxa soni
20 dan 5 ga tushirildi — diskda ochiq PII kamroq va kamroq vaqt
yotadi.

## 2026-09-03 · Uy vazifasi oʻtilgan darsga bogʻlanadi

Ilgari ustoz vazifaga oʻzi oʻylab topgan nom qoʻyardi («5-mashq») va
vazifa qaysi mavzuga tegishli ekani hech qayerda qolmasdi. Endi ustoz
oʻtilgan darsni tanlaydi (`homework.lesson_id`), sarlavha esa
jurnaldagi mavzudan (`lessons.topic`) toʻladi.

Tanlash roʻyxatiga faqat vaqti kelib boʻlgan darslar kiradi va bu
SERVERDA tekshiriladi (`starts_at <= now`, sinf va fan mos): hali
oʻtilmagan mavzuga vazifa berilmaydi. Sarlavha maydoni qoldi —
«Kasrlarni qoʻshish, 5-mashq» kabi aniqlashtirish kerak boʻladi.

Muqobil — `lesson_id` ni majburiy qilish — rad etildi: eski vazifalar
bogʻlanmagan va ular roʻyxatdan tushib qolardi (1-domen qoidasi).

## 2026-09-03 · `lessons_conducted` → `lessons_planned`

Maydon jadvaldagi darslarni sanardi, nomi va ekrandagi yorligʻi esa
«oʻtilgan» derdi. Farq katta: jadval butun oʻquv yiliga oldindan
generatsiya qilinadi, shu sabab ustozning «oʻtilgan darslari» ichida
KELAJAKDAGI darslar ham bor edi.

Endi ikkita alohida son: `lessons_planned` (jadval boʻyicha, bugungacha)
va `lessons_with_attendance` (davomat belgilangan). Ikkinchisi —
darsning haqiqatan oʻtilganini koʻrsatadigan yagona iz, chunki davomat
belgilanmasa ota-onaga xabar ham ketmaydi.

Ustozlar roʻyxati baribir BUTUN jadvaldan quriladi (INNER JOIN oʻzgarmadi):
aks holda dushanbadan boshlanadigan ustoz yakshanba kuni roʻyxatdan
yoʻqolardi.

## 2026-09-03 · Davomat foizi yonida yozuvlar soni koʻrsatiladi

48 ta yozuvdan hisoblangan «92%» bilan 10 000 tadan hisoblangani
ekranda bir xil koʻrinardi. Endi katak tagida yozuvlar soni va qamrov
(jadvaldagi darslarning necha foizida davomat belgilangan) turadi,
qamrov 50% dan past boʻlsa izoh ogohlantirish rangida.

Muqobil — qamrov past boʻlsa foizni umuman koʻrsatmaslik — rad etildi:
rahbar «tizim ishlamayapti» deb oʻylardi. Raqamni koʻrsatib, ishonch
darajasini yoniga yozish toʻgʻriroq.

## 2026-09-03 · Excel'dan oʻquvchi importi (T-010) qilinmaydi

Loyiha egasining qarori: oʻquvchi administrator kabinetida
toʻgʻridan-toʻgʻri qoʻshiladi, Sheets/Excel'dan import kerak emas.

TZ da ADM-05 sifatida turgani uchun yozib qoʻyilmoqda — aks holda
keyingi safar «TZ da bor-ku» deb qayta boshlanishi mumkin. Import
qayta kerak boʻlsa, avval egasidan soʻraladi.

Bir martalik yuklash uchun `app/import_real.py` CLI skripti bor
(2026-09-02 dagi real maʼlumot koʻchirishi shu bilan qilingan).

## 2026-09-03 · E2E da bitta oqim, va u deploy'ni toʻsadi

Playwright (T-023) faqat bitta zanjirni tekshiradi: ustoz davomat
belgilaydi → ota-ona koʻradi. U toʻrtta qatlamdan oʻtadi
(autentifikatsiya, ustoz kabineti, `access.py`, ota-ona kabineti) va
bironta unit test uni butunligicha tekshira olmaydi. Qolgani arzonroq
qatlamda: `pytest`, `tsc`, `check:contracts`.

Ish `deploy` ning `needs` iga qoʻshildi. Bloklamaydigan test — hujjat,
test emas. `[tez]` belgisi bilan u ham oʻtkazib yuboriladi.

Maʼlumot `app/e2e_seed.py` dan (qatʼiy loginlar, idempotent) va u
`APP_ENV=production` da ishlashdan bosh tortadi. Skript har yugurishda
oʻsha darsning davomatini tozalaydi — aks holda test saqlash yoʻlini
bosib oʻtmasdan «oʻtdi» deb chiqadi (bir marta shunday boʻlgan).

## 2026-09-03 · «tez» belgisi faqat commit SARLAVHASIDA hisoblanadi

Ilgari `if: !contains(github.event.head_commit.message, '[tez]')` butun
xabarni tekshirardi. Natija: commit IZOHIDA belgi haqida yozilgan
commit BARCHA testlarni oʻtkazib yubordi va buni hech kim sezmadi —
deploy muvaffaqiyatli koʻrindi.

Sarlavhani `if:` ifodasi ichida ajratib boʻlmaydi (GitHub ifodalarida
`split` va regex yoʻq), shuning uchun belgi alohida `belgilar` ishida
`git log -1 --pretty=%s` bilan hisoblanadi va natija `outputs` orqali
uzatiladi. Belgi topilsa ish `::warning::` chiqaradi — oʻtkazib
yuborilgani jurnalda koʻzga tashlanadi.

`belgilar` ning oʻzi muvaffaqiyatli boʻlishi deploy sharti: u yiqilsa
testlar oʻtkazib yuborilishi kerakmi-yoʻqmi noaniq qoladi.

## 2026-09-04 · Kartochkada tahrirlash — vasiy va oʻquvchi maydonlari

Loyiha egasining soʻrovi: qabul paytida maʼlumot toʻliq boʻlmaydi,
hujjat kelganda toʻldiriladi. Qoʻshildi:

  · `users.address`, `users.profession` — vasiyning yashash joyi va kasbi
  · `students.previous_school` — oldingi oʻqigan joyi

Ikkalasi ham ROʻYXATLARDA qaytmaydi (X-6): faqat bitta oʻquvchi
kartochkasida va faqat `students.manage` huquqi borga.

Vasiy `PUT /school/students/{student_id}/guardians/{user_id}` orqali
tahrirlanadi — yoʻlda `student_id` ATAYLAB bor. `user_id` yolgʻiz
boʻlsa bu endpoint istalgan foydalanuvchini tahrirlash yoʻliga
aylanardi. Login, parol va rol sxemada yoʻq (X-5): familiya
almashganda ham login oʻzgarmaydi, u odamning tizimdagi manzili.

Hech narsa oʻzgarmagan boʻlsa audit yozuvi YOZILMAYDI — aks holda
kartochkani ochib-yopgan har bir amal jurnalni koʻmib tashlardi.

## 2026-09-04 · E2E dars vaqti nisbiy boʻlishi kerak

`app/e2e_seed.py` darsni qatʼiy 08:30 ga qoʻyardi va test **kun
vaqtiga bogʻliq** boʻlib qoldi: DAV-03 boʻyicha boshlanmagan darsga
davomat yozib boʻlmaydi, CI esa ertalab 07:41 (Toshkent) da ishga
tushdi — dars hali boshlanmagan, katak oʻchiq, test yiqildi. Lokalda
kechqurun sinalgani uchun oʻtib ketardi.

Endi vaqt «hozirdan 2 soat oldin» dan olinadi va mahalliy kun
chegarasiga qisiladi: har doim bugungi kunda, har doim oʻtmishda.
Qoʻngʻiroq jadvali ham shu vaqtga moslanadi.

Sabab TAXMIN qilinmadi — CI sharoiti lokalda takrorlandi (pytest
bazasining sxemasi boʻshatilib, `alembic upgrade head` + `e2e_seed`).
Toza baza va toʻla baza farqi aynan shu turdagi xatoni yashiradi,
shuning uchun takrorlash tartibi `docs/E2E.md` ga yozildi.

## 2026-09-04 · Sayt tarbion.uz domeniga koʻchirildi

Egasining qarori. `tarbion.robbitonline.uz` **butunlay uzildi** —
yoʻnaltirishsiz (egasi shunday tanladi): eski havolalar ochilmaydi,
yangi manzil foydalanuvchilarga eʼlon orqali yetkaziladi. Bitta domen
sxemasi saqlandi (`/api/*` backendga, qolgani frontendga) — cookie
host-only qoladi, `COOKIE_DOMAIN` boʻsh. `www.tarbion.uz` asosiy
domenga 301 bilan yoʻnaltiriladi. Serverda `CORS_ORIGINS`,
`PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL` yangilandi, frontend qayta
build qilindi.

## 2026-09-04 · Toʻlov holati «qarzdor»dan ajratildi

Rahbar «nechta qarzdor, nechta yarim toʻlagan» degan savolni berdi.
`balance < 0` bunga javob bera olmaydi: hech narsa toʻlamagan va
yarmini toʻlagan oʻquvchi ikkalasi ham manfiy balansda, holbuki
maktab uchun bular boshqa ish.

`StudentFinance.status` qoʻshildi — `tolangan | qisman | tolanmagan |
hisobsiz`. Soʻzlar oy kesimidagi `MonthStatus` bilan bir xil, chunki
interfeysda bitta tushunchaning ikki nomi boʻlishi mumkin emas.

`hisobsiz` alohida turadi: shartnomasi yoʻq yoki oy hisoblanmagan
oʻquvchi «toʻlamagan» deb belgilanmaydi. Aks holda hisob umuman
yuritilmagani qarzdorlikka oʻxshab koʻrinadi va roʻyxat ishonchini
yoʻqotadi.

Roʻyxat filtri BRAUZERDA: oʻquvchi soni yuzlab, har bosishda soʻrov
yubormaymiz va tugmaning oʻzida sanoq turadi — «Toʻlamagan 46».

## 2026-09-04 · 2026-2027 oʻquv yili moliyasi ochildi

Egasining koʻrsatmasi bilan 99 ta faol oʻquvchiga standart shartnoma
(3 500 000 soʻm/oy, 2026-09-01 dan) va sentabr qarzi yozildi.
Sentabr toʻlov jadvalidan 59 yozuv (74 740 000 soʻm) kiritildi.

Hammasi **API orqali**, toʻgʻridan-toʻgʻri SQL bilan emas: servis
qatlami huquq, validatsiya va auditni oʻz joyida bajaradi. Toʻlov
yozuvi keyin tahrirlanmaydi (TOL-07), shuning uchun quruq yugurish
majburiy qadam boʻldi.

Usul — `naqd`, egasi tanladi; jadvalda usul yozilmagan, shuning
uchun har yozuv izohida «usul aniqlanmagan» turadi. Kvitansiya
raqami jadval qatoridan olinadi (`SENT26-NNN-1`) — u unikal, demak
skript ikki marta ishga tushsa baza takrorni oʻzi rad etadi.

Ismi noaniq 5 qator (7 950 000 soʻm) ATAYLAB kiritilmadi. Toʻlov
tahrirlanmaydi, faqat storno qilinadi — noaniq yozuvni keyin
tuzatishdan koʻra kiritmaslik arzon.

## 2026-09-04 · Vasiy telefon RAQAMDAN boshlab qoʻshiladi

Raqam odamning kaliti. Maktabda ikkinchi farzandi bor ota-onaga yangi
hisob ochilmasligi kerak — aks holda u ikkita login bilan ikkita
kabinetga kirib, har birida bitta farzandini koʻradi.

Backendda `link_existing` allaqachon bor edi, lekin **interfeysda unga
yoʻl yoʻq edi**: administrator butun shaklni toʻldirib yuborardi va
«bu telefon falonchida» degan `409` ni koʻrardi — keyin nima qilishni
bilmasdi.

Endi `GET /school/students/{id}/guardians/lookup?phone=` qoʻshildi.
Raqam kiritilishi bilan (9 raqamdan boshlab, 400 ms kechikish bilan)
tekshiriladi va savol chiqadi: «Bu raqam falonchi hisobiga bogʻlangan,
farzandi: … · shu vasiyga bu oʻquvchi ham biriktirilsinmi?»

Huquq `students.manage` — vasiy qoʻshish bilan bir xil. Bu ataylab
tor: aks holda endpoint telefon raqamlarini sanab chiqish yoʻliga
aylanardi (X-6). Ota-ona oʻz farzandi kartochkasida ham chaqira
olmaydi — testda tasdiqlangan.

## 2026-09-04 · Kartochkadagi amal tugmalari

Vasiy qatoridagi «Tahrirlash», «Asosiy qilish», «Bogʻlanishni uzish»
tagi chiziladigan MATN edi: tugmaga oʻxshamasdi va telefonda barmoq
tegadigan maydoni yoʻq edi. Endi ramkali, 36px balandlikda, belgisi
bilan. Boshlangʻich tugmalar ham bitta uslubga (`primaryBtn`)
keltirildi — ilgari har joyda alohida yozilgan va balandligi
har xil edi.

## 2026-09-04 · Shartnoma raqamlari kodga koʻchirildi

Loyiha egasi shartnoma PDF'ini berdi (`maxfiy/`). Oʻqib chiqilganda
kodda turgan ikkita raqam **hujjatga zid** ekani chiqdi:

| | Kodda | Shartnomada |
|---|---|---|
| Oylik | 3 500 000 | **2 300 000** (3.1) |
| Toʻlov muddati | 10-sana | **5-sana** (3.2-A) |

3 500 000 qayerdan kelgani nomaʼlum — hech qanday hujjatga
tayanmasdi. Oʻsha kuni 99 ta shartnoma shu summada ochilib
ketgan edi.

Tuzatish yoʻli: shartnoma 2 300 000 ga oʻzgartirildi, sentabr qarzi
esa QOTGAN (2-buzilmas qoida), shuning uchun farq har oʻquvchiga
**kredit-yozuv** bilan qaytarildi (99 × 1 200 000). Qarz yozuvi
oʻzgarmadi, tuzatish alohida qatorda va sababi koʻrinib turadi.
Toʻgʻridan-toʻgʻri oʻchirish rad etildi: `tuition_charges` da
(student, year, month) unikal cheklovi bor, arxivlash oʻrinni
boʻshatmaydi — demak «qayta hisoblash» yoʻli baribir SQL talab
qilardi.

Hujjatdagi qolgan raqamlar ham konstantaga aylandi: oldindan toʻlov
1 150 000, yillik oldindan toʻlovga 10%, 6 oylikka 5% chegirma.
Ularni test qoʻriqlaydi — raqam oʻzgarsa avval shartnoma oʻzgarsin.

Yoʻl-yoʻlakay maʼlum boʻldi: toʻlov jadvalidagi koʻp uchraydigan
«1150» — bu yarim toʻlov emas, shartnomadagi **majburiy boshlangʻich
toʻlov**.

## 2026-09-04 · Shartnoma hujjati — PDF kutubxonasisiz

Ota-ona kabinetiga «Shartnoma» boʻlimi qoʻshildi: hujjat matni
frontendda, qiymatlari `GET /school/students/{id}/contract` dan.

PDF kutubxonasi (reportlab, weasyprint) qoʻshilmadi. Loyihada
allaqachon `print-doc` mexanizmi bor — `globals.css` dagi chop etish
qoidasi sahifadagi qolgan hamma narsani yashiradi va brauzerning
«PDF sifatida saqlash» tugmasi haqiqiy PDF beradi. Yangi bogʻliqlik,
shrift muammosi va server yuki — hech biri kerak emas.

Muhim farq: hujjat **jonli** — shartnoma summasi oʻzgarsa sahifa ham
oʻzgaradi. Qogʻozdagi imzolangan nusxa esa oʻzgarmaydi, shuning uchun
sahifada «imzolangan qogʻoz nusxa asl hisoblanadi» deb yozib
qoʻyilgan.

## Chorak bahosi saqlanadi, har safar qayta hisoblanmaydi (T-031, JUR-04)

Chorak yakunlangach baho hujjatga aylanadi — tabelga, hisobotga va
oilaga ketadi. Agar u har soʻrovda qayta hisoblansa, keyin kimdir eski
darsning bahosini tuzatganda chorak bahosi oʻz-oʻzidan siljib ketardi.
Shuning uchun `term_grades` da yakunlangani saqlanadi, `computed_value`
esa yonida qoladi: «avtomatik 3 chiqqan edi, rahbar 4 qildi» savoliga
javob shu ikki ustunda.

Yaxlitlash yuqoriga (4.5 → 5). Python `round()` bank yaxlitlashini
qiladi va `round(4.5)` 4 chiqarardi — bu oʻquvchining zarariga.

## Chorak bahosini fan ustozi tuzatmaydi (T-031)

TZ JUR-04 «ustoz qoʻlda tuzata oladi» deydi, loyiha egasining 4-qoidasi
esa «chorak bahosi fan ustoziga koʻrinmaydi». Egasining qarori
(5-sentabr 2026): 4-qoida saqlanadi. Tuzatish sinf rahbari, oʻquv
boʻlimi va administrator qoʻlida; fan ustozi soʻrasa `403`. Direktor
roʻyxatda yoʻq — u maʼlumot kiritmaydi, shuning uchun `is_staff_wide`
ga tayanib boʻlmaydi (u direktorni ham ichiga oladi).

## Fayllar Cloudflare R2 da emas, serverning diskida (T-025)

Egasining qarori (5-sentabr 2026). Sabablar: R2 da Oʻzbekiston
mintaqasi yoʻq — fayl chet elda turardi; hisob va kalit kerak emas;
mavjud `backup.sh` allaqachon serverdan nusxa oladi.

Almashtirish qimmat emas: `storage.py` da faqat `save()` va
`read_bytes()` S3 chaqiruviga oʻtadi, qolgan hamma joy `file_id`
bilan ishlaydi.

Oqibati: zaxira endi ikki qismli. Faqat `pg_dump` olingan zaxira
TOʻLIQ EMAS — baza tiklanadi, ilovalar yoʻqoladi. `backup.sh` ga
`tarbion-files-*.tar.gz.age` qoʻshildi.

## Fayl havolasi imzolanadi, token bilan emas (T-025, X-7)

Brauzer `<img src>` va `<a href>` ga `Authorization` sarlavhasini
qoʻsha olmaydi, shuning uchun yuklab olish endpointi tokensiz.
Himoya HMAC imzoda: `HMAC-SHA256(jwt_secret, "<file_id>.<muddat>")`,
15 daqiqa.

«Bu faylga havola ber» degan umumiy endpoint ATAYLAB yozilmadi — u
boʻlsa har kim istalgan `file_id` ga havola olardi. Havolani faylni
ilova qilgan modul beradi, u oldin oʻz kirish tekshiruvini qiladi.
