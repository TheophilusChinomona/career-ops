export type Candidate = { url: string; title: string; description?: string; company?: string; location?: string }

type RawResult = { url: string; title: string; description?: string }

// Job-board / SERP hosts that return aggregated *listing* pages, not individual
// postings. We drop these — they pollute the pipeline with "200+ jobs" index pages.
const AGGREGATOR_HOSTS = [
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'simplyhired.com', 'ziprecruiter.com',
  'monster.com', 'pnet.co.za', 'careerjet.com', 'jobgether.com', 'remoteleaf.com',
  'talent.com', 'jooble.org', 'careerbuilder.com', 'adzuna.com', 'neuvoo.com',
  'jobstreet.com', 'bebee.com', 'google.com', 'bing.com', 'facebook.com', 'reddit.com',
  // regional / niche boards that aggregate rather than host one posting
  'careerjunction.co.za', 'careers24.com', 'jobmail.co.za', 'remote4africa.com',
  'remoterocketship.com', // only individual /company/*/jobs/* pages are kept (see isIndividualPosting)
]

// Applicant-tracking-system hosts: a URL here is an individual posting. Keep these.
const ATS_HOSTS = [
  'lever.co', 'greenhouse.io', 'ashbyhq.com', 'workable.com', 'breezy.hr',
  'recruitee.com', 'teamtailor.com', 'smartrecruiters.com', 'jobvite.com',
  'myworkdayjobs.com', 'bamboohr.com', 'rippling.com', 'pinpointhq.com',
]

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' }
}
function pathOf(url: string): string {
  try { return new URL(url).pathname } catch { return '' }
}
const endsWithAny = (host: string, list: string[]) => list.some((h) => host === h || host.endsWith('.' + h) || host.endsWith(h))

// remoterocketship.com is an aggregator but exposes individual postings at
// /company/{slug}/jobs/{slug}. Treat only those as real postings.
function isIndividualPosting(url: string): boolean {
  const host = hostOf(url)
  if (endsWithAny(host, ATS_HOSTS)) return true
  if (host.endsWith('remoterocketship.com')) return /\/company\/[^/]+\/jobs\/[^/]+/.test(pathOf(url))
  return false
}

// Heuristic: does this look like a search/index/listing page rather than one job?
function looksLikeIndexPage(url: string, title: string): boolean {
  const t = (title || '').toLowerCase()
  if (/\b\d{2,}\+?\s+[\w\s-]*jobs\b/.test(t)) return true // "200+ ... jobs"
  if (/\bjobs?\s+in\b|\bjob\s+search\b|browse jobs|search results|latest .*jobs|hiring now|job listings|jobs,?\s+employment/.test(t)) return true
  const p = pathOf(url).toLowerCase()
  if (/(^|\/)(search|browse|listings?)(\/|$)/.test(p)) return true
  try { if (new URL(url).search) return /[?&](q|query|keywords?|search)=/.test(new URL(url).search) } catch { /* ignore */ }
  return false
}

const SUFFIX = /[-_.](net|com|io|inc|llc|ltd|co|hq|labs|app|ai)$/i
function titleCase(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function companyFrom(url: string, title?: string): string | undefined {
  const host = hostOf(url)
  const segs = pathOf(url).split('/').filter(Boolean)
  // ATS URL shapes: {company}.breezy.hr, jobs.lever.co/{company}, boards.greenhouse.io/{company}, apply.workable.com/{company}, {company}.recruitee.com
  let slug: string | undefined
  if (endsWithAny(host, ['lever.co', 'greenhouse.io', 'ashbyhq.com', 'workable.com', 'smartrecruiters.com', 'jobvite.com'])) slug = segs[0]
  else if (host.endsWith('breezy.hr') || host.endsWith('recruitee.com') || host.endsWith('teamtailor.com') || host.endsWith('bamboohr.com') || host.endsWith('myworkdayjobs.com')) slug = host.split('.')[0]
  else if (host.endsWith('remoterocketship.com')) { const i = segs.indexOf('company'); slug = i >= 0 ? segs[i + 1] : undefined }
  if (slug && !['jobs', 'apply', 'boards', 'search'].includes(slug.toLowerCase())) {
    const fromSlug = validName(titleCase(slug.replace(SUFFIX, '')))
    if (fromSlug) return fromSlug
  }
  // Fallback: parse "Role at Company" / "Role @ Company" / "Role | Company" from the title
  const fromTitle = validName((title || '').split(/ @ | \| | – | - | at /i)[1])
  if (fromTitle) return fromTitle
  // Last resort: second-level domain of a company careers host (careers.acme.com -> Acme)
  const parts = host.split('.')
  if (parts.length >= 2 && !endsWithAny(host, AGGREGATOR_HOSTS)) {
    const sld = parts[parts.length - 2]
    if (sld && !['greenhouse', 'lever', 'ashbyhq', 'workable', 'breezy', 'recruitee'].includes(sld)) return validName(titleCase(sld))
  }
  return undefined
}

/** Keep a result only if it's an individual posting and not an index/aggregator page. */
export function keepResult(r: RawResult): boolean {
  const host = hostOf(r.url)
  if (!host) return false
  if (looksLikeIndexPage(r.url, r.title)) return false // catches index/search pages even on ATS hosts
  if (isIndividualPosting(r.url)) return true
  if (endsWithAny(host, AGGREGATOR_HOSTS)) return false
  return true // unknown company careers page that doesn't look like an index
}

// Reject extraction results that are clearly not a company name.
const JUNK_NAME = /^(apply( now)?|search|jobs?|job|remote|hiring|now|view|see|home|careers?)$/i
function validName(name?: string): string | undefined {
  if (!name) return undefined
  const n = name.trim()
  if (!n || JUNK_NAME.test(n) || /\b(jobs?|apply now|search results)\b/i.test(n)) return undefined
  return n
}

export async function searchJobs(query: string, apiKey: string, limit = 10): Promise<Candidate[]> {
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY missing')
  // Over-fetch, then filter down to real postings.
  const fetchLimit = Math.min(Math.max(limit * 3, 20), 50)
  const res = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: fetchLimit }),
  })
  if (!res.ok) throw new Error(`Firecrawl search failed: ${res.status}`)
  const data = await res.json()
  const web: RawResult[] = data?.data?.web ?? []
  return web
    .filter(keepResult)
    .map((w) => ({ url: w.url, title: w.title, description: w.description, company: companyFrom(w.url, w.title) }))
    .slice(0, limit)
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
