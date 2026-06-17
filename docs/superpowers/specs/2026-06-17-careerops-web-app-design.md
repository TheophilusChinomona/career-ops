# CareerOps Web App — Design Spec

**Date:** 2026-06-17
**Status:** Approved (design); pending implementation plan
**Phase:** A (of A→B→C roadmap)

## 1. Problem & Goal

career-ops today is an **AI-agent-driven** job-search toolkit: the intelligence (fit
evaluation, CV tailoring, cover-letter writing) is performed by a coding agent reading
markdown "mode" instructions, supported by deterministic Node scripts (PDF rendering via
Playwright, ATS/Firecrawl scanning, tracker management) and a read-only Go TUI dashboard.

**Goal:** turn the workflow into a self-serve **full-stack web app** so a user logs in and
runs the whole loop (profile → search → evaluate → tailor CV/cover letter → track → assisted
apply) from a browser, deployable via Docker. The "brain" moves from the agent loop into a
backend service that calls an LLM API directly.

**v1 ambition (decided):** *personal power-tool first* — make it excellent for a single user,
self-hosted, architected so multi-user (students) and browser auto-apply add on later without
a rewrite.

## 2. Scope

This is one of five subsystems; we build the first slice now.

**In scope (Phase A):**
- Single-user auth (Better Auth) with a real session.
- Web dashboard: Dashboard, Find Jobs, My Jobs, Documents, Profile & CV.
- Generation engine ("brain") behind a configurable LLM provider interface.
- Job search via Firecrawl.
- Evaluation (A–G scoring), tailored CV + cover-letter generation, PDF rendering.
- Application tracker (replaces `applications.md`).
- **Assisted apply**: open the posting + surface the generated docs + draft answers; user submits.
- Docker deployment, local-first, VPS-ready.

**Explicitly NOT in v1 (YAGNI):** auto-submit browser workers, multi-tenant accounts/billing,
email notifications, mobile app, the Go TUI (web dashboard supersedes it).

**Deferred phases:**
- **Phase B** — auto-submit workers for Greenhouse/Lever/Workable (job queue + Playwright worker container; hybrid apply: auto on safe ATS, assisted elsewhere).
- **Phase C** — multi-user for students (Better Auth multi-account, per-user encrypted keys, managed Postgres, usage limits).

## 3. Architecture

**One Next.js app (TypeScript, App Router) + Playwright/Chromium, in one Docker container.**
Connects to an existing external **ParadeDB** (Postgres-compatible) instance.

```
┌─────────────────────────────────────────────┐
│  Docker: career-ops-web (Next.js)            │
│   • React + Tailwind dashboard               │
│   • API routes / server actions              │
│   • LLMProvider interface (configurable)     │
│   • Reuses Node logic: generate-pdf          │
│     (Playwright), Firecrawl scan, CV templates│
│   • Chromium baked in (PDF now, workers later)│
│   • Better Auth (session)                    │
└───────────────┬─────────────────────────────┘
                │ DATABASE_URL
        ┌───────▼────────┐
        │  ParadeDB      │  (external, existing; db: careerops)
        │  (Postgres)    │
        └────────────────┘
   secrets via .env: LLM key(s), FIRECRAWL_API_KEY, DATABASE_URL
```

**Key choices:**
- **DB:** external ParadeDB, dedicated `careerops` database, Prisma migrations build the schema. Plain Postgres queries in v1 (ParadeDB `pg_search`/BM25 is an optional Phase-B+ optimization, not a dependency). Web container shares a Docker network with / can reach ParadeDB.
- **Auth:** Better Auth (email/password + session) — single account in v1; multi-account is config later.
- **ORM:** Prisma (typed access + clean Better Auth adapter).
- **Reuse, don't rewrite:** `generate-pdf.mjs` (HTML→PDF), the CV HTML templates, and Firecrawl calls become server-side modules. The markdown modes (`_shared.md`, `oferta.md`, `pdf.md`) become versioned server-side prompt templates.
- **Deploy:** local Docker first; portable to a VPS unchanged (always-on features like scheduled scans land in Phase B).

## 4. Data Model

Better Auth owns `user`, `session`, `account`, `verification`. Domain tables hang off `user.id`
(every domain row carries `userId` from day one → multi-tenant is additive).

| Table | Replaces | Key fields |
|---|---|---|
| **Profile** | `config/profile.yml` | userId, fullName, email, phone, location, targetRoles[], compTarget, narrative, llmProvider, model |
| **CvMaster** | `cv.md` (structured) | userId, summary, experience[], education[], certs[], skills[] (JSON blocks, render + tailor) |
| **Job** | `data/applications.md` rows | id, userId, company, role, location, url, applyUrl, source, rawJD, postedAt, status, score, archetype |
| **Evaluation** | `reports/*.md` | jobId, score, blocksAtoG (JSON), legitimacy, recommendApply, notes |
| **Document** | `output/*.pdf` | id, userId, jobId?, type (cv\|cover), label, html, pdfPath, createdAt |
| **ApiKey/Setting** | `.env` per-user | userId, provider, encryptedKey, defaults |

- `CvMaster` is structured JSON (not raw markdown) so the app renders the polished PDF template and the LLM tailors specific sections per job.
- `Job.status` uses the existing canonical states: Evaluated / Applied / Responded / Interview / Offer / Rejected / Discarded / SKIP.
- `Document` ties each generated CV/cover variant to its job.

## 5. Generation Engine (the "brain")

One `LLMProvider` interface, env-selected (`LLM_PROVIDER=claude|openai|gemini`):

```
generateEvaluation(profile, cvMaster, jobJD) -> { score, blocksA-G, legitimacy, recommend }
generateTailoredCv(cvMaster, jobJD, archetype) -> structured CV JSON
generateCoverLetter(profile, cvMaster, jobJD) -> letter text
```

- Markdown modes become versioned server-side prompt templates (same logic, now a function call).
- LLM output is **Zod-validated** before persisting (evaluation schema); malformed output → one auto-retry, then surface raw text.
- All LLM/Firecrawl calls are server-side only.

## 6. Core Flow (dashboard actions)

1. **Search** — query + filters → Firecrawl → candidate `Job` rows (dedupe vs existing).
2. **Evaluate** — pick a job → `generateEvaluation` → saves `Evaluation`, sets score + status.
3. **Generate docs** — `generateTailoredCv` + `generateCoverLetter` → Playwright HTML→PDF → `Document` rows.
4. **Assisted apply** — opens `applyUrl` + surfaces CV/cover PDFs + draft answers → user submits → mark `Applied`.
5. **Track** — pipeline board reads `Job` + `Evaluation`.

## 7. UI

**App shell:** left sidebar nav (Dashboard, Find Jobs, My Jobs, Documents, Profile & CV, Settings),
content on the right. (Chosen over top-nav for scalability.)

**Screens (v1):**
1. **Dashboard** — pipeline board + quick stats (counts by status, avg/top score). Landing page.
2. **Find Jobs** — search + filters → results → "Add to pipeline" / "Evaluate now".
3. **My Jobs** — tracker table/board; click a job → **full detail page**.
4. **Documents** — every generated CV + cover letter, download/preview.
5. **Profile & CV** — form editor for Profile + structured CvMaster.

**Job detail (full page, chosen over drawer for content density):** header (company, role,
fit, legitimacy, remote, status dropdown); action bar (⚡ Evaluate · 📄 Tailor CV · ✉ Cover
letter · ↗ Apply); content tabs/columns: JD, Evaluation A–G, Documents.

## 8. Cross-cutting

**Secrets/config:** keys in `.env`/Docker env, server-side only; per-user `ApiKey` encrypted at
rest (used in Phase C); `DATABASE_URL` → ParadeDB `careerops`.

**Error handling:** each action independent with clear success/fail + inline retry; external
calls (Firecrawl, LLM, liveness) wrapped with timeouts + retries; evaluation output
schema-validated with one auto-retry.

**Testing:**
- Unit: provider interface (mocked LLM), CV/cover prompt builders, PDF render validity, evaluation schema validation.
- Integration: search→save, evaluate→store, generate→document, status transitions.
- Port deterministic pieces (PDF pipeline, tracker logic) preserving behavior.

## 9. Open Items for the Implementation Plan

- Exact Prisma schema + Better Auth adapter wiring against ParadeDB.
- Prompt-template extraction from existing modes (evaluation, CV, cover).
- Importer: seed Profile/CvMaster from existing `cv.md` + `config/profile.yml`.
- Reuse path for `generate-pdf.mjs` + CV HTML template inside Next.js server runtime.
- Dockerfile (Next.js + Chromium deps) + `docker-compose` (web + external DB network).
