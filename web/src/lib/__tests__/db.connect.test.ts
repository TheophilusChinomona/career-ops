import { describe, it, expect } from 'vitest'
import { db } from '../db'
// Integration test: requires a reachable Postgres/ParadeDB. Skipped unless
// DATABASE_URL is set so the default unit-test run stays green without a DB.
describe.skipIf(!process.env.DATABASE_URL)('db', () => {
  it('connects and runs a trivial query', async () => {
    const r = await db.$queryRawUnsafe<{ n: number }[]>('SELECT 1 as n')
    expect(r[0].n).toBe(1)
  })
})
