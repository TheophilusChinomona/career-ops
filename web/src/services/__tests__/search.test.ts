import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchJobs, scrapeJD, keepResult } from '../search'

afterEach(() => vi.restoreAllMocks())

function stubSearch(web: Array<{ url: string; title: string; description?: string }>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { web } }) }))
}

describe('searchJobs', () => {
  it('maps Firecrawl web results to candidates', async () => {
    stubSearch([{ url: 'https://x.com/job/1', title: 'Project Coordinator @ RetailNext', description: 'Coordinate...' }])
    const r = await searchJobs('project coordinator remote', 'fc-key')
    expect(r[0].url).toBe('https://x.com/job/1')
    expect(r[0].title).toMatch(/Project Coordinator/)
  })

  it('drops aggregator / index pages, keeps individual postings', async () => {
    stubSearch([
      { url: 'https://za.linkedin.com/jobs/project-coordinator-jobs', title: 'Project Coordinator jobs in South Africa - LinkedIn' },
      { url: 'https://za.indeed.com/q-junior-pm-jobs.html', title: '200+ Junior Project Manager Jobs, Employment' },
      { url: 'https://www.glassdoor.com/Job/sa-pc.htm', title: '187 project coordinator Jobs in South Africa' },
      { url: 'https://boards.greenhouse.io/acme/jobs/123', title: 'Project Coordinator' },
      { url: 'https://jobs.lever.co/beta-corp/abc-123', title: 'Junior Project Manager' },
      { url: 'https://www.remoterocketship.com/company/retailnext-net/jobs/project-coordinator-remote', title: 'Project Coordinator' },
      { url: 'https://www.remoterocketship.com/jobs/africa', title: 'Remote Project Coordinator Jobs in Africa – Apply Now' },
    ])
    const r = await searchJobs('project coordinator remote', 'fc-key')
    const urls = r.map((c) => c.url)
    expect(urls).toContain('https://boards.greenhouse.io/acme/jobs/123')
    expect(urls).toContain('https://jobs.lever.co/beta-corp/abc-123')
    expect(urls).toContain('https://www.remoterocketship.com/company/retailnext-net/jobs/project-coordinator-remote')
    // dropped:
    expect(urls.some((u) => u.includes('linkedin.com'))).toBe(false)
    expect(urls.some((u) => u.includes('indeed.com'))).toBe(false)
    expect(urls.some((u) => u.includes('glassdoor.com'))).toBe(false)
    expect(urls).not.toContain('https://www.remoterocketship.com/jobs/africa')
  })

  it('extracts company from ATS host/path (not the title)', async () => {
    stubSearch([
      { url: 'https://boards.greenhouse.io/acme/jobs/123', title: 'Project Coordinator' },
      { url: 'https://retailnext.breezy.hr/p/abc-cpt', title: 'Project Coordinator' },
      { url: 'https://www.remoterocketship.com/company/retailnext-net/jobs/pc-remote', title: 'Project Coordinator' },
    ])
    const r = await searchJobs('x', 'fc-key')
    const byHost = (frag: string) => r.find((c) => c.url.includes(frag))?.company
    expect(byHost('greenhouse')).toMatch(/Acme/i)
    expect(byHost('breezy')).toMatch(/Retailnext/i)
    expect(byHost('remoterocketship')).toMatch(/Retailnext/i) // -net suffix stripped
  })

  it('keepResult predicate: ATS posting yes, aggregator no, index no', () => {
    expect(keepResult({ url: 'https://jobs.ashbyhq.com/acme/role-1', title: 'PM' })).toBe(true)
    expect(keepResult({ url: 'https://za.linkedin.com/jobs/x', title: 'jobs in South Africa' })).toBe(false)
    expect(keepResult({ url: 'https://example.com/careers/search?q=pm', title: '50+ jobs' })).toBe(false)
    // an index/search page on an ATS host is still dropped
    expect(keepResult({ url: 'https://jobs.workable.com/search', title: 'Project Coordinator' })).toBe(false)
    // regional aggregator boards dropped
    expect(keepResult({ url: 'https://www.careerjunction.co.za/jobs/pc', title: 'PC' })).toBe(false)
  })

  it('never assigns a junk company name (Apply Now / Search / Jobs)', async () => {
    stubSearch([
      { url: 'https://jobs.workable.com/view/abc/project-coordinator', title: 'Project Coordinator - Apply Now' },
      { url: 'https://careers.acmecorp.com/job/123', title: 'Project Coordinator' },
    ])
    const r = await searchJobs('x', 'fc-key')
    for (const c of r) expect(c.company ?? '').not.toMatch(/apply now|^search$|^jobs?$/i)
    expect(r.find((c) => c.url.includes('acmecorp'))?.company).toMatch(/Acmecorp/i)
  })

  it('throws on missing API key', async () => {
    await expect(searchJobs('x', '')).rejects.toThrow(/FIRECRAWL/)
  })
})

describe('scrapeJD', () => {
  it('returns markdown from Firecrawl scrape endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { markdown: '# Senior Engineer\n\nWe are looking for...' } }),
    }))
    const md = await scrapeJD('https://x.com/job/1', 'fc-key')
    expect(md).toContain('Senior Engineer')
  })
  it('throws on missing API key', async () => {
    await expect(scrapeJD('https://x.com/job/1', '')).rejects.toThrow(/FIRECRAWL/)
  })
})
