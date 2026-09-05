# Administrator qoʻllanmasi — Tarbion

Bu qoʻllanma **administrator** va **oʻquv boʻlimi** uchun. Maktabning
maʼlumot yadrosi shu qoʻlda: oʻquvchilar, hisoblar, jadval, toʻlov.

Sayt: **https://tarbion.uz**

---

## 0. Ishga tushirish tartibi

Yangi oʻquv yilini quyidagi **tartibda** oching — har qadam
oldingisiga tayanadi:

1. **Oʻquv yili va choraklar** (`Maʼlumotnomalar → Oʻquv yili`)
2. **Qoʻngʻiroqlar jadvali** — parasi belgilanmagan dars yaratilmaydi
3. **Fanlar va sinflar**
4. **Xodimlar** va ularga fan biriktirish
5. **Oʻquvchilar** va vasiylar
6. **Dars jadvali** (`Maʼlumotnomalar → Dars jadvali`)
7. **Darslarni generatsiya qilish** — chorak boʻyicha
8. **Shartnomalar va toʻlov jadvali**

Tartib buzilsa tizim aniq xato beradi: masalan qoʻngʻiroq vaqtisiz dars
yaratilmaydi, chunki davomatning 24 soatlik oynasi dars tugash vaqtidan
sanaladi.

---

## 1. Huquqlar — rol va huquq boshqa narsa

| | Nima belgilaydi |
|---|---|
| **Rol** | qaysi kabinetni ochadi, nima **koʻradi** |
| **Huquq** | nima **qila oladi** |

Ikkita administrator bir xil kabinetda ishlab, biri hisob ocha oladi,
ikkinchisi yoʻq. Huquqlar `Sozlamalar → Huquqlar` da beriladi.

Muhim huquqlar:

| Huquq | Nima beradi |
|---|---|
| `users.create` | yangi hisob ochish |
| `users.reset_password` | parolni tiklash |
| `permissions.grant` | boshqalarga huquq berish |
| `students.manage` | oʻquvchi qabul qilish, koʻchirish, arxivlash |
| `schedule.manage` | jadval tuzish, dars bekor qilish |
| `attendance.edit_closed` | 24 soat oʻtgan davomatni tuzatish |
| `payments.manage` | toʻlov kiritish va storno |
| `reports.export` | hisobotni Excel qilib yuklab olish |

> Super administratorga huquq berilmaydi — u hammasiga ega. Bu ataylab:
> aks holda u oʻzidan huquqni olib qoʻyib, tizimni qulflab qoʻyishi
> mumkin edi.

---

## 2. Oʻquvchi va vasiy

### Yangi oʻquvchi

`Oʻquvchilar → Yangi oʻquvchi`. Familiya, ism, sinf majburiy.

Hisob avtomatik ochiladi: login `familiya.ism` koʻrinishida, parol
vaqtinchalik. Ikkalasini oilaga bering.

### Vasiy biriktirish

Kartochkadagi «Vasiy qoʻshish» — **telefon raqamidan boshlanadi**.

Raqam bazada topilsa tizim aytadi: «Bu raqam Karimov Akmalga tegishli,
uning 1 ta farzandi bor. Shu vasiyga ikkinchi oʻquvchi biriktirilsinmi?»
Tasdiqlasangiz mavjud hisob ishlatiladi — oila ikkala bolani bitta
login bilan koʻradi.

Raqam topilmasa yangi vasiy hisobi ochiladi.

> Bir telefon — bir vasiy. Ikkita hisobga bir raqam qoʻyib boʻlmaydi.

### Chiqarish va qaytarish

Oʻquvchi **oʻchirilmaydi**, arxivlanadi. Uning oʻtgan yilgi baholari,
davomati va toʻlovlari hisobotda qoladi. Qaytib kelsa arxivdan
tiklanadi.

---

## 3. Jadval

`Maʼlumotnomalar → Dars jadvali`: sinf, fan, ustoz, hafta kuni, para,
xona.

Toʻqnashuv **avtomatik toʻsiladi**: bitta ustoz yoki bitta xona bir
vaqtda ikki joyda band boʻla olmaydi.

Jadval tayyor boʻlgach **darslarni generatsiya qiling** — chorak
boʻyicha. Generatsiya **idempotent**: ikki marta bossangiz ham darslar
ikkilanmaydi.

### Jadval istisnolari — bir kunlik oʻzgarish

`Maʼlumotnomalar → Jadval istisnolari`. Sana va sinfni tanlang, keyin
para ustida uch amaldan biri:

| Amal | Nima boʻladi |
|---|---|
| **Bekor qilish** | dars oʻtmaydi; davomat ham, baho ham olinmaydi |
| **Ustozni almashtirish** | faqat shu darsga; jadval oʻzgarmaydi |
| **Boshqa paraga** | vaqt qoʻngʻiroqdan qayta hisoblanadi |

Bekor qilishda **sabab majburiy** — u oilaga koʻrinadi.

> Bekor qilingan dars oʻchirilmaydi. U jadvalda «bekor qilingan» boʻlib
> turadi, shunda oila «dars nega yoʻq edi?» degan savolga javob topadi.

---

## 4. Davomat va DAV-03 oynasi

Ustoz davomatni **dars tugagandan keyin 24 soat** tahrirlaydi. Undan
keyin faqat `attendance.edit_closed` huquqi bori.

Har oʻzgarish audit jurnaliga tushadi: eski qiymat, yangi qiymat, kim,
qachon.

### Sababli qoldirish arizalari

Vasiy ariza yozadi, **sinf rahbari** tasdiqlaydi. Sinf rahbari taʼtilda
boʻlsa administrator ham qaror qila oladi.

Tasdiqlangan ariza oʻsha kunlardagi darslarni «sababli» qiladi —
24 soatlik oyna yopiq boʻlsa ham. Bu ataylab: ariza boshqa yoʻl, unda
hujjat bor, qaror kim tomonidan qabul qilingani yozilgan va har
oʻzgarish auditga tushadi.

Ustoz «keldi» degan darsga tegilmaydi — bola darsda boʻlgan.

---

## 5. Toʻlov

`Toʻlovlar` boʻlimida uch narsa: shartnomalar, toʻlov kiritish va
qarzdorlik.

### Shartnoma va hisoblash

Har oʻquvchiga shartnoma qoʻyiladi (oylik summa). Keyin oylik hisob
generatsiya qilinadi — sentabrdan maygacha.

> **Hisoblangan qarz qotadi.** Bir marta hisoblangan oy qayta
> hisoblanmaydi, shartnoma keyin oʻzgarsa ham. Aks holda oʻtgan oyning
> qarzi bugungi summa boʻyicha qayta yozilib, oila «men buni
> toʻlagandim» degan holatga tushardi.

### Toʻlov kiritish

Oʻquvchini tanlang → «Toʻlov kiritish» → summa, usul (naqd, karta,
oʻtkazma), sana va **chek raqami**.

Chek raqami — kvitansiya yoki bank kvitansiyasining raqami. Naqd
toʻlovda kassa kvitansiyasining raqamini yozing (masalan
`KV-2026-0001`). Boʻsh qoldirish mumkin, lekin tavsiya etilmaydi:
keyin «bu toʻlov qayerda?» savoliga javob shu raqam boʻladi.

### Xato toʻlov

Toʻlov **tahrirlanmaydi va oʻchirilmaydi**. Xato boʻlsa **STORNO**
qiling — teskari yozuv qoʻshiladi va ikkalasi tarixda qoladi.

Summani tuzatish kerak boʻlsa (masalan chegirma keyin maʼlum boʻlsa) —
**kredit-yozuv** ishlating. U hisoblangan qarzni kamaytiradi, uni qayta
hisoblamasdan.

### Qarzdorlik

Oʻquvchilar toʻrt holatga ajratiladi:

| Holat | Maʼnosi |
|---|---|
| **Toʻlagan** | hisoblangani toʻliq yopilgan |
| **Qisman** | biroz toʻlagan, qarzi bor |
| **Toʻlamagan** | umuman toʻlamagan |
| **Hisobsiz** | shartnomasi yoki hisobi yoʻq |

«Qisman» va «toʻlamagan» ni ajratish muhim: birinchisi bilan suhbat
boshqacha boʻladi.

---

## 6. Metodik baza

`Oʻquv boʻlimi → Metodika`.

**Excel oqimi:** shablonni yuklab oling → toʻldiring → yuklang (reja
**qoralama** boʻladi) → koʻrib chiqing → **«Joriy qilish»**. Shu ondan
reja ustozlar kabinetida koʻrinadi.

Bir (fan, yil, sinf) uchun bitta joriy reja. Yangisi joriy boʻlganda
eskisi **arxiv** ga oʻtadi — oʻchirilmaydi. Eski versiyaga qaytish uchun
uning yonidagi **«Qayta joriy qilish»** tugmasini bosing.

**Ustoz qoʻshgan reja** avval qoralama boʻladi va uni oʻquv boʻlimi
tasdiqlaydi. Bu sozlamadan oʻchirilsa ustoz oʻz rejasini oʻzi joriy
qiladi.

**Qidiruv** mavzu nomi, atama va jihoz boʻyicha ishlaydi. Natijada
«nima boʻyicha topildi» yozib qoʻyiladi.

---

## 7. Hisobotlar va eksport

`Rahbariyat → Hisobotlar` da uchta hisobotni **Excel** qilib yuklab
olish mumkin: sinflar kesimi, ustozlar faoliyati, toʻlov va qarzdorlik.

Buning uchun `reports.export` huquqi kerak — rol yetarli emas.

> **Har eksport audit jurnaliga tushadi**: kim, qachon, qaysi roʻyxatni
> yuklab oldi. Bu ataylab. Maktab maʼlumotining eng ehtimolli sizib
> chiqish yoʻli tashqi hujum emas, xodim.

PDF uchun sahifani brauzerdan chop eting (Ctrl+P → «PDF sifatida
saqlash»).

---

## 8. Audit jurnali

`Audit` boʻlimida har bir muhim amal koʻrinadi: baho, davomat, toʻlov,
huquq, eksport. Filtr amal turi va matn boʻyicha.

Audit yozuvi **oʻchirilmaydi va tahrirlanmaydi**. Tahrirlash tugmasi
ataylab yoʻq.

---

## 9. Parolni tiklash

Foydalanuvchi «Parolni unutdingizmi?» ni bosgan boʻlsa soʻrov
`Bosh sahifa → Parol tiklash navbati` da chiqadi.

`users.reset_password` huquqi bilan yangi **vaqtinchalik parol**
yasaysiz va uni foydalanuvchiga aytasiz. Tiklashdan keyin uning barcha
sessiyalari yopiladi.

Hech kim, hatto super administrator ham, mavjud parolni koʻra olmaydi —
bazada faqat uning shifri saqlanadi.

---

## 10. Qilmaslik kerak boʻlgan narsalar

- **Bir hisobni ikki kishiga bermang.** Audit «kim qildi» savoliga javob
  bera olmay qoladi.
- **Oʻquvchini oʻchirishga urinmang** — bunday tugma yoʻq, arxivlang.
- **Toʻlovni tuzatish uchun yangi toʻlov qoʻshmang** — storno yoki
  kredit-yozuv ishlating.
- **Ishlab turgan jadvalni chorak oʻrtasida qayta tuzmang** — oʻtgan
  darslar oʻzgarmaydi, lekin yangi generatsiya chalkashlik beradi.
  Bir kunlik oʻzgarish uchun **jadval istisnolari** bor.
