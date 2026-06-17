import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (must be declared before any imports that use these modules) ---

vi.mock('@/services/search', () => ({
  scrapeJD: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    job: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/llm/run', () => ({
  runValidated: vi.fn(),
}))

import { heuristicFields, extractJobFields, addJobFromUrl } from '../import-url'
import { scrapeJD } from '@/services/search'
import { db } from '@/lib/db'
import { runValidated } from '@/llm/run'
import type { LLMProvider } from '@/llm/types'

type MockDb = {
  job: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

const mockDb = db as unknown as MockDb
const mockScrapeJD = scrapeJD as ReturnType<typeof vi.fn>
const mockRunValidated = runValidated as ReturnType<typeof vi.fn>

const fakeJob = {
  id: 'job-1',
  userId: 'user-1',
  company: 'RetailNext',
  role: 'Project Coordinator',
  url: 'https://example.com/jobs/1',
  applyUrl: 'https://example.com/jobs/1',
  rawJD: '# Project Coordinator\n\nWe are looking for a project coordinator at RetailNext in San Francisco.',
  location: 'San Francisco',
  source: 'url',
  status: 'New',
  score: null,
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// heuristicFields
// ---------------------------------------------------------------------------

describe('heuristicFields', () => {
  it('splits "Role - Company" titles correctly', () => {
    const r = heuristicFields('Project Coordinator - RetailNext', 'https://retailnext.com/jobs/1')
    expect(r.role).toBe('Project Coordinator')
    expect(r.company).toBe('RetailNext')
  })

  it('splits "Role | Company" titles correctly', () => {
    const r = heuristicFields('Engineering Manager | Acme Corp', 'https://acme.com/jobs/2')
    expect(r.role).toBe('Engineering Manager')
    expect(r.company).toBe('Acme Corp')
  })

  it('splits "Role at Company" titles (case-insensitive)', () => {
    const r = heuristicFields('Senior Engineer at Acme', 'https://jobs.acme.com/123')
    expect(r.role).toBe('Senior Engineer')
    expect(r.company).toBe('Acme')
  })

  it('splits "Role @ Company" titles', () => {
    const r = heuristicFields('PM @ StartupCo', 'https://startupco.com/careers/pm')
    expect(r.role).toBe('PM')
    expect(r.company).toBe('StartupCo')
  })

  it('falls back to URL SLD for company when no separator found', () => {
    const r = heuristicFields('Project Coordinator', 'https://retailnext.com/jobs/1')
    expect(r.role).toBe('Project Coordinator')
    expect(r.company).toMatch(/Retailnext/i)
  })

  it('returns undefined for location (heuristic cannot derive it)', () => {
    const r = heuristicFields('PM - Acme', 'https://acme.com/jobs/1')
    expect(r.location).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// extractJobFields
// ---------------------------------------------------------------------------

describe('extractJobFields', () => {
  it('uses heuristic when no provider given', async () => {
    const result = await extractJobFields({
      markdown: 'Some job description',
      pageTitle: 'Project Coordinator - RetailNext',
      url: 'https://retailnext.com/jobs/1',
    })
    expect(result.role).toBe('Project Coordinator')
    expect(result.company).toBe('RetailNext')
    expect(mockRunValidated).not.toHaveBeenCalled()
  })

  it('calls runValidated with provider and returns LLM fields', async () => {
    const fakeProvider: LLMProvider = { complete: vi.fn() }
    mockRunValidated.mockResolvedValue({ company: 'RetailNext', role: 'Project Coordinator', location: 'San Francisco' })

    const result = await extractJobFields({
      markdown: 'Some job description',
      pageTitle: 'PC at RN',
      url: 'https://retailnext.com/jobs/1',
      provider: fakeProvider,
    })

    expect(mockRunValidated).toHaveBeenCalledOnce()
    expect(result.company).toBe('RetailNext')
    expect(result.role).toBe('Project Coordinator')
    expect(result.location).toBe('San Francisco')
  })

  it('falls back to heuristic when LLM leaves fields empty', async () => {
    const fakeProvider: LLMProvider = { complete: vi.fn() }
    mockRunValidated.mockResolvedValue({ company: '', role: '', location: '' })

    const result = await extractJobFields({
      markdown: 'Some job description',
      pageTitle: 'Project Coordinator - RetailNext',
      url: 'https://retailnext.com/jobs/1',
      provider: fakeProvider,
    })

    expect(result.role).toBe('Project Coordinator')
    expect(result.company).toBe('RetailNext')
  })

  it('falls back to heuristic when LLM throws', async () => {
    const fakeProvider: LLMProvider = { complete: vi.fn() }
    mockRunValidated.mockRejectedValue(new Error('LLM error'))

    const result = await extractJobFields({
      markdown: 'Some job description',
      pageTitle: 'Project Coordinator - RetailNext',
      url: 'https://retailnext.com/jobs/1',
      provider: fakeProvider,
    })

    expect(result.role).toBe('Project Coordinator')
    expect(result.company).toBe('RetailNext')
  })
})

// ---------------------------------------------------------------------------
// addJobFromUrl
// ---------------------------------------------------------------------------

describe('addJobFromUrl', () => {
  it('creates a job with source:url, rawJD=scraped markdown, url+applyUrl set', async () => {
    const markdown = '# Project Coordinator\n\nWe are looking for a project coordinator at RetailNext in San Francisco.'
    mockScrapeJD.mockResolvedValue(markdown)
    mockDb.job.findFirst.mockResolvedValue(null)
    mockDb.job.create.mockResolvedValue(fakeJob)

    const result = await addJobFromUrl({
      userId: 'user-1',
      url: 'https://example.com/jobs/1',
      apiKey: 'fc-key',
    })

    expect(result.created).toBe(true)
    expect(result.job).toBe(fakeJob)

    const createCall = mockDb.job.create.mock.calls[0][0]
    expect(createCall.data.source).toBe('url')
    expect(createCall.data.rawJD).toBe(markdown)
    expect(createCall.data.url).toBe('https://example.com/jobs/1')
    expect(createCall.data.applyUrl).toBe('https://example.com/jobs/1')
  })

  it('returns existing job with created:false when dupe exists (userId+company+role)', async () => {
    const markdown = '# Project Coordinator\n\nWe are looking for a project coordinator at RetailNext in San Francisco.'
    mockScrapeJD.mockResolvedValue(markdown)
    mockDb.job.findFirst.mockResolvedValue(fakeJob)

    const result = await addJobFromUrl({
      userId: 'user-1',
      url: 'https://example.com/jobs/1',
      apiKey: 'fc-key',
    })

    expect(result.created).toBe(false)
    expect(result.job).toBe(fakeJob)
    expect(mockDb.job.create).not.toHaveBeenCalled()
  })

  it('throws a clear error on non-http URL', async () => {
    await expect(
      addJobFromUrl({ userId: 'user-1', url: 'ftp://example.com/job', apiKey: 'fc-key' }),
    ).rejects.toThrow(/http/i)
  })

  it('throws a clear error when scrape returns empty/very short content', async () => {
    mockScrapeJD.mockResolvedValue('short')

    await expect(
      addJobFromUrl({ userId: 'user-1', url: 'https://example.com/jobs/1', apiKey: 'fc-key' }),
    ).rejects.toThrow(/Could not read the posting/)
  })

  it('throws a clear error when scrape returns empty string', async () => {
    mockScrapeJD.mockResolvedValue('')

    await expect(
      addJobFromUrl({ userId: 'user-1', url: 'https://example.com/jobs/1', apiKey: 'fc-key' }),
    ).rejects.toThrow(/Could not read the posting/)
  })

  it('throws on an invalid URL', async () => {
    await expect(
      addJobFromUrl({ userId: 'user-1', url: 'not-a-url', apiKey: 'fc-key' }),
    ).rejects.toThrow(/Invalid URL/)
  })
})
