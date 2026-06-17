import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Candidate } from '../search'

// Mock the db module BEFORE importing addCandidates
vi.mock('@/lib/db', () => ({
  db: {
    job: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

import { addCandidates } from '../jobs'
import { db } from '@/lib/db'

const mockDb = db as unknown as {
  job: {
    findMany: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('addCandidates', () => {
  it('inserts only new candidates (deduped on company+role)', async () => {
    // Existing job: "RetailNext" + "Project Coordinator"
    mockDb.job.findMany.mockResolvedValue([
      { company: 'RetailNext', role: 'Project Coordinator' },
    ])
    mockDb.job.createMany.mockResolvedValue({ count: 1 })

    const candidates: Candidate[] = [
      // duplicate — should be skipped
      { url: 'https://x.com/job/1', title: 'Project Coordinator @ RetailNext', company: 'RetailNext' },
      // new — should be inserted
      { url: 'https://x.com/job/2', title: 'Engineering Manager @ Acme', company: 'Acme' },
    ]

    const count = await addCandidates('user-1', candidates)

    expect(mockDb.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(mockDb.job.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ company: 'Acme', role: 'Engineering Manager', userId: 'user-1' }),
        ]),
      }),
    )
    // createMany was called with exactly 1 row
    expect(mockDb.job.createMany.mock.calls[0][0].data).toHaveLength(1)
    expect(count).toBe(1)
  })

  it('dedupes within the incoming batch (same company+role appears twice → only 1 row inserted)', async () => {
    // No existing jobs for this user
    mockDb.job.findMany.mockResolvedValue([])
    mockDb.job.createMany.mockResolvedValue({ count: 1 })

    const candidates: Candidate[] = [
      // First occurrence — should be kept
      { url: 'https://x.com/job/10', title: 'Software Engineer @ TechCo', company: 'TechCo' },
      // Duplicate within the same batch — should be dropped
      { url: 'https://x.com/job/11', title: 'Software Engineer @ TechCo', company: 'TechCo' },
    ]

    const count = await addCandidates('user-1', candidates)

    // Only 1 row should have been passed to createMany
    expect(mockDb.job.createMany.mock.calls[0][0].data).toHaveLength(1)
    expect(count).toBe(1)
  })

  it('returns 0 when all candidates already exist', async () => {
    mockDb.job.findMany.mockResolvedValue([
      { company: 'RetailNext', role: 'Project Coordinator' },
    ])
    mockDb.job.createMany.mockResolvedValue({ count: 0 })

    const candidates: Candidate[] = [
      { url: 'https://x.com/job/1', title: 'Project Coordinator @ RetailNext', company: 'RetailNext' },
    ]

    const count = await addCandidates('user-1', candidates)
    expect(count).toBe(0)
    expect(mockDb.job.createMany).not.toHaveBeenCalled()
  })

  it('uses custom source param when provided', async () => {
    mockDb.job.findMany.mockResolvedValue([])
    mockDb.job.createMany.mockResolvedValue({ count: 1 })

    const candidates: Candidate[] = [
      { url: 'https://x.com/job/99', title: 'Operations Manager @ ScanCo', company: 'ScanCo' },
    ]

    await addCandidates('user-1', candidates, 'scan')

    expect(mockDb.job.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ source: 'scan' }),
        ]),
      }),
    )
  })

  it('maps candidate location to job location', async () => {
    mockDb.job.findMany.mockResolvedValue([])
    mockDb.job.createMany.mockResolvedValue({ count: 1 })

    const candidates: Candidate[] = [
      { url: 'https://x.com/job/100', title: 'Project Manager @ RemoteCo', company: 'RemoteCo', location: 'Remote' },
    ]

    await addCandidates('user-1', candidates)

    expect(mockDb.job.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ location: 'Remote' }),
        ]),
      }),
    )
  })
})
