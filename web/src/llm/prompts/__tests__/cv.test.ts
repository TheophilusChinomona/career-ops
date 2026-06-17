import { describe, it, expect } from 'vitest'
import { buildTailoredCvPrompt } from '../cv'

describe('buildTailoredCvPrompt', () => {
  it('includes master CV JSON, JD, no-invent rule, and TailoredCvSchema shape', () => {
    const cvMaster = {
      id: 'cv1',
      profileId: 'p1',
      rawMarkdown: '# My CV\n## Experience\nDid things',
      updatedAt: new Date('2024-01-01'),
    } as any
    const jobJD = 'We need a project coordinator...'
    const { system, prompt } = buildTailoredCvPrompt({
      cvMaster,
      jobJD,
      archetype: 'AI Transformation',
    })

    // Prompt must contain the master CV serialized as JSON
    expect(prompt).toContain('"rawMarkdown"')
    // Prompt must contain the JD
    expect(prompt).toContain('project coordinator')
    // System must include the no-invent rule
    expect(system).toMatch(/only.*reword.*real experience|never invent/i)
    // System must request TailoredCvSchema-shaped JSON output
    expect(system).toMatch(/roleTag|TailoredCv/i)
    expect(system).toMatch(/competencies/i)
    expect(system).toMatch(/experience/i)
    expect(system).toMatch(/education/i)
    expect(system).toMatch(/certs/i)
    expect(system).toMatch(/skills/i)
  })
})
