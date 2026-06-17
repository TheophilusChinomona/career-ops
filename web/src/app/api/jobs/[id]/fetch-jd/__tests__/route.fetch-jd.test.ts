import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { job: { findFirst: vi.fn(), update: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock('@/services/search', () => ({ scrapeJD: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'fc-test' } }))

import { POST } from '../route'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { scrapeJD } from '@/services/search'

const mockDb = db as unknown as { job: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } }
const mockAuth = auth as unknown as { api: { getSession: ReturnType<typeof vi.fn> } }
const mockScrape = scrapeJD as unknown as ReturnType<typeof vi.fn>

const req = () => new Request('http://x/api/jobs/job-1/fetch-jd', { method: 'POST' })
const params = Promise.resolve({ id: 'job-1' })

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.api.getSession.mockResolvedValue({ user: { id: 'u1' } })
})

describe('POST /api/jobs/[id]/fetch-jd', () => {
  it('401 when no session', async () => {
    mockAuth.api.getSession.mockResolvedValue(null)
    const res = await POST(req() as never, { params })
    expect(res.status).toBe(401)
  })

  it('404 when job not found', async () => {
    mockDb.job.findFirst.mockResolvedValue(null)
    const res = await POST(req() as never, { params })
    expect(res.status).toBe(404)
  })

  it('400 when the job has no scrapable URL (local:)', async () => {
    mockDb.job.findFirst.mockResolvedValue({ id: 'job-1', url: 'local:acme' })
    const res = await POST(req() as never, { params })
    expect(res.status).toBe(400)
  })

  it('scrapes, persists rawJD, and returns it', async () => {
    mockDb.job.findFirst.mockResolvedValue({ id: 'job-1', url: 'https://boards.greenhouse.io/acme/jobs/1' })
    mockScrape.mockResolvedValue('# Project Coordinator\n\nWe are hiring...')
    const res = await POST(req() as never, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rawJD).toMatch(/Project Coordinator/)
    expect(mockDb.job.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { rawJD: expect.stringContaining('Project Coordinator') } })
  })

  it('502 when the scrape returns empty', async () => {
    mockDb.job.findFirst.mockResolvedValue({ id: 'job-1', url: 'https://x.com/job/1' })
    mockScrape.mockResolvedValue('   ')
    const res = await POST(req() as never, { params })
    expect(res.status).toBe(502)
    expect(mockDb.job.update).not.toHaveBeenCalled()
  })
})
