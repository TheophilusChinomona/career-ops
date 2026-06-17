import { describe, it, expect } from 'vitest'
import { buildCoverLetterPrompt } from '../cover'

describe('buildCoverLetterPrompt', () => {
  it('includes company/role/JD, candidate narrative, anti-cliché rules, one-page limit, and returns plain text', () => {
    const profile = {
      fullName: 'Tinotenda Maramba',
      narrative: 'Project coordinator with supply-chain experience',
      targetRoles: ['Project Coordinator'],
    } as any
    const job = {
      company: 'RetailNext',
      roleTitle: 'Supply Chain Coordinator',
      jd: 'Manage logistics and supplier relationships...',
    }
    const cvSummary = 'Led procurement process for 3 facilities, reduced lead time by 20%.'

    const { system, prompt } = buildCoverLetterPrompt({ profile, cvSummary, job })

    // Prompt must include company name and role
    expect(prompt).toContain('RetailNext')
    expect(prompt).toContain('Supply Chain Coordinator')
    // Prompt must include the JD
    expect(prompt).toContain('logistics')
    // Prompt must include candidate narrative
    expect(prompt).toContain('Project coordinator')

    // System must ban specific cliché phrases
    expect(system).toMatch(/passionate about/i)
    expect(system).toMatch(/leveraged/i)
    expect(system).toMatch(/spearheaded/i)

    // System must enforce one-page limit
    expect(system).toMatch(/one page|1 page/i)

    // System must specify plain text output (no JSON)
    expect(system).toMatch(/plain text|no JSON|text only/i)
    // Verify there's no instruction to return JSON (cover output is plain text)
    expect(system).not.toMatch(/return\s+(?:only\s+)?json|as json/i)
  })
})
