# Xavfsizlik — Tarbion

`CLAUDE.md` dagi **X-1 … X-14** qoidalarining sababi, amaliy koʻrinishi va
tekshiruv roʻyxati. Qoidalarning oʻzi qisqa boʻlishi kerak — CLAUDE.md har
sessiyada oʻqiladi. Bu yerda esa "nega" va "qanday".

Ikkita gapni yodda tuting:

1. Bu tizimdagi maʼlumot **voyaga yetmaganlarga** tegishli — ismi, sinfi,
   bahosi, davomati, ota-onasining telefoni va manzili. Sizib chiqsa jarima
   emas, maktabning obroʻsi ketadi.
2. **Eng ehtimolli sizib chiqish — hujum emas, xodim.** Umumiy kompyuterda
   ochiq qolgan sessiya, oddiy parol, yoki roʻyxatni eksport qilib olib
   ketish. Qoidalarning yarmi shunga qarshi.

---

## 1. Kirish nazorati — eng muhim qism

### Nega birinchi

OWASP API Security Top 10 (2023 — hozirgi amaldagi nashr) da **BOLA**
(Broken Object Level Authorization) birinchi oʻrinda turadi. Sizning
tizimingizda u shunday koʻrinadi:

```
GET /api/v1/students/8f3a.../grades
```

Ota-ona URL dagi id ni oʻzgartiradi va boshqa oilaning farzandi bahosini
oladi. Hech qanday "hack" emas — brauzerdagi manzil qatorini tahrirlash.
Frontendda tugmani yashirish bunga **hech qanday** toʻsiq boʻlmaydi.

### Qanday qilinadi

Tekshiruv **query darajasida**, javobni filtrlash bilan emas:

```python
# TOʻGʻRI — baza faqat ruxsat etilganini qaytaradi
allowed = await accessible_student_ids(session, user)
stmt = select(Grade).where(Grade.student_id.in_(allowed))

# NOTOʻGʻRI — hammasi olinadi, keyin filtrlanadi
grades = await session.scalars(select(Grade))
return [g for g in grades if can_see(user, g)]
```

Ikkinchi variant bitta `return` unutilganda butun bazani beradi. Birinchisida
xato qilish uchun `where` ni ataylab oʻchirish kerak.

`backend/app/services/access.py` allaqachon shuni qiladi:

| Rol | Nimani koʻradi |
|---|---|
| admin / direktor / superadmin | hammasini (`None` = cheklov yoʻq) |
| ustoz | oʻzi dars beradigan + sinf rahbari boʻlgan sinflar |
| **ota-ona** | **faqat oʻz farzandlari** |
| oʻquvchi | faqat oʻzi |

### Uni unutib qoʻyish imkonsiz boʻlishi kerak

Bu eng zaif joy: yangi endpoint yozganda `access.py` ni chaqirmasangiz,
teshik ochiladi va **hech kim sezmaydi**. Uch qatlam:

1. Oʻquvchi maʼlumotini qaytaradigan endpoint majburiy dependency orqali
   oʻtsin — `Depends(student_scope)`
2. **Meta-test:** barcha route larni sanab chiqib, oʻquvchi maʼlumotini
   qaytaradigan lekin scope dan oʻtmaydiganini topsa — test yiqilsin
3. Har endpoint uchun salbiy test (quyida)

### Salbiy testlar (X-2)

Endpoint yozilgan zahoti, keyinga qoldirilmaydi:

```python
async def test_parent_cannot_see_other_child(client, parent_a, student_b):
    r = await client.get(f"/api/v1/students/{student_b.id}/grades",
                         cookies=parent_a.cookies)
    assert r.status_code == 403
```

Har rol uchun kamida bittadan: ota-ona → begona bola, ustoz → oʻzi dars
bermaydigan sinf, oʻquvchi → boshqa oʻquvchi.

### 403 va 404 (X-3)

Ruxsat yoʻq boʻlsa **har doim 403**. `404` "bunday oʻquvchi yoʻq" degani —
demak `403` kelgan id lar mavjud, `404` kelganlari yoʻq. Shu farq bilan
butun bazani sanab chiqish mumkin.

Xabar ham umumiy boʻlsin: "Bu oʻquvchi maʼlumotini koʻrishga ruxsatingiz
yoʻq" — ismi, sinfi aytilmaydi.

---

## 2. Sessiya va token

### Nega httpOnly cookie (X-4)

Hozirgi demo `localStorage` ishlatadi (`frontend/src/lib/auth.ts`) — bu
faqat demo uchun. Muammo: `localStorage` ni sahifadagi **har qanday**
JavaScript oʻqiy oladi. Bitta XSS — reklama skripti, buzilgan npm paketi,
ustoz kiritgan matnni ekranga chiqarishdagi xato — va token oʻgʻirlanadi.

`HttpOnly` cookie ni JavaScript **umuman koʻrmaydi**. XSS boʻlsa ham token
chiqmaydi.

```
Set-Cookie: tarbion_at=...; HttpOnly; Secure; SameSite=Lax;
            Path=/; Domain=.tarbion.uz; Max-Age=900
```

### Muddat va rotatsiya

| Token | Muddat | Qayerda |
|---|---|---|
| access | 15 daqiqa | httpOnly cookie |
| refresh | 30 kun | httpOnly cookie, `Path=/api/v1/auth` |

Refresh **rotatsiya bilan**: har yangilanishda eskisi bekor qilinadi.
Bekor qilingan refresh qayta ishlatilsa — bu oʻgʻirlik alomati, **butun
zanjir** bekor qilinadi va foydalanuvchi qaytadan kiradi.

### CSRF

`SameSite=Lax` koʻp holatni yopadi. Qoʻshimcha: oʻzgartiruvchi soʻrovlarda
(`POST` / `PATCH` / `DELETE`) maxsus sarlavha talab qilinadi — brauzer uni
cross-site soʻrovda yubora olmaydi.

### Brute force

Redis yoʻq, shuning uchun `login_attempts` jadvali:

- 5 ta muvaffaqiyatsiz urinishdan keyin hisob 15 daqiqaga qulflanadi
- Hisoblash **hisob boʻyicha ham, IP boʻyicha ham**
- Muvaffaqiyatsiz kirish `audit_log` ga tushadi

argon2id parametrlari `core/security.py` da: 64 MiB xotira, 3 iteratsiya.
Bu OWASP tavsiyasidan yuqori va bitta tekshiruv ~50–80 ms oladi —
foydalanuvchi sezmaydi, brute force uchun qimmat.

### 2FA (X-14)

Administrator, superadmin va direktorga majburiy. Ular butun bazani koʻradi
— bitta parol yetarli emas. TOTP (Google Authenticator), SMS emas.

---

## 3. Javobda nima chiqadi

### ORM modeli qaytarilmaydi (X-5)

```python
# NOTOʻGʻRI
@router.get("/students/{id}")
async def get_student(...) -> Student:   # SQLAlchemy modeli
    return student
```

Bugun zararsiz. Ertaga modelga `passport_number` qoʻshiladi — va u
**avtomatik** javobga tushadi. Hech kim sezmaydi.

```python
# TOʻGʻRI
@router.get("/students/{id}", response_model=StudentOut)
```

`StudentIn` va `StudentOut` alohida boʻladi. Bu mass assignment ni ham
toʻsadi: foydalanuvchi `{"role": "admin", "is_archived": false}` yuborsa,
`StudentIn` da bunday maydon yoʻq — eʼtiborsiz qoldiriladi.

### Roʻyxat va kartochka farqi (X-6)

| Endpoint | Nima qaytaradi |
|---|---|
| `GET /students` | id, ism, sinf, davomat foizi |
| `GET /students/{id}` | + telefon, manzil, vasiy maʼlumoti |

Roʻyxat endpointida shaxsiy maʼlumot boʻlmaydi. Sabab: roʻyxat koʻproq
odamga ochiq va eksport qilinadi.

---

## 4. Fayllar

### Presigned URL — oʻzi kalit (X-7)

R2 presigned URL da autentifikatsiya yoʻq. Havolani olgan **har kim** faylni
yuklab oladi — tizimga kirmasdan, rolidan qatʼi nazar.

Shundan kelib chiqadi:

- Muddat **15 daqiqa**. Uzaytirish soʻralsa — yoʻq deng, sabab shu
- URL **logga yozilmaydi**, analitikaga yuborilmaydi, xato xabarida
  koʻrsatilmaydi
- Bucket **private**, ommaviy kirish oʻchirilgan
- Yaxshirogʻi: `GET /files/{id}` endpointi huquqni tekshirib, yangi
  imzolangan URL ga `302` qiladi. Shunda havola sahifada, tarixda va
  koʻchirib yuborilgan xabarda qolmaydi

### Yuklashda

- Turi va hajmi **serverda** tekshiriladi, `Content-Type` ga ishonilmaydi
- Fayl nomi tozalanadi, R2 dagi kalit — UUID, foydalanuvchi bergan nom emas
- Bazada faqat kalit saqlanadi (10-domen qoidasi)

---

## 5. Telegram bot (X-8)

Bot backend bilan **umumiy bazada** ishlaydi. Demak botda ham xuddi shu
tekshiruv boʻlishi shart — alohida, soddalashtirilgan mantiq yozilmaydi.

Xavf: bot `telegram_id` ga qarab foydalanuvchini topadi. Agar u
foydalanuvchidan kelgan `student_id` ni tekshirmasdan qabul qilsa —
`/baholar <boshqa-bola-id>` ishlaydi.

Kerak:

- `telegram_id` bir marta **deep-link token** orqali bogʻlanadi
  (bir martalik token bilan `start` havolasi), telefon raqami bilan emas —
  raqamni bilgan har kim boshqa hisobga ulanib olardi
- Har soʻrov `access.py` dan oʻtadi
- Bot foydalanuvchidan kelgan id ni **hech qachon** ishonchli deb qabul
  qilmaydi

---

## 6. Toʻlov webhooklari (X-9)

Payme, Click va Uzum callbacklari — **autentifikatsiyasiz ochiq
endpointlar**. Ularning manzilini bilgan har kim soʻrov yubora oladi.

Uch qoida:

1. **Imzo tekshiriladi** — har provayderning hujjatida yozilgani boʻyicha
   (Payme: Basic auth; Click: `sign_string`)
2. **Summa callback dan olinmaydi.** Oʻz bazangizdagi hisob-kitob bilan
   solishtiriladi. Aks holda soxta callback bilan 1 soʻmga toʻlov
   "tasdiqlanadi"
3. **Idempotentlik** — bir xil tranzaksiya id ikki marta kelsa, ikki marta
   hisoblanmaydi. Takror soʻrov normal holat, xato emas

Toʻlov yozuvi tahrirlanmaydi va oʻchirilmaydi — xato boʻlsa storno
(9-domen qoidasi, TOL-07).

---

## 7. Infratuzilma

| Qoida | Nega |
|---|---|
| Postgres `127.0.0.1` ga bogʻlanadi | Internetga ochiq Postgres — eng koʻp uchraydigan sizib chiqish yoʻli |
| Ilova uchun alohida rol, superuser emas, `CREATE` yoʻq | SQL injection topilsa zarar cheklanadi |
| TLS — Caddy orqali, HSTS yoqilgan | Sizda allaqachon bor |
| `.env` git ga tushmaydi, `.env.example` yangilanadi | Repo ochiq |
| Zaxira **shifrlangan**, boshqa joyda | Oʻgʻirlangan zaxira = butun baza |
| Zaxira **tiklab koʻriladi** | Tiklanmaydigan zaxira — zaxira emas |

### Log (X-10)

Log da **hech qachon**: token, parol, parol xeshi, presigned URL, telefon,
manzil, hujjat raqami. Xato matnida ham. Log koʻpincha himoyasiz uzatiladi
va uzoq saqlanadi.

Foydalanuvchini log da `user_id` bilan koʻrsating, ism bilan emas.

---

## 8. Ichki xavf — eng ehtimollisi

Maktab tizimidan maʼlumot koʻpincha hakerlik bilan emas, **ichkaridan**
chiqadi. Uchta stsenariy:

1. Umumiy oʻqituvchilar xonasidagi kompyuterda ochiq qolgan sessiya
2. Ustozning oddiy paroli (tugʻilgan sana, ketma-ket raqamlar)
3. Xodim oʻquvchilar roʻyxatini eksport qilib olib ketishi

Qarshi choralar:

- **`audit_log`** — 4-domen qoidasi. Oʻchirilmaydi, tahrirlanmaydi
- **Eksport ham audit ga tushadi (X-13)** — kim, qachon, qaysi roʻyxatni
  yuklab oldi. Bu odatda unutiladi, lekin aynan shu yoʻl bilan maʼlumot
  chiqadi
- **Sessiyalar roʻyxati** va "barcha qurilmalardan chiqish" tugmasi
- **"Eslab qolish" oʻchirilgan boʻlsa `sessionStorage`** — umumiy kompyuterda
  keyingi odam login sahifasini koʻradi (bu allaqachon `lib/auth.ts` da bor)
- Parol siyosati: minimal 10 belgi, birinchi kirishda majburiy almashtirish
- Rol minimal boʻlsin — har kimga admin berilmasin

---

## 9. Maʼlumot qayerda saqlanadi

"Shaxsga doir maʼlumotlar toʻgʻrisida"gi qonun (OʻRQ-547), Prezident
**2026-yil 26-mart** kuni imzolagan tahrir:

| Maʼlumot | Talab |
|---|---|
| Biometrik, genetik | **Majburiy Oʻzbekistonda** |
| Telekom abonentlari | **Majburiy Oʻzbekistonda** |
| Qolgan shaxsga doir maʼlumot | Chet elda mumkin — shartlar bilan |

Chet elda saqlash shartlari: chet davlat yetarli himoya taʼminlasa, operator
tasdiqlangan shartnoma yoki korporativ qoidalarga rioya etsa, xalqaro
standartlar bajarilsa. Mamlakatlar roʻyxatini **Vazirlar Mahkamasi**
tasdiqlaydi.

**Tarbion uchun qaror:** baza va fayllar **Oʻzbekistonda**. Ikki sabab:

1. Oʻquvchi surati shaxsni aniqlash uchun ishlatilsa, biometrik deb talqin
   qilinishi mumkin — bu holda chet elda saqlash taqiqlanadi
2. Vazirlar Mahkamasi roʻyxati holati noaniq. Roʻyxatda Germaniya boʻlmasa,
   Contabo VPS da saqlash muvofiqlikni buzadi

Qoʻshimcha foyda: Toshkentdan kechikish 60–80 ms oʻrniga 5–10 ms.

⚠️ **Yuristdan tasdiq kerak:** bazani davlat reyestridan oʻtkazish shartmi
va Vazirlar Mahkamasi roʻyxati eʼlon qilinganmi. Hal boʻlmaguncha ishlab
chiqarish serveriga **real oʻquvchi maʼlumoti yuklanmaydi** — faqat demo.

---

## 10. Qurish tartibi

Xavfsizlik keyin qoʻshiladigan narsa emas. Tartib:

1. **Auth + sessiya** — httpOnly cookie, refresh rotatsiya, lockout
2. **`access.py` + majburiy dependency** — hech bir endpoint chetlab oʻtmasin
3. **Salbiy testlar** — endpoint yozilgan zahoti
4. **`audit_log`** — baho / davomat / toʻlov endpointlari bilan bir vaqtda
5. Qolgan modullar

---

## Endpoint tayyor deb hisoblanishi uchun

- [ ] `response_model` bor, ORM modeli qaytarilmaydi
- [ ] Kirish va chiqish sxemalari alohida
- [ ] Oʻquvchi maʼlumotini qaytarsa — `access.py` dan oʻtadi
- [ ] Ruxsat yoʻqligida `403`, xabar umumiy
- [ ] Salbiy test yozilgan va oʻtadi
- [ ] Baho / davomat / toʻlov / eksport boʻlsa — `audit_log` yozuvi bor
- [ ] Javobda ortiqcha shaxsiy maʼlumot yoʻq
- [ ] Log da token va PII yoʻq
- [ ] Migratsiya yozilgan (model oʻzgargan boʻlsa)


---

## Amalga oshirilgan himoya qatlamlari

Quyidagilar kodda bor va `tests/test_security_hardening.py` bilan
qulflangan. Testlar yiqilsa — kimdir himoyani bilmasdan olib tashlagan.

### Autentifikatsiya

| Himoya | Nimadan saqlaydi | Qayerda |
|---|---|---|
| argon2id (64 MiB, t=3) | baza o'g'irlansa parollarni ochish | `core/security.py` |
| Doimiy vaqtli tekshiruv | **foydalanuvchi enumeration** — mavjud login ~80 ms, mavjud bo'lmagani ~1 ms da javob qaytarardi | `verify_password_constant_time` |
| Login bo'yicha blok (5 → 15 daq) | bitta hisobga brute-force | `auth_service._is_locked` |
| IP bo'yicha blok (15 ta **turli** login) | **parol purkash** — bitta parolni 500 login bo'yicha sinash | `auth_service._ip_is_locked` |
| Umumiy xato matni | qaysi login mavjudligini bildirish | `InvalidCredentialsError` |
| Refresh rotatsiya + qayta ishlatishni aniqlash | o'g'irlangan refresh token | `auth_service.rotate_refresh` |
| `must_change_password` majburlash | 5 xonali boshlang'ich parol bilan butun yil ishlash | `api/v1/deps.py` |

**Nega IP bo'yicha «turli loginlar», xatolar soni emas:** butun maktab
bitta NAT ortidan chiqadi. O'quv yili boshida 500 kishi parolini xato
tersa, xatolar sonini sanaydigan qoida hammani bloklab qo'yardi. Oddiy
foydalanuvchi **o'zining bitta loginida** adashadi; hujumchi o'nlab
login bo'yicha urinadi — bu ikkisini ajratadigan yagona ishonchli belgi.

### Ruxsat

| Himoya | Nimadan saqlaydi |
|---|---|
| `access.py` — kesim **so'rov darajasida** | BOLA (OWASP API #1): URL dagi `student_id` ni almashtirish |
| Ruxsat yo'qligida `403`, umumiy xabar | obyekt mavjudligini oshkor qilish |
| Rol tokendan emas, **bazadan** o'qiladi | rol olib qo'yilgach eski token bilan ishlash |
| Kirish va chiqish sxemalari alohida | mass assignment (`{"role": "admin"}`) |
| Ro'yxatda PII yo'q (X-6) | ommaviy sizib chiqish |
| Test javoblarida `is_correct` **so'ralmaydi** | javoblarni oldindan olish |

### Tarmoq va transport

| Sarlavha | Nimadan saqlaydi |
|---|---|
| `X-Content-Type-Options: nosniff` | MIME sniffing orqali XSS |
| `X-Frame-Options: DENY` | clickjacking |
| `Content-Security-Policy: default-src 'none'` | API javobida hech narsa yuklanmasin |
| `Referrer-Policy` | id larni begona saytga uzatish |
| `Strict-Transport-Security` (ishlab chiqarishda) | SSL stripping |
| `Server: tarbion` | versiya bo'yicha CVE tanlash |

Bundan tashqari:

- **So'rov tanasi 1 MB bilan cheklangan** — parse qilishdan OLDIN.
  Bitta katta JSON bilan xotirani to'ldirish eng arzon DoS.
- **`X-Forwarded-For` faqat `TRUSTED_PROXIES` dan o'qiladi.** Sarlavhaga
  ko'r-ko'rona ishonish bloklashni butunlay aylanib o'tish yo'li: hujumchi
  har so'rovda yangi IP yozib qo'yaverardi.
- **Ishlab chiqarish sozlamasi ishga tushishda tekshiriladi.** Sozlama
  xatosi eng ko'p uchraydigan zaiflik manbai: kimdir `.env` ni nusxalaydi
  va `COOKIE_SECURE=false` yoki sinov `JWT_SECRET` i ishlab chiqarishga
  o'tib ketadi. Bunday holatda ilova **ishga tushmaydi**.

### Tekshirish

```bash
cd backend
uv run pytest tests/test_security_hardening.py -q   # izolyatsiyalangan baza
uv run python scripts/security_probe.py <superadmin-paroli>   # ishlab turgan server
```

`security_probe.py` hujumchi nima qilishini takrorlaydi: begona bolaning
ma'lumotini so'rash, boshqa ustozning jurnaliga kirish, test javoblarini
oldindan olish, huquq oshirish, soxta ball yuborish. 45 ta tekshiruv.

### Hali qilinmagan

- **2FA** administrator va direktor uchun (X-14) — TZ'da yo'q, lekin majburiy.
- **Umumiy rate limiting** — hozir faqat kirish cheklangan. Boshqa
  endpointlar uchun autentifikatsiyadan keyingi cheklov kerak
  (masalan bir foydalanuvchi daqiqada N so'rov).
- **Audit jurnalini o'zgartirishdan to'sadigan trigger** (T-021).
- **Zaxira nusxa shifrlash** (X-12, T-022).

---

## Manbalar

- [OWASP API Security Top 10 (2023) — BOLA birinchi oʻrinda](https://www.akto.io/blog/owasp-api-security-top-10)
- [Gazeta.uz — shaxsga doir maʼlumotlar qonuni tahriri, 28.03.2026](https://www.gazeta.uz/oz/2026/03/28/personal-data/)
- [Kun.uz — chet elda saqlashga ruxsat, 27.03.2026](https://kun.uz/news/2026/03/27/shaxsga-doir-ayrim-malumotlarni-ozbekistondan-tashqarida-saqlashga-ruxsat-berildi)
- [Gov.uz — OʻRQ-547 matni](https://gov.uz/oz/advice/61/document/2116)
- [PayTechUZ — Payme/Click/Uzum, FastAPI qoʻllab-quvvatlaydi](https://pay-tech.uz/en/)
