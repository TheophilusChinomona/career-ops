import { describe, it, expect } from 'vitest'
import { db } from '../db'
describe('db', () => {
  it('connects and runs a trivial query', async () => {
    const r = await db.$queryRawUnsafe<{ n: number }[]>('SELECT 1 as n')
    expect(r[0].n).toBe(1)
  })
})
