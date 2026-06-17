import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchJobs, scrapeJD } from '../search'

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
