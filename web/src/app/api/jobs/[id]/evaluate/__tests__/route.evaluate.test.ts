import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (must be declared before imports) ---

vi.mock('@/lib/db', () => ({
  db: {
    profile: { findUnique: vi.fn() },
    cvMaster: { findUnique: vi.fn() },
    job: { findFirst: vi.fn(), update: vi.fn() },
    evaluation: { upsert: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@/llm/provider', () => ({
  getProvider: vi.fn(),
}))

vi.mock('@/services/search', () => ({
  scrapeJD: vi.fn(),
}))

vi.mock('@/services/evaluate', () => ({
  evaluateJob: vi.fn(),
}))

// Also mock env to avoid missing required vars
vi.mock('@/lib/env', () => ({
  env: {
    FIRECRAWL_API_KEY: 'test-firecrawl-key',
    LLM_PROVIDER: 'claude',
    LLM_MODEL: 'claude-3-5-sonnet-20241022',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    OPENAI_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
  },
}))

import { POST } from '../route'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getProvider } from '@/llm/provider'
import { scrapeJD } from '@/services/search'
import { evaluateJob } from '@/services/evaluate'

type MockDb = {
  profile: { findUnique: ReturnType<typeof vi.fn> }
  cvMaster: { findUnique: ReturnType<typeof vi.fn> }
  job: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  evaluation: { upsert: ReturnType<typeof vi.fn> }
}

const mockDb = db as unknown as MockDb
const mockAuth = auth as unknown as { api: { getSession: ReturnType<typeof vi.fn> } }
const mockGetProvider = getProvider as ReturnType<typeof vi.fn>
const mockScrapeJD = scrapeJD as ReturnType<typeof vi.fn>
const mockEvaluateJob = evaluateJob as ReturnType<typeof vi.fn>

// Test fixtures
const fakeUser = { id: 'user-1', email: 'test@example.com' }
const fakeProfile = {
  id: 'profile-1',
  userId: 'user-1',
  fullName: 'Tino Maramba',
  email: 'tino@example.com',
  phone: null,
  location: 'Remote',
  linkedin: null,
  targetRoles: ['Software Engineer'],
  compTarget: '$120k',
  narrative: 'Experienced developer',
  llmProvider: null,
  model: null,
}
const fakeCvMaster = {
  id: 'cv-1',
  userId: 'user-1',
  summary: 'Full-stack developer with 5 years experience',
  experience: [
    {
      role: 'Senior Engineer',
      company: 'Acme Corp',
      period: '2022-2024',
      bullets: ['Built React apps', 'Led team of 5'],
    },
  ],
  education: [],
  certs: [],
  skills: [],
}
const fakeJob = {
  id: 'job-1',
  userId: 'user-1',
  company: 'TechCo',
  role: 'Full Stack Developer',
  url: 'https://techco.com/jobs/123',
  rawJD: 'We need a full-stack developer with React and Node.js.',
  status: 'New',
  score: null,
}
const fakeEvaluation = {
  score: 4.2,
  legitimacy: 'High Confidence' as const,
  recommendApply: true,
  blocks: {
    A: 'Role summary', B: 'Match', C: 'Level', D: 'Comp', E: 'Custom', F: 'Interview', G: 'Legit',
  },
  notes: 'Strong match',
}
const fakeEvalRow = {
  id: 'eval-1',
  jobId: 'job-1',
  ...fakeEvaluation,
  createdAt: new Date(),
}
const fakeProvider = { complete: vi.fn() }

function buildRequest(jobId: string): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request('http://localhost/api/jobs/' + jobId + '/evaluate', {
    method: 'POST',
  })
  return [req, { params: Promise.resolve({ id: jobId }) }]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.api.getSession.mockResolvedValue({ user: fakeUser })
  mockDb.profile.findUnique.mockResolvedValue(fakeProfile)
  mockDb.cvMaster.findUnique.mockResolvedValue(fakeCvMaster)
  mockDb.job.findFirst.mockResolvedValue(fakeJob)
  mockDb.job.update.mockResolvedValue({ ...fakeJob, score: 4.2, status: 'Evaluated' })
  mockDb.evaluation.upsert.mockResolvedValue(fakeEvalRow)
  mockGetProvider.mockReturnValue(fakeProvider)
  mockEvaluateJob.mockResolvedValue(fakeEvaluation)
})

describe('POST /api/jobs/[id]/evaluate', () => {
  it('returns 401 when no session', async () => {
    mockAuth.api.getSession.mockResolvedValue(null)
    const [req, ctx] = buildRequest('job-1')
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('creates an Evaluation row and sets job status to Evaluated', async () => {
    const [req, ctx] = buildRequest('job-1')
    const res = await POST(req as Parameters<typeof POST>[0], ctx)

    expect(res.status).toBe(200)

    // Evaluation upsert was called with the right jobId
    expect(mockDb.evaluation.upsert).toHaveBeenCalledOnce()
    const upsertCall = mockDb.evaluation.upsert.mock.calls[0][0]
    expect(upsertCall.where).toEqual({ jobId: 'job-1' })
    expect(upsertCall.create.score).toBe(4.2)
    expect(upsertCall.create.legitimacy).toBe('High Confidence')
    expect(upsertCall.create.recommendApply).toBe(true)

    // Job update sets status to Evaluated
    expect(mockDb.job.update).toHaveBeenCalledOnce()
    const updateCall = mockDb.job.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('Evaluated')
    expect(updateCall.data.score).toBe(4.2)

    // Response contains the evaluation row
    const body = await res.json()
    expect(body.id).toBe('eval-1')
    expect(body.score).toBe(4.2)
  })

  it('scrapes JD when rawJD is empty, persists it, then evaluates', async () => {
    const jobNoJD = { ...fakeJob, rawJD: '' }
    mockDb.job.findFirst.mockResolvedValue(jobNoJD)
    mockScrapeJD.mockResolvedValue('Scraped job description content')

    const [req, ctx] = buildRequest('job-1')
    await POST(req as Parameters<typeof POST>[0], ctx)

    expect(mockScrapeJD).toHaveBeenCalledOnce()
    expect(mockScrapeJD).toHaveBeenCalledWith(jobNoJD.url, 'test-firecrawl-key')

    // Job update with rawJD was called
    expect(mockDb.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { rawJD: 'Scraped job description content' },
    })

    // evaluateJob received the scraped JD
    expect(mockEvaluateJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobJD: 'Scraped job description content' }),
    )
  })

  it('skips scraping when rawJD is already populated', async () => {
    const [req, ctx] = buildRequest('job-1')
    await POST(req as Parameters<typeof POST>[0], ctx)

    expect(mockScrapeJD).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected errors', async () => {
    mockDb.profile.findUnique.mockRejectedValue(new Error('DB connection failed'))
    const [req, ctx] = buildRequest('job-1')
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB connection failed')
  })
})
