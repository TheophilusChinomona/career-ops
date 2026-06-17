export type Candidate = { url: string; title: string; description?: string; company?: string }

export async function searchJobs(query: string, apiKey: string, limit = 10): Promise<Candidate[]> {
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY missing')
  const res = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  })
  if (!res.ok) throw new Error(`Firecrawl search failed: ${res.status}`)
  const data = await res.json()
  const web = data?.data?.web ?? []
  return web.map((w: { url: string; title: string; description?: string }) => ({
    url: w.url,
    title: w.title,
    description: w.description,
    company: (w.title?.split(/ @ | \| | at /)[1] ?? '').trim() || undefined,
  }))
}

export async function scrapeJD(url: string, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY missing')
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
  })
  if (!res.ok) throw new Error(`Firecrawl scrape failed: ${res.status}`)
  const data = await res.json()
  return data?.data?.markdown ?? ''
}
