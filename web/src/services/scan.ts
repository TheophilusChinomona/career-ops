import type { Candidate } from './search'

export type ScanEntry = { name: string; careersUrl: string; enabled?: boolean }
export type TitleFilter = { positive?: string[]; negative?: string[] }

const ALLOWED_HOSTS = new Set([
  'boards-api.greenhouse.io',
  'api.ashbyhq.com',
  'api.lever.co',
])

export function detectProvider(careersUrl: string): { provider: 'greenhouse' | 'ashby' | 'lever'; apiUrl: string } | null {
  // Greenhouse: https://job-boards(.eu)?.greenhouse.io/{slug} OR https://boards.greenhouse.io/{slug}
  const ghMatch = careersUrl.match(/(?:job-boards(?:\.eu)?|boards)\.greenhouse\.io\/([^/?#]+)/)
  if (ghMatch) {
    return { provider: 'greenhouse', apiUrl: `https://boards-api.greenhouse.io/v1/boards/${ghMatch[1]}/jobs` }
  }
  // Ashby: https://jobs.ashbyhq.com/{slug}
  const ashbyMatch = careersUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/)
  if (ashbyMatch) {
    return { provider: 'ashby', apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${ashbyMatch[1]}?includeCompensation=true` }
  }
  // Lever: https://jobs.lever.co/{slug}
  const leverMatch = careersUrl.match(/jobs\.lever\.co\/([^/?#]+)/)
  if (leverMatch) {
    return { provider: 'lever', apiUrl: `https://api.lever.co/v0/postings/${leverMatch[1]}` }
  }
  return null
}

export async function fetchBoard(entry: ScanEntry): Promise<Candidate[]> {
  const detected = detectProvider(entry.careersUrl)
  if (!detected) return []

  // Host allowlist check
  let apiHost: string
  try {
    apiHost = new URL(detected.apiUrl).hostname
  } catch {
    return []
  }
  if (!ALLOWED_HOSTS.has(apiHost)) return []

  try {
    const timeout = detected.provider === 'ashby' ? 20000 : 10000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    let res: Response
    try {
      res = await fetch(detected.apiUrl, { redirect: 'error', signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) return []
    const json = await res.json() as unknown
    return mapToCandidate(detected.provider, json, entry.name)
  } catch {
    return []
  }
}

function mapToCandidate(provider: 'greenhouse' | 'ashby' | 'lever', json: unknown, company: string): Candidate[] {
  if (provider === 'greenhouse') {
    const data = json as { jobs?: Array<{ title?: string; absolute_url?: string; location?: { name?: string } }> }
    return (data.jobs ?? [])
      .filter((j) => j.absolute_url)
      .map((j) => ({
        url: j.absolute_url!,
        title: j.title ?? '',
        company,
        location: j.location?.name,
      }))
  }
  if (provider === 'ashby') {
    const data = json as { jobs?: Array<{ title?: string; jobUrl?: string; location?: string }> }
    return (data.jobs ?? []).map((j) => ({
      url: j.jobUrl ?? '',
      title: j.title ?? '',
      company,
      location: j.location,
    }))
  }
  // lever
  const arr = Array.isArray(json) ? json as Array<{ text?: string; hostedUrl?: string; categories?: { location?: string } }> : []
  return arr.map((j) => ({
    url: j.hostedUrl ?? '',
    title: j.text ?? '',
    company,
    location: j.categories?.location,
  }))
}

export function matchesTitleFilter(title: string, f?: TitleFilter): boolean {
  if (!f) return true
  const lower = title.toLowerCase()
  const neg = f.negative ?? []
  if (neg.some((n) => lower.includes(n.toLowerCase()))) return false
  const pos = f.positive ?? []
  if (pos.length > 0 && !pos.some((p) => lower.includes(p.toLowerCase()))) return false
  return true
}

export async function scanPortals(
  entries: ScanEntry[],
  opts?: { titleFilter?: TitleFilter; concurrency?: number },
): Promise<Candidate[]> {
  const enabled = entries.filter((e) => e.enabled !== false)
  const concurrency = opts?.concurrency ?? 6

  const results: Candidate[] = []
  for (let i = 0; i < enabled.length; i += concurrency) {
    const batch = enabled.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map((e) => fetchBoard(e)))
    results.push(...batchResults.flat())
  }

  return results.filter((c) => matchesTitleFilter(c.title, opts?.titleFilter))
}
