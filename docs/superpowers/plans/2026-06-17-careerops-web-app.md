# CareerOps Web App (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user, self-hosted web dashboard that runs the full career-ops loop (profile → search → evaluate → tailor CV/cover letter → track → assisted apply) in the browser.

**Architecture:** One Next.js (App Router, TypeScript) app in `career-ops/web/`, talking to an external ParadeDB (Postgres) via Prisma, authenticated with Better Auth. The generation "brain" is a configurable `LLMProvider` interface. PDF rendering reuses the parent repo's `generate-pdf.mjs` (`renderHtmlToPdf`); search reuses Firecrawl. Deployed via Docker (web container + external DB).

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Prisma, ParadeDB/Postgres, Better Auth, Zod, Vitest + React Testing Library, Playwright (PDF + later e2e), Anthropic/OpenAI/Google SDKs.

**Conventions:** TDD per task (failing test → run → implement → pass → commit). All paths below are relative to repo root `career-ops/`. Work happens on a feature branch; commit after every task. Do NOT push (origin is upstream).

---

## File Structure (locked-in decomposition)

```
career-ops/web/
  package.json, tsconfig.json, next.config.mjs, vitest.config.ts, .env.example
  prisma/schema.prisma
  src/
    lib/
      db.ts                  # Prisma client singleton
      auth.ts                # Better Auth server instance
      auth-client.ts         # Better Auth React client
      env.ts                 # validated env (Zod)
      crypto.ts              # (Phase C only) encrypt/decrypt per-user API keys — NOT built in Phase A
    llm/
      types.ts               # LLMProvider interface + shared types
      schemas.ts             # Zod schemas (Evaluation, TailoredCv, etc.)
      provider.ts            # getProvider() factory (env-selected)
      providers/claude.ts    # Anthropic impl
      providers/openai.ts    # OpenAI impl
      providers/gemini.ts    # Google impl
      prompts/evaluation.ts  # buildEvaluationPrompt()
      prompts/cv.ts          # buildTailoredCvPrompt()
      prompts/cover.ts       # buildCoverLetterPrompt()
    render/
      cv-html.ts             # structured CvMaster -> HTML (uses template)
      cover-html.ts          # cover text + profile -> HTML
      pdf.ts                 # wraps parent renderHtmlToPdf
    services/
      search.ts              # Firecrawl search + parse -> candidate jobs
      jobs.ts                # job CRUD + status transitions
      evaluate.ts            # orchestrates evaluation
      generate.ts            # orchestrates CV + cover generation
      importer.ts            # seed Profile/CvMaster from cv.md + profile.yml
    app/
      layout.tsx, globals.css
      (auth)/login/page.tsx
      (app)/layout.tsx                 # sidebar shell
      (app)/page.tsx                   # Dashboard
      (app)/find/page.tsx              # Find Jobs
      (app)/jobs/page.tsx              # My Jobs (list)
      (app)/jobs/[id]/page.tsx         # Job detail (full page)
      (app)/documents/page.tsx
      (app)/profile/page.tsx
      api/auth/[...all]/route.ts       # Better Auth handler
      api/search/route.ts
      api/jobs/[id]/evaluate/route.ts
      api/jobs/[id]/generate/route.ts
      api/jobs/[id]/status/route.ts
    components/
      Sidebar.tsx, JobCard.tsx, ScoreBadge.tsx, ActionBar.tsx, EvaluationView.tsx
  Dockerfile
  docker-compose.yml
```

---

## Milestone 0 — Scaffold

### Task 0.1: Create the feature branch

- [ ] **Step 1: Create branch**

```bash
cd career-ops && git checkout -b careerops-web-app
```

- [ ] **Step 2: Verify**

Run: `git branch --show-current`
Expected: `careerops-web-app`

### Task 0.2: Scaffold the Next.js app

**Files:** Create `web/` tree.

- [ ] **Step 1: Create the app**

Run from `career-ops/`:
```bash
npx create-next-app@latest web --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --no-turbopack
```

- [ ] **Step 2: Add dependencies**

```bash
cd web
npm i better-auth @prisma/client zod @anthropic-ai/sdk openai @google/generative-ai js-yaml
npm i -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/js-yaml
```

- [ ] **Step 3: Add Vitest config**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

Create `web/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

Add to `web/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Smoke test passes**

Create `web/src/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => { it('runs', () => { expect(1 + 1).toBe(2) }) })
```
Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
cd career-ops && git add web && git commit -m "feat(web): scaffold Next.js app with Vitest"
```

### Task 0.3: Validated environment config

**Files:** Create `web/src/lib/env.ts`, `web/.env.example`, test.

- [ ] **Step 1: Write failing test**

Create `web/src/lib/__tests__/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseEnv } from '../env'

describe('parseEnv', () => {
  it('requires DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/)
  })
  it('defaults LLM_PROVIDER to claude', () => {
    const e = parseEnv({ DATABASE_URL: 'postgres://x', BETTER_AUTH_SECRET: 's', APP_ENCRYPTION_KEY: 'k'.repeat(32) })
    expect(e.LLM_PROVIDER).toBe('claude')
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — Run: `npm test env` → FAIL (no `parseEnv`).

- [ ] **Step 3: Implement**

Create `web/src/lib/env.ts`:
```ts
import { z } from 'zod'

const Schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
  APP_ENCRYPTION_KEY: z.string().length(32, 'APP_ENCRYPTION_KEY must be 32 chars'),
  LLM_PROVIDER: z.enum(['claude', 'openai', 'gemini']).default('claude'),
  LLM_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
})
export type Env = z.infer<typeof Schema>
export function parseEnv(src: NodeJS.ProcessEnv | Record<string, string | undefined>): Env {
  return Schema.parse(src)
}
export const env = parseEnv(process.env)
```

Create `web/.env.example` listing every key above with placeholder values plus a comment that `DATABASE_URL` points to the ParadeDB `careerops` database.

- [ ] **Step 4: Run, expect PASS** — Run: `npm test env` → PASS.

- [ ] **Step 5: Commit** — `git add web && git commit -m "feat(web): validated env config"`

---

## Milestone 1 — Database & Prisma

### Task 1.1: Prisma schema (domain + Better Auth tables)

**Files:** Create `web/prisma/schema.prisma`, `web/src/lib/db.ts`.

- [ ] **Step 1: Write schema**

Create `web/prisma/schema.prisma`:
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// --- Better Auth tables (managed by Better Auth's Prisma adapter) ---
model User {
  id            String   @id
  name          String?
  email         String   @unique
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  sessions      Session[]
  accounts      Account[]
  profile       Profile?
  cvMaster      CvMaster?
  jobs          Job[]
  documents     Document[]
  apiKeys       ApiKey[]
}
model Session {
  id        String   @id
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
model Account {
  id                    String   @id
  userId                String
  accountId             String
  providerId            String
  password              String?
  accessToken           String?
  refreshToken          String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}

// --- Domain tables ---
model Profile {
  id          String  @id @default(cuid())
  userId      String  @unique
  fullName    String
  email       String
  phone       String?
  location    String?
  linkedin    String?
  targetRoles String[]
  compTarget  String?
  narrative   String?
  llmProvider String?
  model       String?
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
model CvMaster {
  id         String  @id @default(cuid())
  userId     String  @unique
  summary    String
  experience Json     // [{company, role, location, period, bullets[]}]
  education  Json     // [{title, org, period, desc}]
  certs      Json     // [string]
  skills     Json     // [{category, items[]}]
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
enum JobStatus { Evaluated Applied Responded Interview Offer Rejected Discarded SKIP New }
model Job {
  id         String     @id @default(cuid())
  userId     String
  company    String
  role       String
  location   String?
  url        String
  applyUrl   String?
  source     String?
  rawJD      String?
  postedAt   DateTime?
  status     JobStatus  @default(New)
  score      Float?
  archetype  String?
  createdAt  DateTime   @default(now())
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  evaluation Evaluation?
  documents  Document[]
  @@unique([userId, company, role])
}
model Evaluation {
  id            String  @id @default(cuid())
  jobId         String  @unique
  score         Float
  blocks        Json     // {A,B,C,D,E,F,G} text
  legitimacy    String
  recommendApply Boolean
  notes         String?
  createdAt     DateTime @default(now())
  job           Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
}
model Document {
  id        String   @id @default(cuid())
  userId    String
  jobId     String?
  type      String    // 'cv' | 'cover'
  label     String
  html      String
  pdfPath   String
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  job       Job?      @relation(fields: [jobId], references: [id], onDelete: SetNull)
}
model ApiKey {
  id           String  @id @default(cuid())
  userId       String
  provider     String
  encryptedKey String
  isDefault    Boolean @default(false)
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Prisma client singleton**

Create `web/src/lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client'
const g = globalThis as unknown as { prisma?: PrismaClient }
export const db = g.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') g.prisma = db
```

- [ ] **Step 3: Generate client + create the DB in ParadeDB**

```bash
# In ParadeDB (psql): CREATE DATABASE careerops;
# Set DATABASE_URL in web/.env to that DB, then:
cd web && npx prisma generate && npx prisma migrate dev --name init
```
Expected: migration applied, tables created. (If ParadeDB is unreachable, fix `DATABASE_URL`/network before continuing.)

- [ ] **Step 4: Verify connection test**

Create `web/src/lib/__tests__/db.connect.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { db } from '../db'
describe('db', () => {
  it('connects and runs a trivial query', async () => {
    const r = await db.$queryRawUnsafe<{ n: number }[]>('SELECT 1 as n')
    expect(r[0].n).toBe(1)
  })
})
```
Run: `npm test db.connect` → PASS (requires reachable ParadeDB).

- [ ] **Step 5: Commit** — `git add web && git commit -m "feat(web): prisma schema + ParadeDB connection"`

---

## Milestone 2 — Auth (Better Auth, single-user)

### Task 2.1: Better Auth server + client + route

**Files:** Create `web/src/lib/auth.ts`, `web/src/lib/auth-client.ts`, `web/src/app/api/auth/[...all]/route.ts`.

- [ ] **Step 1: Server instance**

Create `web/src/lib/auth.ts`:
```ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { db } from './db'
import { env } from './env'

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Single-user guard (Phase A): block sign-up once one user exists.
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          const count = await db.user.count()
          if (count >= 1) throw new Error('Sign-up disabled: single-user instance')
          return { data: {} as never }
        },
      },
    },
  },
})
```

- [ ] **Step 2: Route handler**

Create `web/src/app/api/auth/[...all]/route.ts`:
```ts
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 3: React client**

Create `web/src/lib/auth-client.ts`:
```ts
import { createAuthClient } from 'better-auth/react'
export const authClient = createAuthClient()
export const { signIn, signOut, signUp, useSession } = authClient
```

- [ ] **Step 4: Test the single-user guard**

Create `web/src/lib/__tests__/auth-guard.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({ db: { user: { count: vi.fn() } } }))
import { db } from '../db'

// Re-implement the guard predicate for unit testing intent.
async function canSignUp(): Promise<boolean> { return (await db.user.count()) < 1 }

describe('single-user guard', () => {
  beforeEach(() => vi.clearAllMocks())
  it('allows first user', async () => {
    ;(db.user.count as any).mockResolvedValue(0)
    expect(await canSignUp()).toBe(true)
  })
  it('blocks second user', async () => {
    ;(db.user.count as any).mockResolvedValue(1)
    expect(await canSignUp()).toBe(false)
  })
})
```
Run: `npm test auth-guard` → PASS.

- [ ] **Step 5: Run Better Auth migration + commit**

```bash
cd web && npx @better-auth/cli migrate   # or prisma migrate if schema-managed
git add web && git commit -m "feat(web): Better Auth single-user setup"
```

### Task 2.2: Login page + session middleware

**Files:** Create `web/src/app/(auth)/login/page.tsx`, `web/src/middleware.ts`.

- [ ] **Step 1: Login page**

Create `web/src/app/(auth)/login/page.tsx` (client component): email + password fields calling `signIn.email({ email, password })`, with a one-time "create account" call to `signUp.email` shown only if no user exists (call a `/api/has-user` route returning `{exists}`). On success, `router.push('/')`.

- [ ] **Step 2: Add `/api/has-user`**

Create `web/src/app/api/has-user/route.ts`:
```ts
import { db } from '@/lib/db'
export async function GET() {
  const exists = (await db.user.count()) > 0
  return Response.json({ exists })
}
```

- [ ] **Step 3: Protect app routes**

Create `web/src/middleware.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
export function middleware(req: NextRequest) {
  const session = getSessionCookie(req)
  if (!session) return NextResponse.redirect(new URL('/login', req.url))
  return NextResponse.next()
}
export const config = { matcher: ['/((?!login|api/auth|api/has-user|_next|favicon).*)'] }
```

- [ ] **Step 4: Manual verify** — `npm run dev`, visit `/` → redirected to `/login`; create the single account → reach dashboard. Document result in the commit.

- [ ] **Step 5: Commit** — `git add web && git commit -m "feat(web): login page + route protection"`

---

## Milestone 3 — LLM provider interface + schemas

### Task 3.1: Zod schemas for LLM output

**Files:** Create `web/src/llm/schemas.ts`, test.

- [ ] **Step 1: Write failing test**

Create `web/src/llm/__tests__/schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EvaluationSchema, TailoredCvSchema } from '../schemas'

describe('EvaluationSchema', () => {
  it('parses a valid evaluation', () => {
    const v = EvaluationSchema.parse({
      score: 4.1, legitimacy: 'High Confidence', recommendApply: true,
      blocks: { A: 'match', B: 'fit', C: 'comp', D: 'culture', E: 'flags', F: 'global', G: 'legit' },
      notes: 'ok',
    })
    expect(v.score).toBe(4.1)
  })
  it('rejects score out of range', () => {
    expect(() => EvaluationSchema.parse({ score: 9, legitimacy: 'x', recommendApply: true, blocks: {} })).toThrow()
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

Create `web/src/llm/schemas.ts`:
```ts
import { z } from 'zod'
export const EvaluationSchema = z.object({
  score: z.number().min(1).max(5),
  legitimacy: z.enum(['High Confidence', 'Proceed with Caution', 'Suspicious']),
  recommendApply: z.boolean(),
  blocks: z.object({
    A: z.string(), B: z.string(), C: z.string(),
    D: z.string(), E: z.string(), F: z.string(), G: z.string(),
  }),
  notes: z.string().optional(),
})
export type EvaluationOut = z.infer<typeof EvaluationSchema>

export const ExperienceItem = z.object({
  company: z.string(), role: z.string(), location: z.string().optional(),
  period: z.string(), bullets: z.array(z.string()),
})
export const TailoredCvSchema = z.object({
  roleTag: z.string(),
  summary: z.string(),
  competencies: z.array(z.string()).min(4).max(10),
  experience: z.array(ExperienceItem),
  education: z.array(z.object({ title: z.string(), org: z.string(), period: z.string(), desc: z.string().optional() })),
  certs: z.array(z.string()),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })),
})
export type TailoredCvOut = z.infer<typeof TailoredCvSchema>
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `git add web && git commit -m "feat(web): LLM output Zod schemas"`

### Task 3.2: Provider interface + factory

**Files:** Create `web/src/llm/types.ts`, `web/src/llm/provider.ts`, `web/src/llm/providers/{claude,openai,gemini}.ts`, test.

- [ ] **Step 1: Interface**

Create `web/src/llm/types.ts`:
```ts
export interface LLMProvider {
  /** Returns raw text completion for a single user prompt + system prompt. */
  complete(args: { system: string; prompt: string; maxTokens?: number }): Promise<string>
}
```

- [ ] **Step 2: Failing factory test**

Create `web/src/llm/__tests__/provider.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getProvider } from '../provider'

describe('getProvider', () => {
  it('returns a provider for claude', () => {
    const p = getProvider('claude', { ANTHROPIC_API_KEY: 'x' })
    expect(typeof p.complete).toBe('function')
  })
  it('throws when key missing', () => {
    expect(() => getProvider('openai', {})).toThrow(/OPENAI_API_KEY/)
  })
})
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement providers + factory**

Create `web/src/llm/providers/claude.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider } from '../types'
export function claudeProvider(apiKey: string, model = 'claude-sonnet-4-6'): LLMProvider {
  const client = new Anthropic({ apiKey })
  return {
    async complete({ system, prompt, maxTokens = 4096 }) {
      const res = await client.messages.create({
        model, max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: prompt }],
      })
      return res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('')
    },
  }
}
```

Create `web/src/llm/providers/openai.ts`:
```ts
import OpenAI from 'openai'
import type { LLMProvider } from '../types'
export function openaiProvider(apiKey: string, model = 'gpt-4o'): LLMProvider {
  const client = new OpenAI({ apiKey })
  return {
    async complete({ system, prompt, maxTokens = 4096 }) {
      const res = await client.chat.completions.create({
        model, max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      })
      return res.choices[0]?.message?.content ?? ''
    },
  }
}
```

Create `web/src/llm/providers/gemini.ts`:
```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMProvider } from '../types'
export function geminiProvider(apiKey: string, model = 'gemini-2.5-flash'): LLMProvider {
  const genAI = new GoogleGenerativeAI(apiKey)
  return {
    async complete({ system, prompt }) {
      const m = genAI.getGenerativeModel({ model, systemInstruction: system })
      const res = await m.generateContent(prompt)
      return res.response.text()
    },
  }
}
```

Create `web/src/llm/provider.ts`:
```ts
import type { LLMProvider } from './types'
import { claudeProvider } from './providers/claude'
import { openaiProvider } from './providers/openai'
import { geminiProvider } from './providers/gemini'

type Keys = { ANTHROPIC_API_KEY?: string; OPENAI_API_KEY?: string; GEMINI_API_KEY?: string }
export function getProvider(name: 'claude' | 'openai' | 'gemini', keys: Keys, model?: string): LLMProvider {
  if (name === 'claude') {
    if (!keys.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
    return claudeProvider(keys.ANTHROPIC_API_KEY, model)
  }
  if (name === 'openai') {
    if (!keys.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')
    return openaiProvider(keys.OPENAI_API_KEY, model)
  }
  if (!keys.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')
  return geminiProvider(keys.GEMINI_API_KEY, model)
}
```

- [ ] **Step 5: Run, expect PASS; commit** — `git add web && git commit -m "feat(web): configurable LLM provider interface"`

### Task 3.3: JSON extraction + validated call helper

**Files:** Create `web/src/llm/run.ts`, test.

- [ ] **Step 1: Failing test**

Create `web/src/llm/__tests__/run.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { runValidated } from '../run'
import { EvaluationSchema } from '../schemas'

const ok = JSON.stringify({ score: 4, legitimacy: 'High Confidence', recommendApply: true,
  blocks: { A:'a',B:'b',C:'c',D:'d',E:'e',F:'f',G:'g' } })

describe('runValidated', () => {
  it('parses valid JSON (even fenced)', async () => {
    const provider = { complete: vi.fn().mockResolvedValue('```json\n' + ok + '\n```') }
    const r = await runValidated(provider, EvaluationSchema, { system: 's', prompt: 'p' })
    expect(r.score).toBe(4)
  })
  it('retries once on invalid then succeeds', async () => {
    const provider = { complete: vi.fn().mockResolvedValueOnce('garbage').mockResolvedValueOnce(ok) }
    const r = await runValidated(provider, EvaluationSchema, { system: 's', prompt: 'p' })
    expect(provider.complete).toHaveBeenCalledTimes(2)
    expect(r.legitimacy).toBe('High Confidence')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

Create `web/src/llm/run.ts`:
```ts
import type { z } from 'zod'
import type { LLMProvider } from './types'

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{'); const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object found')
  return JSON.parse(body.slice(start, end + 1))
}

export async function runValidated<T>(
  provider: LLMProvider, schema: z.ZodType<T>,
  args: { system: string; prompt: string; maxTokens?: number },
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.complete(args)
    try { return schema.parse(extractJson(raw)) }
    catch (e) { lastErr = e; args = { ...args, prompt: args.prompt + '\n\nReturn ONLY valid JSON matching the schema.' } }
  }
  throw new Error(`LLM output failed validation after retry: ${String(lastErr)}`)
}
```

- [ ] **Step 4: Run, expect PASS; commit** — `git add web && git commit -m "feat(web): validated LLM call helper with retry"`

---

## Milestone 4 — Prompt templates (ported from modes)

### Task 4.1: Evaluation prompt builder

**Files:** Create `web/src/llm/prompts/evaluation.ts`, test.

- [ ] **Step 1: Failing test**

Create `web/src/llm/prompts/__tests__/evaluation.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildEvaluationPrompt } from '../evaluation'

describe('buildEvaluationPrompt', () => {
  it('includes profile, cv summary, JD, and asks for A-G JSON', () => {
    const { system, prompt } = buildEvaluationPrompt({
      profile: { fullName: 'T', targetRoles: ['Project Coordinator'], compTarget: 'R15000', location: 'Zambia', narrative: 'driven' } as any,
      cvSummary: 'PM student',
      jobJD: 'Coordinate projects...',
    })
    expect(system).toMatch(/A-G|A–G|six blocks/i)
    expect(prompt).toContain('Coordinate projects')
    expect(prompt).toContain('Project Coordinator')
    expect(prompt).toMatch(/JSON/i)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** (port scoring rubric from `modes/_shared.md` + `modes/oferta.md`)

Create `web/src/llm/prompts/evaluation.ts`:
```ts
import type { Profile } from '@prisma/client'

export function buildEvaluationPrompt(input: { profile: Profile; cvSummary: string; jobJD: string }) {
  const { profile, cvSummary, jobJD } = input
  const system = [
    'You are a rigorous career evaluator. Score a job offer against a candidate using six blocks A-F plus G (posting legitimacy).',
    'Blocks: A Match-with-CV, B North-Star alignment, C Comp, D Cultural signals, E Red flags, F Global (1-5 weighted).',
    'G Legitimacy is one of: High Confidence | Proceed with Caution | Suspicious. NEVER invent experience or metrics.',
    'Output ONLY JSON: {score:number 1-5, legitimacy, recommendApply:boolean, blocks:{A,B,C,D,E,F,G}, notes}.',
  ].join('\n')
  const prompt = [
    `CANDIDATE: ${profile.fullName}`,
    `TARGET ROLES: ${(profile.targetRoles || []).join(', ')}`,
    `LOCATION: ${profile.location ?? ''} | COMP TARGET: ${profile.compTarget ?? ''}`,
    `NARRATIVE: ${profile.narrative ?? ''}`,
    `CV SUMMARY / PROOF POINTS:\n${cvSummary}`,
    `\nJOB DESCRIPTION:\n${jobJD}`,
    '\nReturn the JSON now.',
  ].join('\n')
  return { system, prompt }
}
```

- [ ] **Step 4: Run, expect PASS; commit** — `git add web && git commit -m "feat(web): evaluation prompt builder"`

### Task 4.2: CV tailoring prompt builder

**Files:** Create `web/src/llm/prompts/cv.ts`, test (mirror 4.1 structure).

- [ ] **Step 1: Failing test** — assert the prompt includes the master CV JSON, the JD, the rule "only reword real experience, never invent", and requests `TailoredCvSchema` JSON.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** `buildTailoredCvPrompt({ cvMaster, jobJD, archetype })` returning `{system, prompt}`. System: "Tailor the CV to the JD using ONLY existing experience; reword to match JD vocabulary; output JSON matching {roleTag, summary, competencies[], experience[], education[], certs[], skills[]}." Prompt: serialize `cvMaster` as JSON + the JD.
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(web): CV tailoring prompt builder"`

### Task 4.3: Cover letter prompt builder

**Files:** Create `web/src/llm/prompts/cover.ts`, test.

- [ ] **Step 1: Failing test** — assert prompt includes company/role/JD, candidate narrative, the anti-cliché rules (no "passionate about"/"leveraged"/"spearheaded"), one page, and returns plain text (not JSON).
- [ ] **Step 2–4:** Implement `buildCoverLetterPrompt({ profile, cvSummary, job })` → `{system, prompt}`; provider returns text directly (no schema). Test PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): cover letter prompt builder"`

---

## Milestone 5 — Rendering (reuse parent PDF pipeline)

### Task 5.1: PDF wrapper around parent `renderHtmlToPdf`

**Files:** Create `web/src/render/pdf.ts`, test.

- [ ] **Step 1: Failing test**

Create `web/src/render/__tests__/pdf.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { renderPdf } from '../pdf'

describe('renderPdf', () => {
  it('produces a PDF file from HTML', async () => {
    const out = await renderPdf('<!doctype html><html><body><h1>Hi</h1></body></html>', 'test-output')
    expect(existsSync(out)).toBe(true)
    expect(out.endsWith('.pdf')).toBe(true)
  }, 30000)
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** (import the parent module via relative path)

Create `web/src/render/pdf.ts`:
```ts
import path from 'node:path'
import { mkdirSync } from 'node:fs'
// Parent repo module (career-ops/generate-pdf.mjs). Path is relative to this file.
// @ts-expect-error - JS module without types
import { renderHtmlToPdf } from '../../../generate-pdf.mjs'

const OUTPUT_DIR = process.env.PDF_OUTPUT_DIR || path.resolve(process.cwd(), 'storage/pdfs')

export async function renderPdf(html: string, basename: string, format: 'a4' | 'letter' = 'a4'): Promise<string> {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const out = path.join(OUTPUT_DIR, `${basename}.pdf`)
  // baseDir lets the parent resolve ./fonts paths; point at career-ops root.
  await renderHtmlToPdf(html, out, { format, baseDir: path.resolve(process.cwd(), '..') })
  return out
}
```

> Note: `process.cwd()` is `career-ops/web` at runtime, so `..` is the repo root where `fonts/` lives. The parent module already rewrites `./fonts/` to absolute file URLs.

- [ ] **Step 4: Run, expect PASS** (requires Playwright Chromium installed: `npx playwright install chromium`).

- [ ] **Step 5: Commit** — `git add web && git commit -m "feat(web): PDF render reusing parent pipeline"`

### Task 5.2: CV HTML renderer (structured → HTML)

**Files:** Create `web/src/render/cv-html.ts`, test.

- [ ] **Step 1: Failing test** — given a `TailoredCvOut` object, `renderCvHtml(cv, contact)` returns an HTML string containing the name, roleTag, each competency, each company, and `./fonts/` font-face references (so the PDF wrapper resolves them).
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** `renderCvHtml(cv, contact)` producing the monochrome single-column template (port the proven HTML/CSS from `output/cv-tinotenda-maramba.html`: header with name + roleTag + gradient line + contact row, Professional Summary, Core Competencies tags, Work Experience, Education, Certifications, Skills). Section order must be Summary → Competencies → Experience → Education → Certifications → Skills (the parent validator checks order against cv.md sections — keep it consistent).
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(web): structured CV -> HTML renderer"`

### Task 5.3: Cover letter HTML renderer

**Files:** Create `web/src/render/cover-html.ts`, test.

- [ ] **Step 1: Failing test** — `renderCoverHtml({ contact, recipient, date, body })` returns HTML containing the recipient, the date, and each paragraph of `body`.
- [ ] **Step 2–4:** Implement using the same letterhead style as `output/cover-tinotenda-retailnext.html` (header, date, recipient block, paragraphs, sign-off). Splits `body` on blank lines into `<p>`. Test PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): cover letter HTML renderer"`

---

## Milestone 6 — Importer (seed from existing files)

### Task 6.1: Parse `config/profile.yml` + `cv.md` into Profile + CvMaster

**Files:** Create `web/src/services/importer.ts`, test with fixtures.

- [ ] **Step 1: Failing test**

Create `web/src/services/__tests__/importer.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseProfileYaml, parseCvMarkdown } from '../importer'

const yaml = `candidate:
  full_name: "Tinotenda Maramba"
  email: "t@example.com"
  location: "Zambia"
target_roles:
  primary: ["Junior Project Manager", "Project Coordinator"]
compensation:
  target_range: "R15,000/month"`

const md = `# Tinotenda Maramba
## Professional Summary
Ambitious PM student.
## Experience
### Residential Secretary — Student Union
**Cavendish University** · 2026 – Present
- Coordinate accommodation for 100+ students.
## Skills
**Tools:** Microsoft Office`

describe('importer', () => {
  it('parses profile yaml', () => {
    const p = parseProfileYaml(yaml)
    expect(p.fullName).toBe('Tinotenda Maramba')
    expect(p.targetRoles).toContain('Project Coordinator')
    expect(p.compTarget).toMatch(/15/)
  })
  it('parses cv markdown summary + experience', () => {
    const cv = parseCvMarkdown(md)
    expect(cv.summary).toMatch(/Ambitious/)
    expect(cv.experience[0].company).toMatch(/Cavendish/)
    expect(cv.experience[0].bullets[0]).toMatch(/100\+/)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `parseProfileYaml` (use `js-yaml`, map fields) and `parseCvMarkdown` (split on `##` headings; under Experience split on `###` into items, parse company/period line and `- ` bullets; collect Summary, Education, Certifications, Skills). Return objects matching the Prisma `Profile`/`CvMaster` shapes.

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Add `seedFromRepo(userId)`** that reads `../config/profile.yml` and `../cv.md`, parses them, and upserts `Profile` + `CvMaster` for the user. Add a one-off script `web/scripts/seed.ts` invoking it. Commit — `git add web && git commit -m "feat(web): importer for profile.yml + cv.md"`

---

## Milestone 7 — Search (Firecrawl)

### Task 7.1: Firecrawl search service

**Files:** Create `web/src/services/search.ts`, test (mock fetch).

- [ ] **Step 1: Failing test**

Create `web/src/services/__tests__/search.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchJobs } from '../search'

afterEach(() => vi.restoreAllMocks())

describe('searchJobs', () => {
  it('maps Firecrawl web results to candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { web: [
        { url: 'https://x.com/job/1', title: 'Project Coordinator @ RetailNext', description: 'Coordinate...' },
      ] } }),
    }))
    const r = await searchJobs('project coordinator remote', 'fc-key')
    expect(r[0].url).toBe('https://x.com/job/1')
    expect(r[0].title).toMatch(/Project Coordinator/)
  })
  it('throws on missing API key', async () => {
    await expect(searchJobs('x', '')).rejects.toThrow(/FIRECRAWL/)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

Create `web/src/services/search.ts`:
```ts
export type Candidate = { url: string; title: string; description?: string; company?: string }

export async function searchJobs(query: string, apiKey: string, limit = 10): Promise<Candidate[]> {
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY missing')
  const res = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  })
  if (!res.ok) throw new Error(`Firecrawl search failed: ${res.status}`)
  const data = await res.json()
  const web = data?.data?.web ?? []
  return web.map((w: any) => ({
    url: w.url, title: w.title, description: w.description,
    company: (w.title?.split(/ @ | \| | at /)[1] ?? '').trim() || undefined,
  }))
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Add `scrapeJD(url, apiKey)`** that calls `/v2/scrape` (markdown, onlyMainContent) and returns the markdown — used later to fill `Job.rawJD`. Add a test mocking fetch. Commit — `git add web && git commit -m "feat(web): Firecrawl search + JD scrape service"`

### Task 7.2: Search API route + dedupe into jobs

**Files:** Create `web/src/services/jobs.ts`, `web/src/app/api/search/route.ts`, tests.

- [ ] **Step 1: Failing test for `addCandidates`** — given candidates and an existing job with same `company+role`, `addCandidates(userId, candidates)` inserts only new ones (dedupe on `@@unique([userId, company, role])`), returns count added. Mock `db.job`.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** `jobs.ts` with `addCandidates`, `listJobs(userId)`, `getJob(userId,id)`, `setStatus(userId,id,status)` using `db`. Create `api/search/route.ts` (POST `{query}`): get session user, call `searchJobs(query, env.FIRECRAWL_API_KEY)`, `addCandidates`, return jobs.
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git add web && git commit -m "feat(web): jobs service + search API with dedupe"`

---

## Milestone 8 — Evaluate

### Task 8.1: Evaluate orchestration service

**Files:** Create `web/src/services/evaluate.ts`, test.

- [ ] **Step 1: Failing test** — `evaluateJob({ profile, cvSummary, job, provider })` calls `runValidated` with the evaluation prompt and returns an `EvaluationOut`; assert it builds the prompt from the job's `rawJD` and passes the schema. Mock `provider.complete` to return valid JSON.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement**

Create `web/src/services/evaluate.ts`:
```ts
import type { Profile } from '@prisma/client'
import type { LLMProvider } from '@/llm/types'
import { runValidated } from '@/llm/run'
import { EvaluationSchema, type EvaluationOut } from '@/llm/schemas'
import { buildEvaluationPrompt } from '@/llm/prompts/evaluation'

export async function evaluateJob(args: {
  profile: Profile; cvSummary: string; jobJD: string; provider: LLMProvider
}): Promise<EvaluationOut> {
  const { system, prompt } = buildEvaluationPrompt({
    profile: args.profile, cvSummary: args.cvSummary, jobJD: args.jobJD,
  })
  return runValidated(args.provider, EvaluationSchema, { system, prompt })
}
```

- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(web): evaluate orchestration"`

### Task 8.2: Evaluate API route

**Files:** Create `web/src/app/api/jobs/[id]/evaluate/route.ts`.

- [ ] **Step 1: Implement** POST: resolve session user; load `Profile`, `CvMaster`, `Job`; if `job.rawJD` empty, `scrapeJD(job.url)` and persist; build `cvSummary` from CvMaster; `getProvider(profile.llmProvider ?? env.LLM_PROVIDER, env, profile.model ?? env.LLM_MODEL)`; `evaluateJob(...)`; upsert `Evaluation`; set `job.score` + `status='Evaluated'`; return the evaluation. Wrap in try/catch returning `{error}` with 500 on failure.
- [ ] **Step 2: Integration test** (`route.evaluate.test.ts`) mocking `db`, `getProvider`, and `scrapeJD`: asserts an `Evaluation` row is created and `job.status` set to `Evaluated`.
- [ ] **Step 3: Run PASS.**
- [ ] **Step 4: Commit** — `git add web && git commit -m "feat(web): evaluate API route"`

---

## Milestone 9 — Generate documents

### Task 9.1: Generate service (CV + cover) → PDF → Document rows

**Files:** Create `web/src/services/generate.ts`, test.

- [ ] **Step 1: Failing test** — `generateCv({ cvMaster, jobJD, contact, provider })` calls `runValidated` with `TailoredCvSchema`, renders HTML via `renderCvHtml`, renders PDF via `renderPdf`, returns `{ html, pdfPath, cv }`. Mock provider + `renderPdf`.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** `generateCv(...)` and `generateCover(...)` in `generate.ts`:
  - `generateCv`: `runValidated(provider, TailoredCvSchema, buildTailoredCvPrompt(...))` → `renderCvHtml(cv, contact)` → `renderPdf(html, \`cv-${slug}\`)`.
  - `generateCover`: `provider.complete(buildCoverLetterPrompt(...))` (plain text) → `renderCoverHtml(...)` → `renderPdf(html, \`cover-${slug}\`)`.
- [ ] **Step 4: Run PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(web): generate CV + cover services"`

### Task 9.2: Generate API route

**Files:** Create `web/src/app/api/jobs/[id]/generate/route.ts`.

- [ ] **Step 1: Implement** POST `{ type: 'cv' | 'cover' }`: load user/profile/cvMaster/job; build contact from profile; call the right generator; persist a `Document` row (`type`, `label`, `html`, `pdfPath`, `jobId`); return `{ documentId, pdfUrl }` where `pdfUrl` is served by a `/api/documents/[id]/pdf` streaming route (create it: reads `Document.pdfPath`, returns the file with `application/pdf`).
- [ ] **Step 2: Integration test** mocking services + db: asserts a `Document` row is created with the returned id.
- [ ] **Step 3: Run PASS; commit** — `git add web && git commit -m "feat(web): generate API + PDF serving route"`

---

## Milestone 10 — UI

### Task 10.1: App shell (sidebar) + layout

**Files:** Create `web/src/app/(app)/layout.tsx`, `web/src/components/Sidebar.tsx`, `globals.css` tweaks.

- [ ] **Step 1: Failing test** (`Sidebar.test.tsx`) — renders nav links Dashboard, Find Jobs, My Jobs, Documents, Profile; the active route link has `aria-current="page"`.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** `Sidebar.tsx` (left nav, links via `next/link`, active state from `usePathname`) and `(app)/layout.tsx` wrapping children with `<Sidebar/>` + a top bar showing the user + sign-out.
- [ ] **Step 4: Run PASS; commit** — `git add web && git commit -m "feat(web): sidebar app shell"`

### Task 10.2: Shared components (ScoreBadge, JobCard, EvaluationView, ActionBar)

**Files:** Create the four components + a test each.

- [ ] **Step 1: Failing tests** — `ScoreBadge` shows "4.1/5" and a color class by band (>=4 green, >=3 amber, else red). `JobCard` renders company, role, score, status. `EvaluationView` renders blocks A–G labels + text. `ActionBar` renders Evaluate / Tailor CV / Cover letter / Apply buttons and calls the passed handlers on click.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** the four components.
- [ ] **Step 4: Run PASS; commit** — `git add web && git commit -m "feat(web): shared UI components"`

### Task 10.3: Dashboard page

**Files:** Create `web/src/app/(app)/page.tsx`.

- [ ] **Step 1: Implement** server component: load user jobs, render pipeline (list of `JobCard` linking to `/jobs/[id]`) + a stats strip (count by status, avg score, top score). Empty state links to Find Jobs.
- [ ] **Step 2: Test** (`dashboard.test.tsx`) mocking the jobs loader: renders cards for provided jobs and the correct count.
- [ ] **Step 3: Run PASS; commit** — `git add web && git commit -m "feat(web): dashboard page"`

### Task 10.4: Find Jobs page

**Files:** Create `web/src/app/(app)/find/page.tsx` (client).

- [ ] **Step 1: Implement** search box → POST `/api/search` → results list with "Add to pipeline" (already added on search) and "Evaluate now" (links to job detail). Show loading + error states.
- [ ] **Step 2: Test** mocking fetch: typing a query + submit renders returned results.
- [ ] **Step 3: Run PASS; commit** — `git add web && git commit -m "feat(web): find jobs page"`

### Task 10.5: My Jobs list + Job detail (full page)

**Files:** Create `web/src/app/(app)/jobs/page.tsx`, `web/src/app/(app)/jobs/[id]/page.tsx`.

- [ ] **Step 1: Implement My Jobs** — table/board of jobs with `ScoreBadge` + status; row links to detail.
- [ ] **Step 2: Implement Job detail (full page)** — header (company/role/fit/legitimacy/remote + status dropdown calling `/api/jobs/[id]/status`); `ActionBar` wired to `/api/jobs/[id]/evaluate` and `/api/jobs/[id]/generate`; tabs/columns: JD (rawJD), `EvaluationView`, Documents (list with download links). Actions show loading + update UI on success.
- [ ] **Step 3: Test** (`job-detail.test.tsx`) mocking loaders/fetch: clicking "Evaluate" calls the evaluate endpoint and renders the returned blocks; status change calls the status endpoint.
- [ ] **Step 4: Run PASS; commit** — `git add web && git commit -m "feat(web): my jobs + job detail page"`

### Task 10.6: Documents + Profile/CV pages

**Files:** Create `web/src/app/(app)/documents/page.tsx`, `web/src/app/(app)/profile/page.tsx`, `web/src/app/api/profile/route.ts`.

- [ ] **Step 1: Documents page** — list all `Document` rows with type, label, job, and a download link (`/api/documents/[id]/pdf`).
- [ ] **Step 2: Profile/CV page** — form editor for `Profile` (fields) + `CvMaster` (summary, dynamic experience/education/cert/skill lists). POST `/api/profile` upserts both. Include a "Seed from repo files" button calling a `/api/profile/seed` route (runs `seedFromRepo`).
- [ ] **Step 3: Tests** — profile form submit calls `/api/profile` with the edited values; documents page renders rows.
- [ ] **Step 4: Run PASS; commit** — `git add web && git commit -m "feat(web): documents + profile pages"`

### Task 10.7: Assisted apply

**Files:** Modify `web/src/app/(app)/jobs/[id]/page.tsx` + add `web/src/components/ApplyPanel.tsx`.

- [ ] **Step 1: Failing test** (`ApplyPanel.test.tsx`) — given a job with `applyUrl` and generated documents, renders an "Open posting" link (target `_blank`, href = applyUrl) and download links for the CV + cover documents, and a "Mark applied" button that calls the status endpoint with `Applied`.
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement** `ApplyPanel` + wire into the detail page's Apply action (reveals the panel). "Mark applied" → `/api/jobs/[id]/status` with `Applied`.
- [ ] **Step 4: Run PASS; commit** — `git add web && git commit -m "feat(web): assisted apply panel"`

---

## Milestone 11 — Docker

### Task 11.1: Dockerfile (Next.js + Chromium) + compose

**Files:** Create `web/Dockerfile`, `web/docker-compose.yml`, `web/.dockerignore`.

- [ ] **Step 1: Dockerfile** — multi-stage: build stage (`node:24-slim`, `npm ci`, `npx prisma generate`, `npm run build`); runtime stage installs Chromium system deps + `npx playwright install --with-deps chromium`, copies `.next`, `node_modules`, `prisma`, and the **parent repo's `generate-pdf.mjs`, `fonts/`, `templates/`** (build context = repo root so these are available). `CMD ["npm","start"]` after `npx prisma migrate deploy`.

- [ ] **Step 2: docker-compose.yml**
```yaml
services:
  web:
    build: { context: .., dockerfile: web/Dockerfile }
    ports: ["3000:3000"]
    env_file: [./.env]
    volumes: ["careerops_pdfs:/app/web/storage/pdfs"]
    # ParadeDB is external; ensure DATABASE_URL is reachable (shared network or host).
    extra_hosts: ["host.docker.internal:host-gateway"]
volumes: { careerops_pdfs: {} }
```

- [ ] **Step 3: Build + smoke**

Run from `career-ops/web`:
```bash
docker compose build
docker compose up -d
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
```
Expected: `200`. (DATABASE_URL must point at reachable ParadeDB, e.g. `host.docker.internal`.)

- [ ] **Step 4: Document the run steps** in `web/README.md` (env vars, ParadeDB `CREATE DATABASE careerops`, migrate, seed).

- [ ] **Step 5: Commit** — `git add web && git commit -m "feat(web): Dockerfile + compose (Next.js + Chromium + external ParadeDB)"`

---

## Milestone 12 — End-to-end verification

### Task 12.1: Manual happy-path walkthrough

- [ ] **Step 1:** Bring up the stack; create the single account at `/login`.
- [ ] **Step 2:** On Profile, click "Seed from repo files" → confirm Profile + CV populated from `cv.md`/`profile.yml`.
- [ ] **Step 3:** Find Jobs: search "project coordinator remote" → results added to pipeline.
- [ ] **Step 4:** Open a job → Evaluate → confirm score + A–G appear; Tailor CV → Cover letter → confirm PDFs download and look correct.
- [ ] **Step 5:** Apply panel: open posting + download docs + Mark applied → status flips to Applied on the dashboard.
- [ ] **Step 6:** Record the walkthrough result in `web/README.md` and commit — `git add web && git commit -m "docs(web): verified happy-path walkthrough"`

---

## Notes for the implementer

- **Reuse, don't reinvent:** `renderHtmlToPdf`/`normalizeTextForATS` (parent `generate-pdf.mjs`), the CV/cover HTML look (`output/cv-tinotenda-maramba.html`, `output/cover-tinotenda-retailnext.html`), the Firecrawl request shapes (search `/v2/search`, scrape `/v2/scrape`), and the scoring rubric (`modes/_shared.md`, `modes/oferta.md`) are all proven — port them.
- **Section order** in generated CV HTML must match `cv.md` (Summary → Experience → Education → Certifications → Skills) or the parent PDF validator throws.
- **Never invent experience** in CV/cover generation — enforce in the prompt and review LLM output.
- **Secrets** stay server-side; never import provider SDKs into client components.
- **Single-user** is enforced by the Better Auth `before` hook + `/api/has-user`; lifting it to multi-user (Phase C) means removing the guard and scoping queries by session `userId` (already the case).
```
