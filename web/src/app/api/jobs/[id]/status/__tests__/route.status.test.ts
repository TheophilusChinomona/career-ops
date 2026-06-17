import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (must be declared before imports) ---

vi.mock('@/lib/db', () => ({
  db: {
    job: { updateMany: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@/services/jobs', () => ({
  setStatus: vi.fn(),
  getJob: vi.fn(),
}))

// Mock JobStatus enum (mirrors the generated prisma enum)
vi.mock('@/generated/prisma', () => ({
  JobStatus: {
    Evaluated: 'Evaluated',
    Applied: 'Applied',
    Responded: 'Responded',
    Interview: 'Interview',
    Offer: 'Offer',
    Rejected: 'Rejected',
    Discarded: 'Discarded',
    SKIP: 'SKIP',
    New: 'New',
  },
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { setStatus, getJob } from '@/services/jobs'

const mockAuth = auth as unknown as { api: { getSession: ReturnType<typeof vi.fn> } }
const mockSetStatus = setStatus as ReturnType<typeof vi.fn>
const mockGetJob = getJob as ReturnType<typeof vi.fn>

const fakeUser = { id: 'user-1', email: 'test@example.com' }
const fakeJob = {
  id: 'job-1',
  userId: 'user-1',
  company: 'TechCo',
  role: 'Engineer',
  url: 'https://example.com',
  rawJD: 'Some JD text',
  status: 'Applied',
  score: null,
}

function buildRequest(
  jobId: string,
  body: Record<string, unknown>,
): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/jobs/${jobId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: jobId }) }]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.api.getSession.mockResolvedValue({ user: fakeUser })
  mockSetStatus.mockResolvedValue({ count: 1 })
  mockGetJob.mockResolvedValue(fakeJob)
})

describe('POST /api/jobs/[id]/status', () => {
  it('returns 401 when no session', async () => {
    mockAuth.api.getSession.mockResolvedValue(null)
    const [req, ctx] = buildRequest('job-1', { status: 'Applied' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when status is not a valid JobStatus', async () => {
    const [req, ctx] = buildRequest('job-1', { status: 'Bogus' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid status/i)
  })

  it('returns 400 when status field is missing', async () => {
    const [req, ctx] = buildRequest('job-1', {})
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(400)
  })

  it('calls setStatus with userId, id, validStatus and returns the updated job', async () => {
    const [req, ctx] = buildRequest('job-1', { status: 'Applied' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)

    expect(res.status).toBe(200)
    expect(mockSetStatus).toHaveBeenCalledOnce()
    expect(mockSetStatus).toHaveBeenCalledWith('user-1', 'job-1', 'Applied')

    const body = await res.json()
    expect(body.id).toBe('job-1')
    expect(body.status).toBe('Applied')
  })

  it('returns 404 when job is not found after status update', async () => {
    mockGetJob.mockResolvedValue(null)
    const [req, ctx] = buildRequest('job-1', { status: 'Rejected' })
    const res = await POST(req as Parameters<typeof POST>[0], ctx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })
})
