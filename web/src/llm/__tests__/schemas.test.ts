import { describe, it, expect } from 'vitest'
import { EvaluationSchema, TailoredCvSchema } from '../schemas'

describe('EvaluationSchema', () => {
  it('parses a valid evaluation', () => {
    const v = EvaluationSchema.parse({
      score: 4.1, legitimacy: 'High Confidence', recommendApply: true,
      blocks: { A: 'match', B: 'fit', C: 'comp', D: 'culture', E: 'flags', F: 'global', G: 'legit' },
      notes: 'ok',
    })
    expect(v.score).toBe(4.1)
  })
  it('rejects score out of range', () => {
    expect(() => EvaluationSchema.parse({ score: 9, legitimacy: 'x', recommendApply: true, blocks: {} })).toThrow()
  })
})
