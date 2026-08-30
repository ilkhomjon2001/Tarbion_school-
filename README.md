# Tarbion

"Tarbion" xususiy maktabi uchun veb-platforma. Toʻrtta kabinet: ustoz,
oʻquvchi, ota-ona, rahbariyat — ustiga administrator paneli.

**Mobil ilova yoʻq.** Veb, mobile-first, 360px dan boshlab.

Qoidalar va konvensiyalar — [`CLAUDE.md`](CLAUDE.md).
Git tartibi — [`docs/GIT.md`](docs/GIT.md).
Xavfsizlik — [`docs/XAVFSIZLIK.md`](docs/XAVFSIZLIK.md).

---

## Nima kerak

| | Versiya | Tekshirish |
|---|---|---|
| Node.js | 20+ | `node --version` |
| pnpm | corepack orqali | `corepack pnpm --version` |
| Python | 3.12 | `python --version` |
| uv | 0.5+ | `uv --version` |
| PostgreSQL | 18 | `docker compose up -d` yoki lokal oʻrnatma |

---

## Ishga tushirish

Uchta terminal kerak: baza, backend, frontend.

### 1. Baza

```bash
docker compose up -d
docker compose logs -f db      # "database system is ready" chiqishini kuting
```

`tarbion` (ishchi) va `tarbion_test` (testlar uchun) bazalari
avtomatik yaratiladi.

**Docker yoʻq boʻlsa** — PostgreSQL 18 ni lokal oʻrnating, soʻng rol va
bazalarni bir marta yarating:

```sql
CREATE ROLE tarbion WITH LOGIN PASSWORD 'tarbion';
CREATE DATABASE tarbion      OWNER tarbion ENCODING 'UTF8';
CREATE DATABASE tarbion_test OWNER tarbion ENCODING 'UTF8';
```

```bash
psql -U postgres -h 127.0.0.1 -f - < shu-sql
```

Parol boshqacha boʻlsa `backend/.env` dagi `DATABASE_URL` va
`TEST_DATABASE_URL` ni moslang.

### 2. Backend

```bash
cd backend
cp .env.example .env           # bir marta
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

`.env` da `JWT_SECRET` ni albatta almashtiring:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Tekshirish:

```bash
curl http://localhost:8000/health         # {"status":"ok"}          — ilova tirikmi
curl http://localhost:8000/health/ready   # {"status":"ok",...}     — baza ulanganmi
```

Interaktiv hujjat: <http://localhost:8000/docs>
(ishlab chiqarishda yopiladi).

### Birinchi super administrator

Tizimda oʻz-oʻzidan roʻyxatdan oʻtish yoʻq — hisobni faqat huquqi bor
administrator ochadi. Birinchi hisob shu buyruq bilan yaratiladi:

```bash
cd backend
uv run python -m app.create_superadmin --last Familiya --first Ism
```

Login `familiya.ism` shaklida yasaladi, parol esa tasodifiy generatsiya
qilinadi va **bir marta** ekranga chiqadi — bazada faqat xeshi qoladi.

Sinov uchun parolni oʻzingiz berishingiz mumkin:

```bash
uv run python -m app.create_superadmin --last Familiya --first Ism     --password 'Tarbion2026!'
```

Hisob mavjud boʻlsa qayta yaratilmaydi; parolni yangilash uchun
`--reset-password` qoʻshing.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local     # bir marta
corepack pnpm install
corepack pnpm dev
```

<http://localhost:3000>

### 4. Demo maʼlumot

Boʻsh baza bilan hech narsani koʻrib boʻlmaydi — rahbariyat kabineti,
davomat va jurnal maʼlumot talab qiladi. Seed ikki qadamda:

```bash
cd frontend && corepack pnpm export:seed   # backend/seed-data.json yozadi
cd backend  && uv run python -m app.seed   # bazaga yuklaydi
```

Yuklanadi: 16 sinf, 20 xodim, 362 oʻquvchi va vasiy, 194 dars sloti,
776 dars, ~17 600 davomat yozuvi, ~2 800 baho (24-avgust — 20-sentabr).

Manba — frontenddagi mock maʼlumot (`lib/school/staff.ts`,
`lib/director/school-data.ts`). Nega shunday: u yerda ustozlar, sinflar,
dars yuklamasi va oʻquvchilar allaqachon oʻzaro mos. Backendda qayta
yozilsa ikkinchi haqiqat manbasi paydo boʻlardi va raqamlar farq qilardi.
Davomat foizi ham oʻsha yerdan keladi — bazadan hisoblangan umumiy
davomat (87.2%) mock bilan bir xil chiqadi.

`seed-data.json` git'ga tushmaydi: u generatsiya natijasi va
deterministik — kim ishga tushirsa ham bir xil fayl chiqadi.

Qayta yuklash (avval tozalaydi):

```bash
cd backend && uv run python -m app.seed --reset
```

`--reset` domen jadvallarini TRUNCATE qiladi va `APP_ENV=production` da
ishlamaydi. Demo hisoblarning paroli — `Tarbion2026!`, hammasida
«parolni almashtirish» bayrogʻi yoqilgan.

---

## Testlar

```bash
cd backend && uv run pytest -q
cd backend && uv run ruff check . && uv run ruff format --check .
cd frontend && corepack pnpm exec tsc --noEmit
cd frontend && corepack pnpm build
```

> `pnpm build` ni dev server ishlab turganda ishlatmang — ikkalasi bitta
> `.next` papkasini ishlatadi va dev server buziladi. Avval toʻxtating.

---

## API tiplari

Frontenddagi TypeScript tiplari **qoʻlda yozilmaydi** — backendning
OpenAPI sxemasidan generatsiya qilinadi. Backend endpointi oʻzgarsa
(uvicorn ishlab turgan holda):

```bash
cd frontend && corepack pnpm gen:api
```

Natija `src/lib/api/` ga tushadi va git'da saqlanadi — shunda backend
ishlamayotgan mashinada ham `pnpm build` oʻtadi. Qoʻlda tahrirlanmaydi;
eslint uni ataylab tekshirmaydi.

`operationId` backendda `generate_unique_id_function` bilan belgilanadi,
shuning uchun funksiya nomlari `directorOverview` koʻrinishida — FastAPI
standarti `overviewApiV1DirectorOverviewGet` degan nom yasaydi.

Shundan keyin `pnpm exec tsc --noEmit` moslikni tekshiradi.

### Sessiya

`src/lib/session.ts` — access token XOTIRADA, `localStorage` da emas.
Sahifa yangilanganda `restore()` httpOnly cookie'dagi refresh token
orqali yangi access token oladi. `withAuth()` 401 kelganda bir marta
yangilab qayta uradi.

Jonli maʼlumotni koʻrish: <http://localhost:3000/rahbar/jonli> —
kirish `+998 90 100 00 01` / `Tarbion2026!` (seed direktori).
Qolgan rahbariyat sahifalari hali mock ustida ishlaydi.

---

## Tuzilma

```
backend/     FastAPI · SQLAlchemy 2.0 (async) · Alembic · Pydantic v2
frontend/    Next.js 15 (App Router) · TypeScript · Tailwind v4 · TanStack Query
bot/         aiogram 3 — backend bilan umumiy baza
docs/        GIT.md · XAVFSIZLIK.md · DECISIONS.md
TASKS.md     backlog — ishni shu yerdan oling
```

---

## Ishlashdan oldin

1. `git pull` — kunni shu bilan boshlang
2. `TASKS.md` da taskni `[ ]` dan `[~]` ga oʻtkazing va **darhol push qiling**
3. Push qilishdan oldin **yana `git pull`**

Ikkalamiz ham toʻgʻridan-toʻgʻri `main` da ishlaymiz — branch va PR yoʻq.
Batafsil: [`docs/GIT.md`](docs/GIT.md).
