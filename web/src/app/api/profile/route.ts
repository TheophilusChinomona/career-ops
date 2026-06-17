import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import type { Prisma } from '@/generated/prisma'

type JsonInput = Prisma.InputJsonValue

// POST /api/profile — upsert Profile + CvMaster for the authenticated user
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await request.json() as Record<string, any>

    // Minimal validation
    if (!body.fullName || typeof body.fullName !== 'string') {
      return Response.json({ error: 'fullName is required' }, { status: 400 })
    }
    if (!body.email || typeof body.email !== 'string') {
      return Response.json({ error: 'email is required' }, { status: 400 })
    }

    // Coerce targetRoles to string[]
    const targetRoles: string[] = Array.isArray(body.targetRoles)
      ? body.targetRoles.map(String)
      : typeof body.targetRoles === 'string'
      ? body.targetRoles.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

    // Upsert Profile
    const profile = await db.profile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: body.fullName,
        email: body.email,
        phone: body.phone ?? null,
        location: body.location ?? null,
        linkedin: body.linkedin ?? null,
        targetRoles,
        compTarget: body.compTarget ?? null,
        narrative: body.narrative ?? null,
        llmProvider: body.llmProvider ?? null,
        model: body.model ?? null,
      },
      update: {
        fullName: body.fullName,
        email: body.email,
        phone: body.phone ?? null,
        location: body.location ?? null,
        linkedin: body.linkedin ?? null,
        targetRoles,
        compTarget: body.compTarget ?? null,
        narrative: body.narrative ?? null,
        llmProvider: body.llmProvider ?? null,
        model: body.model ?? null,
      },
    })

    // Upsert CvMaster (only if CV fields are provided)
    let cvMaster = null
    if (body.summary !== undefined) {
      const experience = Array.isArray(body.experience) ? body.experience : []
      const education = Array.isArray(body.education) ? body.education : []
      const certs = Array.isArray(body.certs) ? body.certs : []
      const skills = Array.isArray(body.skills) ? body.skills : []

      cvMaster = await db.cvMaster.upsert({
        where: { userId },
        create: {
          userId,
          summary: body.summary ?? '',
          experience: experience as unknown as JsonInput,
          education: education as unknown as JsonInput,
          certs: certs as unknown as JsonInput,
          skills: skills as unknown as JsonInput,
        },
        update: {
          summary: body.summary ?? '',
          experience: experience as unknown as JsonInput,
          education: education as unknown as JsonInput,
          certs: certs as unknown as JsonInput,
          skills: skills as unknown as JsonInput,
        },
      })
    }

    return Response.json({ profile, cvMaster })
  } catch (err) {
    console.error('[profile] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
