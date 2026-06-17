import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectProvider, fetchBoard, matchesTitleFilter, scanPortals } from '../scan'
import type { ScanEntry } from '../scan'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('detectProvider', () => {
  it('detects greenhouse from job-boards.greenhouse.io', () => {
    const r = detectProvider('https://job-boards.greenhouse.io/canonical')
    expect(r?.provider).toBe('greenhouse')
    expect(r?.apiUrl).toBe('https://boards-api.greenhouse.io/v1/boards/canonical/jobs')
  })

  it('detects greenhouse from job-boards.eu.greenhouse.io', () => {
    const r = detectProvider('https://job-boards.eu.greenhouse.io/somecompany')
    expect(r?.provider).toBe('greenhouse')
    expect(r?.apiUrl).toBe('https://boards-api.greenhouse.io/v1/boards/somecompany/jobs')
  })

  it('detects greenhouse from boards.greenhouse.io', () => {
    const r = detectProvider('https://boards.greenhouse.io/gitlab')
    expect(r?.provider).toBe('greenhouse')
    expect(r?.apiUrl).toBe('https://boards-api.greenhouse.io/v1/boards/gitlab/jobs')
  })

  it('detects ashby from jobs.ashbyhq.com', () => {
    const r = detectProvider('https://jobs.ashbyhq.com/linear')
    expect(r?.provider).toBe('ashby')
    expect(r?.apiUrl).toBe('https://api.ashbyhq.com/posting-api/job-board/linear?includeCompensation=true')
  })

  it('detects lever from jobs.lever.co', () => {
    const r = detectProvider('https://jobs.lever.co/stripe')
    expect(r?.provider).toBe('lever')
    expect(r?.apiUrl).toBe('https://api.lever.co/v0/postings/stripe')
  })

  it('returns null for unknown URL', () => {
    expect(detectProvider('https://careers.example.com/jobs')).toBeNull()
  })
})

describe('fetchBoard', () => {
  it('maps greenhouse JSON to Candidates with company=entry.name', async () => {
    const entry: ScanEntry = { name: 'Canonical', careersUrl: 'https://job-boards.greenhouse.io/canonical' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          { title: 'Project Coordinator', absolute_url: 'https://boards.greenhouse.io/canonical/jobs/1', location: { name: 'Remote' } },
        ],
      }),
    } as Response)
    const result = await fetchBoard(entry)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ title: 'Project Coordinator', company: 'Canonical', url: 'https://boards.greenhouse.io/canonical/jobs/1', location: 'Remote' })
  })

  it('maps ashby JSON to Candidates', async () => {
    const entry: ScanEntry = { name: 'Linear', careersUrl: 'https://jobs.ashbyhq.com/linear' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          { title: 'Operations Coordinator', jobUrl: 'https://jobs.ashbyhq.com/linear/123', location: 'Remote' },
        ],
      }),
    } as Response)
    const result = await fetchBoard(entry)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ title: 'Operations Coordinator', company: 'Linear', url: 'https://jobs.ashbyhq.com/linear/123' })
  })

  it('maps lever JSON (array) to Candidates', async () => {
    const entry: ScanEntry = { name: 'Stripe', careersUrl: 'https://jobs.lever.co/stripe' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { text: 'Junior Project Manager', hostedUrl: 'https://jobs.lever.co/stripe/abc', categories: { location: 'Remote' } },
      ]),
    } as Response)
    const result = await fetchBoard(entry)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ title: 'Junior Project Manager', company: 'Stripe', url: 'https://jobs.lever.co/stripe/abc', location: 'Remote' })
  })

  it('returns [] for un-detectable careersUrl', async () => {
    const entry: ScanEntry = { name: 'Unknown', careersUrl: 'https://careers.example.com' }
    const result = await fetchBoard(entry)
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns [] on 404', async () => {
    const entry: ScanEntry = { name: 'Gone', careersUrl: 'https://job-boards.greenhouse.io/gone' }
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    const result = await fetchBoard(entry)
    expect(result).toEqual([])
  })

  it('returns [] on fetch error (bad URL aborts)', async () => {
    const entry: ScanEntry = { name: 'Err', careersUrl: 'https://job-boards.greenhouse.io/err' }
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
    const result = await fetchBoard(entry)
    expect(result).toEqual([])
  })

  it('rejects a non-allowlisted host (SSRF guard)', async () => {
    // Simulate a careersUrl that after detection points to a non-allowlisted host
    // We test this via a crafted entry whose careersUrl would trigger detection
    // but the resolved host is not in the allowlist.
    // Since detectProvider maps known patterns to known hosts, we test indirectly:
    // an unknown careersUrl returns null from detectProvider → [] without fetch
    const entry: ScanEntry = { name: 'Malicious', careersUrl: 'https://evil.example.com/greenhouse.io/company' }
    const result = await fetchBoard(entry)
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('matchesTitleFilter', () => {
  it('includes "Project Coordinator" matching positive filter', () => {
    expect(matchesTitleFilter('Project Coordinator', { positive: ['project coordinator'], negative: ['senior'] })).toBe(true)
  })

  it('excludes "Senior Project Manager" matching negative filter', () => {
    expect(matchesTitleFilter('Senior Project Manager', { positive: ['project manager'], negative: ['senior'] })).toBe(false)
  })

  it('passes when filter is undefined', () => {
    expect(matchesTitleFilter('Any Title')).toBe(true)
  })

  it('fails when positive is non-empty and title does not match', () => {
    expect(matchesTitleFilter('Unrelated Role', { positive: ['project coordinator'] })).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(matchesTitleFilter('SENIOR engineer', { negative: ['senior'] })).toBe(false)
    expect(matchesTitleFilter('Project COORDINATOR', { positive: ['project coordinator'] })).toBe(true)
  })
})

describe('scanPortals', () => {
  it('aggregates results across multiple entries and applies title filter', async () => {
    const entries: ScanEntry[] = [
      { name: 'Canonical', careersUrl: 'https://job-boards.greenhouse.io/canonical' },
      { name: 'Stripe', careersUrl: 'https://jobs.lever.co/stripe' },
    ]
    // First fetch: greenhouse
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [
            { title: 'Project Coordinator', absolute_url: 'https://boards.greenhouse.io/canonical/jobs/1', location: { name: 'Remote' } },
            { title: 'Senior Director', absolute_url: 'https://boards.greenhouse.io/canonical/jobs/2', location: { name: 'London' } },
          ],
        }),
      } as Response)
      // Second fetch: lever
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { text: 'Operations Coordinator', hostedUrl: 'https://jobs.lever.co/stripe/abc', categories: { location: 'Nairobi' } },
        ]),
      } as Response)

    const results = await scanPortals(entries, {
      titleFilter: { positive: ['coordinator', 'project coordinator', 'operations coordinator'], negative: ['senior', 'director'] },
    })
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.title)).not.toContain('Senior Director')
  })

  it('skips disabled entries', async () => {
    const entries: ScanEntry[] = [
      { name: 'Active', careersUrl: 'https://job-boards.greenhouse.io/active', enabled: true },
      { name: 'Disabled', careersUrl: 'https://job-boards.greenhouse.io/disabled', enabled: false },
    ]
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] }),
    } as Response)

    await scanPortals(entries)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
