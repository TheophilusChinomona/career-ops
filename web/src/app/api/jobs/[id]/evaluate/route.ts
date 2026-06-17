import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { db } from '@/lib/db'
import { getProvider } from '@/llm/provider'
import { scrapeJD } from '@/services/search'
import { evaluateJob } from '@/services/evaluate'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Next 16: params is async
    const { id } = await params

    // Resolve session via Better Auth server API (same pattern as search route)
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Load Profile, CvMaster, Job scoped to user
    const profile = await db.profile.findUnique({ where: { userId } })
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 })
    }

    const cvMaster = await db.cvMaster.findUnique({ where: { userId } })
    if (!cvMaster) {
      return Response.json({ error: 'CV not found' }, { status: 404 })
    }

    const job = await db.job.findFirst({ where: { id, userId } })
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    // Scrape JD if rawJD is empty/null
    let jobJD = job.rawJD ?? ''
    if (!jobJD.trim()) {
      jobJD = await scrapeJD(job.url, env.FIRECRAWL_API_KEY ?? '')
      await db.job.update({ where: { id }, data: { rawJD: jobJD } })
    }

    // Build cvSummary from CvMaster
    type ExperienceItem = { role: string; company: string; bullets: string[] }
    const experience = (cvMaster.experience as ExperienceItem[]) ?? []
    const proofPoints = experience
      .slice(0, 3)
      .map((e) => `${e.role} @ ${e.company}: ${(e.bullets ?? []).slice(0, 2).join('; ')}`)
      .join('\n')
    const cvSummary = [cvMaster.summary, proofPoints].filter(Boolean).join('\n\n')

    // Resolve provider
    const providerName = (profile.llmProvider ?? env.LLM_PROVIDER) as 'claude' | 'openai' | 'gemini'
    const provider = getProvider(
      providerName,
      {
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
        GEMINI_API_KEY: env.GEMINI_API_KEY,
      },
      profile.model ?? env.LLM_MODEL,
    )

    // Run evaluation
    const evaluation = await evaluateJob({ profile, cvSummary, jobJD, provider })

    // Upsert Evaluation row (keyed on jobId)
    const evalRow = await db.evaluation.upsert({
      where: { jobId: id },
      create: {
        jobId: id,
        score: evaluation.score,
        blocks: evaluation.blocks,
        legitimacy: evaluation.legitimacy,
        recommendApply: evaluation.recommendApply,
        notes: evaluation.notes ?? null,
      },
      update: {
        score: evaluation.score,
        blocks: evaluation.blocks,
        legitimacy: evaluation.legitimacy,
        recommendApply: evaluation.recommendApply,
        notes: evaluation.notes ?? null,
      },
    })

    // Update job score and status
    await db.job.update({
      where: { id },
      data: { score: evaluation.score, status: 'Evaluated' },
    })

    return Response.json(evalRow)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ error: message }, { status: 500 })
  }
}
