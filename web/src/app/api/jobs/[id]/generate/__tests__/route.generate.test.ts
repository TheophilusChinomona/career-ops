import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (must come before any imports that use them) ---

vi.mock('@/lib/db', () => ({
  db: {
    profile: { findUnique: vi.fn() },
    cvMaster: { findUnique: vi.fn() },
    job: { findFirst: vi.fn() },
    document: { create: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@/lib/env', () => ({
  env: {
    LLM_PROVIDER: 'claude',
    LLM_MODEL: 'claude-3-5-sonnet-20241022',
    ANTHROPIC_API_KEY: 'test-key',
    OPENAI_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
  },
}))

vi.mock('@/llm/provider', () => ({
  getProvider: vi.fn(),
}))

// Mock the generate service to avoid real LLM/browser calls
vi.mock('@/services/generate', () => ({
  generateCv: vi.fn(),
  generateCover: vi.fn(),
}))

import { POST } from '../route'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getProvider } from '@/llm/provider'
import { generateCv, generateCover } from '@/services/generate'

type MockDb = {
  profile: { findUnique: ReturnType<typeof vi.fn> }
  cvMaster: { findUnique: ReturnType<typeof vi.fn> }
  job: { findFirst: ReturnType<typeof vi.fn> }
  document: { create: ReturnType<typeof vi.fn> }
}

const mockDb = db as unknown as MockDb
const mockAuth = auth as unknown as { api: { getSession: ReturnType<typeof vi.fn> } }
const mockGetProvider = getProvider as ReturnType<typeof vi.fn>
const mockGenerateCv = generateCv as ReturnType<typeof vi.fn>
const mockGenerateCover = generateCover as ReturnType<typeof vi.fn>

// --- fixtures ---

const fakeUser = { id: 'user-1', email: 'tino@example.com' }
const fakeProfile = {
  id: 'profile-1',
  userId: 'user-1',
  fullName: 'Tino Maramba',
  email: 'tino@example.com',
  phone: '+2712345678',
  location: 'Remote',
  linkedin: 'linkedin.com/in/tino',
  targetRoles: ['Senior Engineer'],
  compTarget: '$150k',
  narrative: 'Driven developer',
  llmProvider: null,
  model: null,
}
const fakeCvMaster = {
  id: 'cv-1',
  userId: 'user-1',
  summary: 'Full-stack developer',
  experience: [],
  education: [],
  certs: [],
  skills: [],
}
const fakeJob = {
  id: 'job-1',
  userId: 'user-1',
  company: 'TechCo',
  role: 'Senior Engineer',
  url: 'https://techco.com/jobs/1',
  rawJD: 'Looking for senior engineers.',
  status: 'New',
  score: null,
}
const fakeProvider = { complete: vi.fn() }
const fakeCvResult = {
  html: '<html>CV content</html>',
  pdfPath: '/storage/pdfs/cv-tino.pdf',
  cv: { roleTag: 'Senior Engineer' },
}
const fakeCoverResult = {
  html: '<html>Cover content</html>',
  pdfPath: '/storage/pdfs/cover-tino.pdf',
  text: 'Dear Hiring Team...',
}
const fakeDocRow = {
  id: 'doc-1',
  userId: 'user-1',
  jobId: 'job-1',
  type: 'cv',
  label: 'CV — TechCo',
  html: fakeCvResult.html,
  pdfPath: fakeCvResult.pdfPath,
  createdAt: new Date(),
}

function buildRequest(jobId: string, body: object): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/jobs/${jobId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: jobId }) }]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.api.getSession.mockResolvedValue({ user: fakeUser })
  mockDb.profile.findUnique.mockResolvedValue(fakeProfile)
  mockDb.cvMaster.findUnique.mockResolvedValue(fakeCvMaster)
  mockDb.job.findFirst.mockResolvedValue(fakeJob)
  mockDb.document.create.mockResolvedValue(fakeDocRow)
  mockGetProvider.mockReturnValue(fakeProvider)
  mockGenerateCv.mockResolvedValue(fakeCvResult)
  mockGenerateCover.mockResolvedValue(fakeCoverResult)
})

describe('POST /api/jobs/[id]/generate', () => {
  it('returns 400 when type is invalid', async () => {
    const [req, ctx] = buildRequest('job-1', { type: 'invalid' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('type must be "cv" or "cover"')
  })

  it('returns 401 when no session', async () => {
    mockAuth.api.getSession.mockResolvedValue(null)
    const [req, ctx] = buildRequest('job-1', { type: 'cv' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 when job not found', async () => {
    mockDb.job.findFirst.mockResolvedValue(null)
    const [req, ctx] = buildRequest('job-1', { type: 'cv' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(404)
  })

  it('creates a Document row for type=cv and returns { documentId, pdfUrl }', async () => {
    const [req, ctx] = buildRequest('job-1', { type: 'cv' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)

    expect(res.status).toBe(200)

    // generateCv was called
    expect(mockGenerateCv).toHaveBeenCalledOnce()

    // db.document.create was called with the right fields
    expect(mockDb.document.create).toHaveBeenCalledOnce()
    const createCall = mockDb.document.create.mock.calls[0][0]
    expect(createCall.data.type).toBe('cv')
    expect(createCall.data.jobId).toBe('job-1')
    expect(createCall.data.userId).toBe('user-1')
    expect(createCall.data.html).toBe(fakeCvResult.html)
    expect(createCall.data.pdfPath).toBe(fakeCvResult.pdfPath)

    // response contains documentId and pdfUrl
    const body = await res.json()
    expect(body.documentId).toBe('doc-1')
    expect(body.pdfUrl).toBe('/api/documents/doc-1/pdf')
  })

  it('creates a Document row for type=cover and returns { documentId, pdfUrl }', async () => {
    const coverDocRow = { ...fakeDocRow, id: 'doc-2', type: 'cover' }
    mockDb.document.create.mockResolvedValue(coverDocRow)

    const [req, ctx] = buildRequest('job-1', { type: 'cover' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)

    expect(res.status).toBe(200)
    expect(mockGenerateCover).toHaveBeenCalledOnce()
    expect(mockGenerateCover).toHaveBeenCalledWith(
      expect.objectContaining({
        job: expect.objectContaining({
          company: fakeJob.company,
          role: fakeJob.role,
          rawJD: fakeJob.rawJD,
        }),
      }),
    )
    expect(mockDb.document.create).toHaveBeenCalledOnce()

    const body = await res.json()
    expect(body.documentId).toBe('doc-2')
    expect(body.pdfUrl).toBe('/api/documents/doc-2/pdf')
  })

  it('returns 500 on unexpected errors', async () => {
    mockDb.profile.findUnique.mockRejectedValue(new Error('DB error'))
    const [req, ctx] = buildRequest('job-1', { type: 'cv' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB error')
  })
})
