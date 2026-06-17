import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { JobStatus } from '@/generated/prisma'
import { setStatus, getJob } from '@/services/jobs'

// Derive the canonical set from the Prisma enum object
const VALID_STATUSES = new Set<string>(Object.values(JobStatus))

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Next 16: params is async
    const { id } = await params

    // Resolve session via Better Auth server API
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const body = await request.json() as { status?: string }
    const { status } = body

    if (!status || !VALID_STATUSES.has(status)) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` },
        { status: 400 },
      )
    }

    await setStatus(userId, id, status as import('@/generated/prisma').JobStatus)

    // Fetch the updated job to return it
    const updated = await getJob(userId, id)
    if (!updated) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    return Response.json(updated)
  } catch (err) {
    console.error('[status] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
