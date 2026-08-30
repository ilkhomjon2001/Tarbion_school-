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
uv run alembic upgrade head    # T-002 dan keyin
uv run uvicorn app.main:app --reload
```

`.env` da `JWT_SECRET` ni albatta almashtiring:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Tekshirish:

```bash
curl http://localhost:8000/health     # {"status":"ok"}
```

Interaktiv hujjat: <http://localhost:8000/docs>
(ishlab chiqarishda yopiladi).

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local     # bir marta
corepack pnpm install
corepack pnpm dev
```

<http://localhost:3000>

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
OpenAPI sxemasidan generatsiya qilinadi. Backend endpointi oʻzgarsa:

```bash
cd frontend
npx @hey-api/openapi-ts -i http://localhost:8000/openapi.json -o src/lib/api
```

Shundan keyin `pnpm exec tsc --noEmit` moslikni tekshiradi.

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
