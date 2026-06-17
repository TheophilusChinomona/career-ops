import { describe, it, expect, vi } from 'vitest'
import { runValidated } from '../run'
import { EvaluationSchema } from '../schemas'

const ok = JSON.stringify({ score: 4, legitimacy: 'High Confidence', recommendApply: true,
  blocks: { A:'a',B:'b',C:'c',D:'d',E:'e',F:'f',G:'g' } })

describe('runValidated', () => {
  it('parses valid JSON (even fenced)', async () => {
    const provider = { complete: vi.fn().mockResolvedValue('```json\n' + ok + '\n```') }
    const r = await runValidated(provider, EvaluationSchema, { system: 's', prompt: 'p' })
    expect(r.score).toBe(4)
  })
  it('retries once on invalid then succeeds', async () => {
    const provider = { complete: vi.fn().mockResolvedValueOnce('garbage').mockResolvedValueOnce(ok) }
    const r = await runValidated(provider, EvaluationSchema, { system: 's', prompt: 'p' })
    expect(provider.complete).toHaveBeenCalledTimes(2)
    expect(r.legitimacy).toBe('High Confidence')
  })
})
