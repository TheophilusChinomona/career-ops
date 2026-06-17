import { db } from '@/lib/db'
import type { Candidate } from './search'
import type { JobStatus } from '../generated/prisma'

/** Extract the role portion from a job title string like "Role @ Company" */
function extractRole(title: string): string {
  // Handle patterns: "Role @ Company", "Role | Company", "Role at Company"
  const parts = title.split(/ @ | \| | at /)
  const parsed = (parts[0] ?? '').trim()
  // Fall back to the full title if parsing yields an empty string
  return parsed || title.trim()
}

/** Derive company from candidate (falls back to extracting from title) */
function extractCompany(candidate: Candidate): string {
  if (candidate.company) return candidate.company
  const parts = candidate.title.split(/ @ | \| | at /)
  return (parts[1] ?? '').trim() || 'Unknown'
}

/**
 * Insert new candidates for a user, deduplicating on (userId, company, role).
 * Returns the number of new rows inserted.
 */
export async function addCandidates(userId: string, candidates: Candidate[]): Promise<number> {
  if (candidates.length === 0) return 0

  // Fetch existing (company, role) pairs for this user
  const existing = await db.job.findMany({
    where: { userId },
    select: { company: true, role: true },
  })

  const existingSet = new Set(existing.map((j) => `${j.company}::${j.role}`))

  const mapped = candidates.map((c) => ({
    userId,
    company: extractCompany(c),
    role: extractRole(c.title),
    url: c.url,
    source: 'firecrawl',
  }))

  // Filter out rows that already exist in the DB
  const filtered = mapped.filter((r) => !existingSet.has(`${r.company}::${r.role}`))

  // Dedupe within the batch itself (keep first occurrence of each company::role)
  const seenInBatch = new Set<string>()
  const newRows = filtered.filter((r) => {
    const key = `${r.company}::${r.role}`
    if (seenInBatch.has(key)) return false
    seenInBatch.add(key)
    return true
  })

  if (newRows.length === 0) return 0

  await db.job.createMany({ data: newRows, skipDuplicates: true })
  return newRows.length
}

export async function listJobs(userId: string) {
  return db.job.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getJob(userId: string, id: string) {
  return db.job.findFirst({ where: { id, userId } })
}

export async function setStatus(userId: string, id: string, status: JobStatus) {
  return db.job.updateMany({ where: { id, userId }, data: { status } })
}
