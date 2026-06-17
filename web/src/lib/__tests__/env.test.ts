import { describe, it, expect } from 'vitest'
import { parseEnv } from '../env'

describe('parseEnv', () => {
  it('requires DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/)
  })
  it('defaults LLM_PROVIDER to claude', () => {
    const e = parseEnv({ DATABASE_URL: 'postgres://x', BETTER_AUTH_SECRET: 's', APP_ENCRYPTION_KEY: 'k'.repeat(32) })
    expect(e.LLM_PROVIDER).toBe('claude')
  })
})
