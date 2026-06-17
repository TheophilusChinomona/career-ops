import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { searchJobs } from '@/services/search'
import { addCandidates, listJobs } from '@/services/jobs'

export async function POST(request: NextRequest) {
  try {
    // Resolve session via Better Auth server API: auth.api.getSession({ headers })
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { query?: string }
    const { query } = body
    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query is required' }, { status: 400 })
    }

    const apiKey = env.FIRECRAWL_API_KEY ?? ''
    const candidates = await searchJobs(query, apiKey)
    const added = await addCandidates(session.user.id, candidates)
    const jobs = await listJobs(session.user.id)

    return Response.json({ added, jobs })
  } catch (err) {
    console.error('[search] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
