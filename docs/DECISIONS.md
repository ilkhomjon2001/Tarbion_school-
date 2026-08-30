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
