import { scrapeJD } from '@/services/search'
import { db } from '@/lib/db'
import { runValidated } from '@/llm/run'
import { JobExtractSchema } from '@/llm/schemas'
import { buildJobExtractPrompt } from '@/llm/prompts/extract'
import type { LLMProvider } from '@/llm/types'
import type { Job } from '@/generated/prisma'

// ---------------------------------------------------------------------------
// Heuristic field extraction — used when no LLM provider is available or
// when the LLM leaves a field empty.
// ---------------------------------------------------------------------------

const SUFFIX = /[-_.](net|com|io|inc|llc|ltd|co|hq|labs|app|ai)$/i

function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function sldOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    const parts = host.split('.')
    const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
    return titleCase((sld ?? '').replace(SUFFIX, ''))
  } catch {
    return ''
  }
}

/**
 * Derive {role, company} from the page title via common separators.
 * Falls back to SLD of the URL for company when no separator is found.
 */
export function heuristicFields(
  pageTitle: string,
  url: string,
): { company: string; role: string; location?: string } {
  // Try common separators: ' - ', ' | ', ' at ', ' @ '
  const separators = [/ - /, / \| /, / at /i, / @ /]
  for (const sep of separators) {
    const parts = pageTitle.split(sep).map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      return { role: parts[0], company: parts[1] }
    }
  }

  // No separator found — use full title as role, derive company from URL host
  return { role: pageTitle.trim(), company: sldOf(url) }
}

// ---------------------------------------------------------------------------
// LLM-based extraction with heuristic fallback per-field
// ---------------------------------------------------------------------------

export async function extractJobFields(args: {
  markdown: string
  pageTitle: string
  url: string
  provider?: LLMProvider
}): Promise<{ company: string; role: string; location?: string }> {
  const { markdown, pageTitle, url, provider } = args
  const fallback = heuristicFields(pageTitle, url)

  if (!provider) {
    return fallback
  }

  try {
    const result = await runValidated(provider, JobExtractSchema, buildJobExtractPrompt({ markdown, pageTitle }))
    return {
      company: result.company || fallback.company,
      role: result.role || fallback.role,
      location: result.location || undefined,
    }
  } catch {
    // LLM failed — fall back to heuristic entirely
    return fallback
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function addJobFromUrl(args: {
  userId: string
  url: string
  apiKey: string
  provider?: LLMProvider
}): Promise<{ job: Job; created: boolean }> {
  const { userId, url, apiKey, provider } = args

  // Validate URL scheme
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('URL must use http or https')
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('URL must use')) throw e
    throw new Error(`Invalid URL: ${url}`)
  }

  // Scrape the posting
  const markdown = await scrapeJD(url, apiKey)
  if (!markdown || markdown.trim().length < 40) {
    throw new Error('Could not read the posting (the page may be blocked or empty)')
  }

  // Derive page title from first `# ` heading or first non-empty line
  const headingMatch = markdown.match(/^#\s+(.+)$/m)
  const pageTitle = headingMatch
    ? headingMatch[1].trim()
    : (markdown.split('\n').find((l) => l.trim()) ?? '').slice(0, 120)

  // Extract structured fields
  const f = await extractJobFields({ markdown, pageTitle, url, provider })

  // Dedupe check
  const existing = await db.job.findFirst({
    where: { userId, company: f.company, role: f.role },
  })
  if (existing) {
    return { job: existing, created: false }
  }

  // Create new job row
  const job = await db.job.create({
    data: {
      userId,
      company: f.company || 'Unknown',
      role: f.role || pageTitle.slice(0, 120),
      url,
      applyUrl: url,
      rawJD: markdown,
      location: f.location,
      source: 'url',
    },
  })

  return { job, created: true }
}
