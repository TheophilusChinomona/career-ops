import type { Candidate } from './search'

export type ScanEntry = { name: string; careersUrl: string; enabled?: boolean }
export type TitleFilter = { positive?: string[]; negative?: string[] }

type DetectedProvider =
  | { provider: 'greenhouse' | 'ashby' | 'lever'; apiUrl: string; kind: 'json-get' }
  | { provider: 'smartrecruiters'; apiUrl: string; kind: 'json-get'; slug: string }
  | { provider: 'workday'; apiUrl: string; kind: 'json-post-paged'; jobBase: string; tenant: string; site: string }
  | { provider: 'workable'; apiUrl: string; kind: 'text-md'; slug: string }

const ALLOWED_HOSTS = new Set([
  'boards-api.greenhouse.io',
  'api.ashbyhq.com',
  'api.lever.co',
  'api.smartrecruiters.com',
  'apply.workable.com',
])

function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true
  if (hostname.endsWith('.myworkdayjobs.com')) return true
  return false
}

export function detectProvider(careersUrl: string): DetectedProvider | null {
  // Greenhouse: https://job-boards(.eu)?.greenhouse.io/{slug} OR https://boards.greenhouse.io/{slug}
  const ghMatch = careersUrl.match(/(?:job-boards(?:\.eu)?|boards)\.greenhouse\.io\/([^/?#]+)/)
  if (ghMatch) {
    return { provider: 'greenhouse', apiUrl: `https://boards-api.greenhouse.io/v1/boards/${ghMatch[1]}/jobs`, kind: 'json-get' }
  }
  // Ashby: https://jobs.ashbyhq.com/{slug}
  const ashbyMatch = careersUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/)
  if (ashbyMatch) {
    return { provider: 'ashby', apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${ashbyMatch[1]}?includeCompensation=true`, kind: 'json-get' }
  }
  // Lever: https://jobs.lever.co/{slug}
  const leverMatch = careersUrl.match(/jobs\.lever\.co\/([^/?#]+)/)
  if (leverMatch) {
    return { provider: 'lever', apiUrl: `https://api.lever.co/v0/postings/${leverMatch[1]}`, kind: 'json-get' }
  }

  // SmartRecruiters: various host patterns
  let srSlug: string | null = null
  const srHostMatch = careersUrl.match(/^https?:\/\/(careers|jobs|api)\.smartrecruiters\.com\/([^/?#]+)/)
  if (srHostMatch) {
    srSlug = srHostMatch[2] || null
  }
  if (!srSlug) {
    const srWwwMatch = careersUrl.match(/^https?:\/\/www\.smartrecruiters\.com\/([^/?#]+)/)
    if (srWwwMatch) {
      srSlug = srWwwMatch[1] || null
    }
  }
  if (srSlug) {
    return {
      provider: 'smartrecruiters',
      apiUrl: `https://api.smartrecruiters.com/v1/companies/${srSlug}/postings?limit=100&offset=0&status=PUBLIC`,
      kind: 'json-get',
      slug: srSlug,
    }
  }

  // Workday: https://{tenant}.{instance}.myworkdayjobs.com/[locale/]{site}
  const wdMatch = careersUrl.match(/^https:\/\/([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/)
  if (wdMatch) {
    const tenant = wdMatch[1]
    const instance = wdMatch[2]
    const site = wdMatch[3]
    const origin = `https://${tenant}.${instance}.myworkdayjobs.com`
    return {
      provider: 'workday',
      apiUrl: `${origin}/wday/cxs/${tenant}/${site}/jobs`,
      kind: 'json-post-paged',
      jobBase: `${origin}/${site}`,
      tenant,
      site,
    }
  }

  // Workable: https://apply.workable.com/{slug}
  const workableMatch = careersUrl.match(/^https?:\/\/apply\.workable\.com\/([^/?#]+)/)
  if (workableMatch) {
    const slug = workableMatch[1]
    return {
      provider: 'workable',
      apiUrl: `https://apply.workable.com/${slug}/jobs.md`,
      kind: 'text-md',
      slug,
    }
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
  if (!isAllowedHost(apiHost)) return []

  try {
    if (detected.kind === 'json-post-paged') {
      return await fetchWorkday(detected, entry.name)
    }

    if (detected.kind === 'text-md') {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      let res: Response
      try {
        res = await fetch(detected.apiUrl, { redirect: 'error', signal: controller.signal })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) return []
      const text = await res.text()
      return parseWorkableMarkdown(text, entry.name)
    }

    // json-get (greenhouse, ashby, lever, smartrecruiters)
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

    if (detected.provider === 'smartrecruiters') {
      return mapSmartRecruiters(json, entry.name, detected.slug)
    }
    return mapToCandidate(detected.provider as 'greenhouse' | 'ashby' | 'lever', json, entry.name)
  } catch {
    return []
  }
}

async function fetchWorkday(
  detected: Extract<DetectedProvider, { kind: 'json-post-paged' }>,
  company: string,
): Promise<Candidate[]> {
  const results: Candidate[] = []
  const MAX_PAGES = 25
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      let res: Response
      try {
        res = await fetch(detected.apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limit: 20, offset: page * 20, searchText: '', appliedFacets: {} }),
          redirect: 'error',
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) break
      const json = await res.json() as { jobPostings?: Array<{ title?: string; externalPath?: string; locationsText?: string }> }
      const postings = json.jobPostings ?? []
      for (const p of postings) {
        if (!p.externalPath) continue
        results.push({
          url: detected.jobBase + p.externalPath,
          title: p.title ?? '',
          company,
          location: p.locationsText ?? '',
        })
      }
      if (postings.length < 20) break
    }
  } catch {
    // return whatever we collected so far
  }
  return results
}

function mapSmartRecruiters(
  json: unknown,
  company: string,
  slug: string,
): Candidate[] {
  const data = json as {
    content?: Array<{
      id?: string
      name?: string
      ref?: string
      location?: {
        fullLocation?: string
        city?: string
        region?: string
        country?: string
        remote?: boolean
      }
    }>
  }
  return (data.content ?? []).map((item) => {
    const loc = item.location ?? {}
    let location: string
    if (loc.fullLocation) {
      location = loc.fullLocation
    } else {
      location = [loc.city, loc.region, loc.country].filter(Boolean).join(', ')
    }
    if (loc.remote) location = location ? `${location} (Remote)` : '(Remote)'
    return {
      url: `https://jobs.smartrecruiters.com/${slug}/${item.id ?? ''}`,
      title: item.name ?? '',
      company,
      location: location || undefined,
    }
  })
}

export function parseWorkableMarkdown(text: string, company: string): Candidate[] {
  const results: Candidate[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    if (!trimmed.includes('[View]')) continue
    const cols = trimmed.split('|').map((c) => c.trim())
    // cols[0] and cols[cols.length-1] are empty from leading/trailing |
    // layout: ['', title, dept, location, type, salary, posted, '[View](url)', '']
    const titleCol = cols[1] ?? ''
    if (!titleCol || titleCol === 'Title') continue
    const locationCol = cols[3] ?? ''
    const viewCol = cols[7] ?? cols[cols.length - 2] ?? ''
    const urlMatch = viewCol.match(/\[View\]\(([^)]+)\)/)
    if (!urlMatch) continue
    let url = urlMatch[1].replace(/\.md$/, '')
    // Validate url is https://apply.workable.com/...
    try {
      const parsed = new URL(url)
      if (parsed.hostname !== 'apply.workable.com') continue
    } catch {
      continue
    }
    results.push({
      url,
      title: titleCol,
      company,
      location: locationCol || undefined,
    })
  }
  return results
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
