# E2E — kritik oqim testi (T-023)

Bitta test bor va u bitta zanjirni tekshiradi:

> ustoz kiradi → davomat belgilaydi → saqlaydi → **ota-ona buni koʻradi**

Nega faqat bittasi: bu zanjir maktabning platformadan foydalanish
sababining oʻzi. Uzilsa qolgan hamma narsa maʼnosiz. Va u toʻrtta
qatlamdan oʻtadi — autentifikatsiya, ustoz kabineti, `services/access.py`,
ota-ona kabineti — shuning uchun bironta unit test uni butunligicha
tekshira olmaydi.

Qolgan hamma narsa arzonroq qatlamda qoplangan: biznes qoidalari —
`pytest`, tip nomuvofiqligi — `tsc`, backend/frontend kelishuvi —
`pnpm check:contracts`. E2E sekin va moʻrt, shuning uchun u yerda
faqat pastdagi qatlamlar ushlay olmaydigan narsa turadi.

Ikkinchi test — ota-ona ustoz boʻlimiga kira olmasligi (X-2 ning
brauzerdagi tasdigʻi).

---

## Lokalda ishga tushirish

Toʻrtta narsa kerak: baza, backend, E2E maʼlumoti, frontend.

```bash
# 0) Baza koʻtarilgan va migratsiya oʻtgan boʻlsin
cd backend && uv run alembic upgrade head

# 1) E2E maʼlumoti — bitta sinf, ustoz, oʻquvchi, vasiy va BUGUNGI dars
E2E_PASSWORD='E2eSinov2026!' uv run python -m app.e2e_seed

# 2) Backend. Uchta sozlama ATAYLAB boshqacha:
#    · COOKIE_SECURE=false — brauzer `http://127.0.0.1` da, `Secure`
#      cookie umuman saqlanmaydi va login'dan oʻtib boʻlmaydi
#    · REQUIRE_TWO_FACTOR=false — 2FA alohida pytest testlarida
#    · CORS_ORIGINS — frontend 3100 portda
COOKIE_SECURE=false REQUIRE_TWO_FACTOR=false \
  CORS_ORIGINS='http://127.0.0.1:3100' \
  uv run uvicorn app.main:app --port 8000

# 3) Frontend — `NEXT_PUBLIC_*` BUILD paytida qotadi, shuning uchun
#    build ham shu manzil bilan qilinadi
cd ../frontend
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 pnpm build

# 4) Birinchi safar brauzer yuklab olinadi
pnpm e2e:install

# 5) Test. `webServer` frontendni oʻzi 3100 portda koʻtaradi.
E2E_PASSWORD='E2eSinov2026!' pnpm e2e
```

`E2E_PASSWORD` berilmasa testlar **oʻtib ketadi**, yiqilmaydi — muhitsiz
chaqirilganda uzun stek izidan koʻra aniq sabab yaxshiroq.

`pnpm build` ni `NEXT_PUBLIC_API_URL` bilan qilish SHART: bu qiymat
build paytida kodga qotadi. Usiz build sukut boʻyicha `localhost:8000`
ga murojaat qiladi, sahifa esa `127.0.0.1:3100` da ochiladi va sessiya
tiklanmasdan login sahifasiga qaytaraveradi.

### CI ni lokalda takrorlash

CI **toza** bazada ishlaydi, lokal baza esa toʻla. Farq test natijasini
oʻzgartiradi, shuning uchun shubhali holatda toza bazada sinang:

```bash
# pytest bazasining sxemasini boʻshatib, CI ketma-ketligini takrorlaymiz
# (lokal rol yangi baza YARATA olmaydi — X-11, ataylab)
cd backend
DATABASE_URL="$TEST_DATABASE_URL" uv run alembic upgrade head
DATABASE_URL="$TEST_DATABASE_URL" E2E_PASSWORD='...' uv run python -m app.e2e_seed
DATABASE_URL="$TEST_DATABASE_URL" COOKIE_SECURE=false REQUIRE_TWO_FACTOR=false   CORS_ORIGINS='http://127.0.0.1:3100' uv run uvicorn app.main:app --port 8000
```

Yiqilsa iz koʻriladi:

```bash
pnpm exec playwright show-trace test-results/<papka>/trace.zip
```

## Tashqi manzilda sinash

`E2E_BASE_URL` berilsa Playwright hech narsa koʻtarmaydi va oʻsha
manzilni sinaydi. **Ishlab chiqarishda ishlatilmaydi:** test davomat
yozadi va real oʻquvchining jurnaliga tegadi.

## CI da

`e2e` ishi (`.github/workflows/deploy.yml`) oʻzi hammasini quradi:
postgres xizmati → `alembic upgrade head` → `app.e2e_seed` → uvicorn →
`pnpm build` → `pnpm e2e`. Yiqilganda iz va ekran surati artefakt
sifatida saqlanadi (7 kun).

**Deploy'ni TOʻSADI.** Bloklamaydigan test — hujjat, test emas. `[tez]`
belgisi bilan qilingan shoshilinch commit'da esa u ham oʻtkazib
yuboriladi.

## E2E maʼlumoti

`backend/app/e2e_seed.py`. Idempotent — qayta ishga tushirilsa mavjud
yozuvlarni topib ishlatadi.

| Nima | Qiymat |
|---|---|
| Ustoz | `e2e.ustoz` |
| Ota-ona | `e2e.otaona` |
| Oʻquvchi | Sinovov Oʻquvchi |
| Sinf | `E2E-1` |
| Dars | **bugun**, 1-para, «hozirdan 2 soat oldin» |

Dars vaqti **nisbiy** — qatʼiy soat emas. DAV-03 boʻyicha boshlanmagan
darsga davomat yozib boʻlmaydi, shuning uchun dars har doim allaqachon
boshlangan boʻlishi kerak. Vaqt mahalliy kun chegarasiga qisiladi:
natija har doim bugungi kunda va har doim oʻtmishda.

Ilgari bu yerda qatʼiy 08:30 turardi va test **kun vaqtiga bogʻliq**
edi: CI ertalab soat 07:41 (Toshkent) da ishga tushdi, dars hali
boshlanmagan edi va davomat katagi oʻchiq chiqdi. Lokalda esa kechqurun
sinalgani uchun oʻtib ketardi.

Skript har yugurishda oʻsha darsning davomat yozuvlarini **tozalaydi**.
Sababi bir marta tushilgan: yozuv oldingi yugurishdan qolganda katak
allaqachon «Kelmadi» boʻlib turadi, «Saqlash» tugmasi oʻchiq boʻladi va
test saqlash yoʻlini umuman bosib oʻtmasdan «oʻtdi» deb chiqadi.

Bu yerdagi `DELETE` 1-domen qoidasiga zid emas — u domen maʼlumoti emas,
test iskalasi. Skript `APP_ENV=production` da umuman ishlamaydi.

## Yorliqlar bir xil emas

Bir xil holat ikki kabinetda boshqacha atalgan va test ikkalasini ham
biladi:

| Holat | Ustoz jurnalida | Ota-ona kalendarida |
|---|---|---|
| `absent` | Kelmadi | Sababsiz |

Atayin: ota-onaga sababning **yoʻqligi** muhim.
