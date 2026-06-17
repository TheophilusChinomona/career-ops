import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (before any imports) ---

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

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

vi.mock('@/llm/provider', () => ({
  getProvider: vi.fn(),
}))

vi.mock('@/services/import-url', () => ({
  addJobFromUrl: vi.fn(),
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { getProvider } from '@/llm/provider'
import { addJobFromUrl } from '@/services/import-url'

const mockAuth = auth as unknown as { api: { getSession: ReturnType<typeof vi.fn> } }
const mockGetProvider = getProvider as ReturnType<typeof vi.fn>
const mockAddJobFromUrl = addJobFromUrl as ReturnType<typeof vi.fn>

const fakeUser = { id: 'user-1', email: 'test@example.com' }
const fakeJob = { id: 'job-99', userId: 'user-1', company: 'Acme', role: 'Engineer' }
const fakeProvider = { complete: vi.fn() }

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/jobs/from-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.api.getSession.mockResolvedValue({ user: fakeUser })
  mockGetProvider.mockReturnValue(fakeProvider)
  mockAddJobFromUrl.mockResolvedValue({ job: fakeJob, created: true })
})

describe('POST /api/jobs/from-url', () => {
  it('returns 401 when no session', async () => {
    mockAuth.api.getSession.mockResolvedValue(null)
    const res = await POST(buildRequest({ url: 'https://example.com/job' }) as Parameters<typeof POST>[0])
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when url is missing', async () => {
    const res = await POST(buildRequest({}) as Parameters<typeof POST>[0])
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/url is required/i)
  })

  it('returns jobId and created:true on success', async () => {
    const res = await POST(buildRequest({ url: 'https://example.com/job/1' }) as Parameters<typeof POST>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobId).toBe('job-99')
    expect(body.created).toBe(true)
  })

  it('returns created:false for a duplicate URL', async () => {
    mockAddJobFromUrl.mockResolvedValue({ job: fakeJob, created: false })
    const res = await POST(buildRequest({ url: 'https://example.com/job/1' }) as Parameters<typeof POST>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobId).toBe('job-99')
    expect(body.created).toBe(false)
  })

  it('returns 400 on bad-url error from addJobFromUrl', async () => {
    mockAddJobFromUrl.mockRejectedValue(new Error('URL must use http or https'))
    const res = await POST(buildRequest({ url: 'ftp://bad-url' }) as Parameters<typeof POST>[0])
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/http/i)
  })

  it('returns 502 on blocked/empty scrape error', async () => {
    mockAddJobFromUrl.mockRejectedValue(new Error('Could not read the posting (the page may be blocked or empty)'))
    const res = await POST(buildRequest({ url: 'https://bot-blocked.com/job' }) as Parameters<typeof POST>[0])
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/Could not read the posting/)
  })

  it('returns 500 on unexpected errors', async () => {
    mockAddJobFromUrl.mockRejectedValue(new Error('DB connection failed'))
    const res = await POST(buildRequest({ url: 'https://example.com/job' }) as Parameters<typeof POST>[0])
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal error')
  })

  it('proceeds without provider when getProvider throws (no LLM key)', async () => {
    mockGetProvider.mockImplementation(() => { throw new Error('ANTHROPIC_API_KEY missing') })
    const res = await POST(buildRequest({ url: 'https://example.com/job/1' }) as Parameters<typeof POST>[0])
    // Should still succeed via heuristic fallback (provider=undefined)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobId).toBe('job-99')
  })
})
