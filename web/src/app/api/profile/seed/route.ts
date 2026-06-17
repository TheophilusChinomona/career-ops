import { type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { seedFromRepo } from '@/services/importer'
import { db } from '@/lib/db'

// POST /api/profile/seed — seed Profile + CvMaster from repo files (config/profile.yml + cv.md)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    await seedFromRepo(userId)

    // Return the saved records so the client can repopulate the form
    const [profile, cvMaster] = await Promise.all([
      db.profile.findUnique({ where: { userId } }),
      db.cvMaster.findUnique({ where: { userId } }),
    ])

    return Response.json({ ok: true, profile, cvMaster })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ error: message }, { status: 500 })
  }
}
