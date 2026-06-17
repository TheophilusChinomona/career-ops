import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { detectProvider, fetchBoard, matchesTitleFilter, scanPortals, parseWorkableMarkdown } from '../scan'
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

  // SmartRecruiters
  it('detects smartrecruiters from careers.smartrecruiters.com', () => {
    const r = detectProvider('https://careers.smartrecruiters.com/Acme')
    expect(r?.provider).toBe('smartrecruiters')
    expect(r?.apiUrl).toBe('https://api.smartrecruiters.com/v1/companies/Acme/postings?limit=100&offset=0&status=PUBLIC')
  })

  it('detects smartrecruiters from jobs.smartrecruiters.com', () => {
    const r = detectProvider('https://jobs.smartrecruiters.com/Acme')
    expect(r?.provider).toBe('smartrecruiters')
    expect(r?.apiUrl).toContain('/companies/Acme/')
  })

  it('detects smartrecruiters from www.smartrecruiters.com/{slug}', () => {
    const r = detectProvider('https://www.smartrecruiters.com/Globocorp')
    expect(r?.provider).toBe('smartrecruiters')
    expect(r?.apiUrl).toContain('/companies/Globocorp/')
  })

  // Workday
  it('detects workday from myworkdayjobs.com URL', () => {
    const r = detectProvider('https://acme.wd1.myworkdayjobs.com/careers')
    expect(r?.provider).toBe('workday')
    expect(r?.apiUrl).toBe('https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/careers/jobs')
    if (r?.provider === 'workday') {
      expect(r.jobBase).toBe('https://acme.wd1.myworkdayjobs.com/careers')
    }
  })

  it('detects workday with locale segment', () => {
    const r = detectProvider('https://acme.wd5.myworkdayjobs.com/en-US/External')
    expect(r?.provider).toBe('workday')
    expect(r?.apiUrl).toBe('https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs')
  })

  // Workable
  it('detects workable from apply.workable.com', () => {
    const r = detectProvider('https://apply.workable.com/techcorp')
    expect(r?.provider).toBe('workable')
    expect(r?.apiUrl).toBe('https://apply.workable.com/techcorp/jobs.md')
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

  // SmartRecruiters tests
  it('maps SmartRecruiters JSON to Candidates with company=entry.name', async () => {
    const entry: ScanEntry = { name: 'Acme', careersUrl: 'https://careers.smartrecruiters.com/Acme' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            id: 'job-123',
            name: 'Software Engineer',
            ref: 'https://jobs.smartrecruiters.com/Acme/job-123',
            location: { fullLocation: 'New York, NY, USA', city: 'New York', remote: false },
          },
        ],
      }),
    } as Response)
    const result = await fetchBoard(entry)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      title: 'Software Engineer',
      company: 'Acme',
      url: 'https://jobs.smartrecruiters.com/Acme/job-123',
      location: 'New York, NY, USA',
    })
  })

  it('SmartRecruiters appends (Remote) when remote flag is true', async () => {
    const entry: ScanEntry = { name: 'Acme', careersUrl: 'https://careers.smartrecruiters.com/Acme' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            id: 'job-456',
            name: 'Remote Dev',
            location: { city: 'London', country: 'UK', remote: true },
          },
        ],
      }),
    } as Response)
    const result = await fetchBoard(entry)
    expect(result).toHaveLength(1)
    expect(result[0].location).toBe('London, UK (Remote)')
  })

  it('SmartRecruiters remote-only (no city/region/country) sets location to (Remote)', async () => {
    const entry: ScanEntry = { name: 'Acme', careersUrl: 'https://careers.smartrecruiters.com/Acme' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          {
            id: 'job-789',
            name: 'Fully Remote',
            location: { remote: true },
          },
        ],
      }),
    } as Response)
    const result = await fetchBoard(entry)
    expect(result[0].location).toBe('(Remote)')
  })

  it('SmartRecruiters: non-allowlisted host returns []', async () => {
    const entry: ScanEntry = { name: 'Evil', careersUrl: 'https://evil.example.com/smartrecruiters.com/Acme' }
    const result = await fetchBoard(entry)
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  // Workday tests
  it('maps Workday paginated JSON to Candidates', async () => {
    const entry: ScanEntry = { name: 'CorpInc', careersUrl: 'https://corpinc.wd3.myworkdayjobs.com/careers' }
    // First page: 20 items, second page: fewer than 20 → stops
    const makePosting = (i: number) => ({ title: `Job ${i}`, externalPath: `/job/job-${i}`, locationsText: 'Remote' })
    const page1 = Array.from({ length: 20 }, (_, i) => makePosting(i))
    const page2 = [makePosting(20), makePosting(21)]

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobPostings: page1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobPostings: page2 }),
      } as Response)

    const result = await fetchBoard(entry)
    expect(result).toHaveLength(22)
    expect(result[0]).toMatchObject({
      title: 'Job 0',
      company: 'CorpInc',
      url: 'https://corpinc.wd3.myworkdayjobs.com/careers/job/job-0',
      location: 'Remote',
    })
    // fetch should have been called exactly twice (page 0 and page 1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('Workday pagination stops when page returns exactly 20 but next page returns 0', async () => {
    const entry: ScanEntry = { name: 'CorpInc', careersUrl: 'https://corpinc.wd3.myworkdayjobs.com/careers' }
    const makePosting = (i: number) => ({ title: `Job ${i}`, externalPath: `/job/job-${i}`, locationsText: '' })
    const page1 = Array.from({ length: 20 }, (_, i) => makePosting(i))

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobPostings: page1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobPostings: [] }),
      } as Response)

    const result = await fetchBoard(entry)
    expect(result).toHaveLength(20)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('Workday skips items without externalPath', async () => {
    const entry: ScanEntry = { name: 'CorpInc', careersUrl: 'https://corpinc.wd3.myworkdayjobs.com/careers' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobPostings: [
          { title: 'Valid Job', externalPath: '/job/valid', locationsText: 'NYC' },
          { title: 'No Path Job' }, // no externalPath
        ],
      }),
    } as Response)

    const result = await fetchBoard(entry)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Valid Job')
  })

  it('Workday: non-allowlisted host returns []', async () => {
    const entry: ScanEntry = { name: 'Evil', careersUrl: 'https://evil.example.com/myworkdayjobs.com/site' }
    const result = await fetchBoard(entry)
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  // Workable tests
  it('maps Workable markdown feed to Candidates', async () => {
    const entry: ScanEntry = { name: 'TechCorp', careersUrl: 'https://apply.workable.com/techcorp' }
    const markdownTable = [
      '| Title | Department | Location | Type | Salary | Posted | Apply |',
      '|-------|------------|----------|------|--------|--------|-------|',
      '| Software Engineer | Engineering | Remote | Full-time | N/A | 2026-06-01 | [View](https://apply.workable.com/techcorp/j/ABC123) |',
      '| Product Manager | Product | New York | Full-time | N/A | 2026-06-10 | [View](https://apply.workable.com/techcorp/j/DEF456) |',
    ].join('\n')

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => markdownTable,
    } as unknown as Response)

    const result = await fetchBoard(entry)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      title: 'Software Engineer',
      company: 'TechCorp',
      url: 'https://apply.workable.com/techcorp/j/ABC123',
    })
    expect(result[1]).toMatchObject({
      title: 'Product Manager',
      company: 'TechCorp',
      url: 'https://apply.workable.com/techcorp/j/DEF456',
    })
  })

  it('Workable: non-allowlisted host returns []', async () => {
    const entry: ScanEntry = { name: 'Evil', careersUrl: 'https://evil.example.com/apply.workable.com/techcorp' }
    const result = await fetchBoard(entry)
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('parseWorkableMarkdown', () => {
  const sampleTable = `
| Title | Department | Location | Type | Salary | Posted | Apply |
|-------|------------|----------|------|--------|--------|-------|
| Software Engineer | Engineering | Remote | Full-time | N/A | 2026-06-01 | [View](https://apply.workable.com/techcorp/j/ABC123) |
| Product Manager | Product | New York | Full-time | N/A | 2026-06-10 | [View](https://apply.workable.com/techcorp/j/DEF456) |
| Bad Entry | Other | Berlin | Full-time | N/A | 2026-06-10 | [View](https://evil.example.com/job/XYZ) |
| MD Extension | Engineering | London | Full-time | N/A | 2026-06-05 | [View](https://apply.workable.com/techcorp/j/GHI789.md) |
`.trim()

  it('parses valid rows into Candidates', () => {
    const results = parseWorkableMarkdown(sampleTable, 'TechCorp')
    // Should skip the header row and the off-domain row
    expect(results.length).toBeGreaterThanOrEqual(2)
    const titles = results.map((r) => r.title)
    expect(titles).toContain('Software Engineer')
    expect(titles).toContain('Product Manager')
  })

  it('skips the header row (Title column)', () => {
    const results = parseWorkableMarkdown(sampleTable, 'TechCorp')
    const titles = results.map((r) => r.title)
    expect(titles).not.toContain('Title')
  })

  it('skips off-domain URLs', () => {
    const results = parseWorkableMarkdown(sampleTable, 'TechCorp')
    const urls = results.map((r) => r.url)
    expect(urls).not.toContain('https://evil.example.com/job/XYZ')
  })

  it('strips trailing .md from URL', () => {
    const results = parseWorkableMarkdown(sampleTable, 'TechCorp')
    const mdEntry = results.find((r) => r.title === 'MD Extension')
    expect(mdEntry?.url).toBe('https://apply.workable.com/techcorp/j/GHI789')
  })

  it('sets company on every candidate', () => {
    const results = parseWorkableMarkdown(sampleTable, 'TechCorp')
    expect(results.every((r) => r.company === 'TechCorp')).toBe(true)
  })

  it('extracts location from the location column', () => {
    const results = parseWorkableMarkdown(sampleTable, 'TechCorp')
    const se = results.find((r) => r.title === 'Software Engineer')
    expect(se?.location).toBe('Remote')
    const pm = results.find((r) => r.title === 'Product Manager')
    expect(pm?.location).toBe('New York')
  })

  it('returns [] for empty text', () => {
    expect(parseWorkableMarkdown('', 'AnyCompany')).toEqual([])
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
