import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { getProvider } from '@/llm/provider'
import { addJobFromUrl } from '@/services/import-url'

export async function POST(request: NextRequest) {
  try {
    // Resolve session via Better Auth server API
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Parse and validate the request body
    let body: { url?: string }
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const url = body?.url?.trim()
    if (!url) {
      return Response.json({ error: 'url is required' }, { status: 400 })
    }

    // Attempt to build LLM provider — optional; falls back to heuristic if no key
    let provider: ReturnType<typeof getProvider> | undefined
    try {
      const providerName = env.LLM_PROVIDER as 'claude' | 'openai' | 'gemini'
      provider = getProvider(
        providerName,
        {
          ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
          OPENAI_API_KEY: env.OPENAI_API_KEY,
          GEMINI_API_KEY: env.GEMINI_API_KEY,
        },
        env.LLM_MODEL,
      )
    } catch {
      // No valid LLM key configured — extraction will use heuristic fallback
      provider = undefined
    }

    // Scrape + extract + persist
    const { job, created } = await addJobFromUrl({
      userId,
      url,
      apiKey: env.FIRECRAWL_API_KEY ?? '',
      provider,
    })

    return Response.json({ jobId: job.id, created })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // User-facing errors that map to 400
    if (
      message.includes('URL must use http') ||
      message.includes('Invalid URL') ||
      message.startsWith('url is required')
    ) {
      return Response.json({ error: message }, { status: 400 })
    }

    // Empty/blocked scrape — 502 Bad Gateway (upstream failed)
    if (message.includes('Could not read the posting')) {
      return Response.json({ error: message }, { status: 502 })
    }

    console.error('[from-url] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
