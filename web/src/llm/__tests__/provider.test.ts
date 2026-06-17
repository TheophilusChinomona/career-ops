import { describe, it, expect } from 'vitest'
import { getProvider } from '../provider'

describe('getProvider', () => {
  it('returns a provider for claude', () => {
    const p = getProvider('claude', { ANTHROPIC_API_KEY: 'x' })
    expect(typeof p.complete).toBe('function')
  })
  it('throws when key missing', () => {
    expect(() => getProvider('openai', {})).toThrow(/OPENAI_API_KEY/)
  })
})
