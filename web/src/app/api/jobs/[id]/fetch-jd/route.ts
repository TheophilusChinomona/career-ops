import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { db } from '@/lib/db'
import { scrapeJD } from '@/services/search'

// Fetch + persist the job description by scraping the posting URL. Lets the user
// see the JD without spending a full LLM Evaluate (which also scrapes it).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await db.job.findFirst({ where: { id, userId: session.user.id } })
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }
    if (!job.url || /^local:/.test(job.url)) {
      return Response.json({ error: 'This job has no scrapable posting URL' }, { status: 400 })
    }

    const rawJD = await scrapeJD(job.url, env.FIRECRAWL_API_KEY ?? '')
    if (!rawJD.trim()) {
      return Response.json(
        { error: 'Could not read the posting (it may be blocked or empty)' },
        { status: 502 },
      )
    }
    await db.job.update({ where: { id }, data: { rawJD } })
    return Response.json({ rawJD })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Firecrawl/scrape upstream failure → 502
    if (message.includes('Firecrawl') || message.includes('scrape')) {
      console.error('[fetch-jd] scrape error', err)
      return Response.json({ error: 'Could not read the posting (it may be blocked or empty)' }, { status: 502 })
    }
    console.error('[fetch-jd] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
