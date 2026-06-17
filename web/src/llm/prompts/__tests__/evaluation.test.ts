import { describe, it, expect } from 'vitest'
import { buildEvaluationPrompt } from '../evaluation'

describe('buildEvaluationPrompt', () => {
  it('includes profile, cv summary, JD, and asks for A-G JSON', () => {
    const { system, prompt } = buildEvaluationPrompt({
      profile: { fullName: 'T', targetRoles: ['Project Coordinator'], compTarget: 'R15000', location: 'Zambia', narrative: 'driven' } as any,
      cvSummary: 'PM student',
      jobJD: 'Coordinate projects...',
    })
    expect(system).toMatch(/A-G|A–G|six blocks/i)
    expect(prompt).toContain('Coordinate projects')
    expect(prompt).toContain('Project Coordinator')
    expect(prompt).toMatch(/JSON/i)
  })
})
