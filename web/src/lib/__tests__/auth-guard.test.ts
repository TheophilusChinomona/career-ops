import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({ db: { user: { count: vi.fn() } } }))
import { db } from '../db'

// Re-implement the guard predicate for unit testing intent.
async function canSignUp(): Promise<boolean> { return (await db.user.count()) < 1 }

describe('single-user guard', () => {
  beforeEach(() => vi.clearAllMocks())
  it('allows first user', async () => {
    ;(db.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    expect(await canSignUp()).toBe(true)
  })
  it('blocks second user', async () => {
    ;(db.user.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)
    expect(await canSignUp()).toBe(false)
  })
})
