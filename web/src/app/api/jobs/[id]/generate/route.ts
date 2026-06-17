import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { env } from '@/lib/env'
import { db } from '@/lib/db'
import { getProvider } from '@/llm/provider'
import { generateCv, generateCover } from '@/services/generate'
import type { CvContact } from '@/render/cv-html'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Next 16: params is async
    const { id } = await params

    // Resolve session
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Parse and validate body
    const { type } = (await request.json()) as { type: unknown }
    if (type !== 'cv' && type !== 'cover') {
      return Response.json({ error: 'type must be "cv" or "cover"' }, { status: 400 })
    }

    // Load profile, cvMaster, job scoped to user
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

    // Build contact from profile
    const contact: CvContact = {
      name: profile.fullName,
      email: profile.email,
      phone: profile.phone ?? undefined,
      location: profile.location ?? undefined,
      linkedin: profile.linkedin ?? undefined,
    }

    // Resolve provider (same pattern as evaluate route)
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

    let html: string
    let pdfPath: string
    let label: string

    if (type === 'cv') {
      const result = await generateCv({
        cvMaster,
        jobJD: job.rawJD ?? '',
        contact,
        provider,
        archetype: job.archetype ?? undefined,
        company: job.company,
      })
      html = result.html
      pdfPath = result.pdfPath
      label = `CV — ${job.company}`
    } else {
      // type === 'cover'
      // Build cvSummary from cvMaster
      type ExperienceItem = { role: string; company: string; bullets: string[] }
      const experience = (cvMaster.experience as ExperienceItem[]) ?? []
      const proofPoints = experience
        .slice(0, 3)
        .map((e) => `${e.role} @ ${e.company}: ${(e.bullets ?? []).slice(0, 2).join('; ')}`)
        .join('\n')
      const cvSummary = [cvMaster.summary, proofPoints].filter(Boolean).join('\n\n')

      const result = await generateCover({
        profile,
        cvSummary,
        job: { company: job.company, role: job.role, rawJD: job.rawJD },
        contact,
        provider,
      })
      html = result.html
      pdfPath = result.pdfPath
      label = `Cover Letter — ${job.company}`
    }

    // Persist Document row
    const doc = await db.document.create({
      data: {
        userId,
        jobId: id,
        type,
        label,
        html,
        pdfPath,
      },
    })

    return Response.json({
      documentId: doc.id,
      pdfUrl: `/api/documents/${doc.id}/pdf`,
    })
  } catch (err) {
    console.error('[generate] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
