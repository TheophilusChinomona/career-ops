import path from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import { auth } from '@/lib/auth'
import { scanPortals } from '@/services/scan'
import { addCandidates, listJobs } from '@/services/jobs'
import type { ScanEntry, TitleFilter } from '@/services/scan'

type PortalsConfigRaw = {
  tracked_companies?: Array<{ name: string; careers_url: string; enabled?: boolean }>
  title_filter?: TitleFilter
}

export async function POST(request: Request) {
  try {
    const { headers } = request
    const session = await auth.api.getSession({ headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const portalsPath = path.join(process.cwd(), 'config', 'portals.yml')
    const raw = fs.readFileSync(portalsPath, 'utf-8')
    const config = yaml.load(raw) as PortalsConfigRaw

    const entries: ScanEntry[] = (config.tracked_companies ?? []).map((c) => ({
      name: c.name,
      careersUrl: c.careers_url,
      enabled: c.enabled,
    }))
    const titleFilter = config.title_filter

    const candidates = await scanPortals(entries, { titleFilter })
    const added = await addCandidates(session.user.id, candidates, 'scan')
    const jobs = await listJobs(session.user.id)

    return Response.json({ scanned: entries.length, found: candidates.length, added, jobs })
  } catch (err) {
    console.error('[scan] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
