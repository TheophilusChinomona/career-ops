# CareerOps Web

Next.js 16 (App Router) + Prisma 7 + Playwright Chromium web interface for the CareerOps job-search pipeline.

## Prerequisites

- Docker + Docker Compose
- A running ParadeDB instance (default: `100.69.186.86:5438`, db `careerops_dev`)
- API keys (LLM + Firecrawl) for evaluate / generate / search features

## Required Environment Variables

Create `web/.env` (gitignored):

```env
# ── Database ──────────────────────────────────────────────────────────────────
# Point at your ParadeDB / Postgres instance.
# From inside Docker, use host.docker.internal to reach the host machine.
DATABASE_URL=postgresql://careerops:<password>@host.docker.internal:5438/careerops_dev

# ── Auth ──────────────────────────────────────────────────────────────────────
BETTER_AUTH_SECRET=<random 32+ char secret>
# Public URL the app is reachable at (used by Better Auth for CSRF / redirects)
BETTER_AUTH_URL=http://localhost:3000

# ── Encryption ────────────────────────────────────────────────────────────────
# Exactly 32 characters — used to encrypt stored API keys
APP_ENCRYPTION_KEY=<exactly-32-character-string>

# ── LLM providers (required for Evaluate / Generate features) ─────────────────
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...

# ── Firecrawl (required for Job Search feature) ───────────────────────────────
FIRECRAWL_API_KEY=fc-...
```

> Note: LLM and Firecrawl keys are optional at startup but required for the
> Evaluate, Tailor CV, Cover Letter, and Find Jobs features to function.

## Run with Docker Compose

```bash
# From the career-ops/web/ directory:
docker compose build
docker compose up -d

# Smoke-test (expect 200 or 307 redirect to /login):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
```

The entrypoint automatically runs `prisma migrate deploy` before starting the
Next.js server, so the database schema is always current.

### Tear down

```bash
docker compose down
# To also remove the PDF volume:
docker compose down -v
```

## Database: First-time setup

The `careerops` DB user lacks `CREATE DATABASE`. Create the database manually
(as a superuser) before first run:

```sql
CREATE DATABASE careerops_dev OWNER careerops;
```

The migration (`prisma/migrations/0_init`) is applied automatically on container
start via `prisma migrate deploy`.

## Seeding

After first run, seed your profile and CV through the UI:

1. Open `http://localhost:3000` and create your account at `/login`.
2. Navigate to **Profile** and click **"Seed from repo files"** — this reads
   `cv.md` and `config/profile.yml` from the parent repo (mounted into the
   container at `/app/`) and populates Profile + CV Master.

Alternatively, run the seed script directly (requires a `.env` with
`DATABASE_URL`):

```bash
# From career-ops/web/:
set -a; . ./.env; set +a
npx tsx scripts/seed.ts
```

## Development (local, no Docker)

```bash
cd career-ops/web
npm install
npm run dev
```

Ensure `web/.env` (or `.env.local`) has `DATABASE_URL` pointing at a reachable
Postgres/ParadeDB instance, then run:

```bash
npx prisma migrate deploy
npx prisma generate
```

## Architecture notes

- **Build context** is the repo root (`career-ops/`), so Docker can include
  `generate-pdf.mjs`, `fonts/`, `templates/`, `config/`, and `cv.md`.
- **Standalone output** (`next.config.ts → output: "standalone"`) produces a
  self-contained server bundle — no need to copy the full `node_modules` into
  the image.
- **cwd inside the container** is `/app/web`; parent assets sit at `/app/`
  (one level up), matching how `src/render/pdf.ts` resolves `baseDir`.
- **PDF volume** (`careerops_pdfs`) is mounted at `/app/web/storage/pdfs` so
  generated PDFs persist across container restarts.
- **ParadeDB** is external — the container connects over the host network via
  `host.docker.internal:5438`. No DB service is defined in compose.
