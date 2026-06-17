import { describe, it, expect } from 'vitest'
import { parseProfileYaml, parseCvMarkdown, readRepoSources } from '../importer'

const yaml = `candidate:
  full_name: "Tinotenda Maramba"
  email: "t@example.com"
  location: "Zambia"
target_roles:
  primary: ["Junior Project Manager", "Project Coordinator"]
compensation:
  target_range: "R15,000/month"`

const md = `# Tinotenda Maramba
## Professional Summary
Ambitious PM student.
## Experience
### Residential Secretary — Student Union
**Cavendish University** · 2026 – Present
- Coordinate accommodation for 100+ students.
## Skills
**Tools:** Microsoft Office`

describe('importer', () => {
  it('parses profile yaml', () => {
    const p = parseProfileYaml(yaml)
    expect(p.fullName).toBe('Tinotenda Maramba')
    expect(p.targetRoles).toContain('Project Coordinator')
    expect(p.compTarget).toMatch(/15/)
  })
  it('parses cv markdown summary + experience', () => {
    const cv = parseCvMarkdown(md)
    expect(cv.summary).toMatch(/Ambitious/)
    expect(cv.experience[0].company).toMatch(/Cavendish/)
    expect(cv.experience[0].bullets[0]).toMatch(/100\+/)
  })
})

describe('extractCerts (unit)', () => {
  it('does not collect horizontal rule lines as cert entries', () => {
    const mdWithRule = `## Certifications

- Project Management Fundamentals
- Public Relations

---
`
    const cv = parseCvMarkdown(mdWithRule)
    // No horizontal-rule entries should appear
    expect(cv.certs).not.toContain('---')
    expect(cv.certs).not.toContain('***')
    expect(cv.certs).not.toContain('___')
    // Actual cert entries should be present
    expect(cv.certs).toContain('Project Management Fundamentals')
  })
})

describe('extractSkills (unit)', () => {
  it('keeps parenthetical comma lists intact when splitting skill items', () => {
    const mdWithParens = `## Skills

**Tools:** Microsoft Office (Word, Excel, PowerPoint)

**Core Strengths:** Communication · Teamwork · Problem-solving
`
    const cv = parseCvMarkdown(mdWithParens)
    const toolsGroup = cv.skills.find((g) => g.category === 'Tools')
    expect(toolsGroup).toBeDefined()
    // The whole "Microsoft Office (Word, Excel, PowerPoint)" must be a single item
    expect(toolsGroup?.items).toContain('Microsoft Office (Word, Excel, PowerPoint)')
    // Fragmented substrings must NOT appear as separate items
    expect(toolsGroup?.items).not.toContain('Microsoft Office (Word')
    expect(toolsGroup?.items.some((i) => i.trim() === 'Excel')).toBe(false)
    expect(toolsGroup?.items.some((i) => /^\s*PowerPoint\)/.test(i))).toBe(false)
  })

  it('requires a colon after the bold category marker (over-broad match guard)', () => {
    // A line with bold text but no colon (e.g. a heading-like bold) must be ignored
    const mdBoldNoColon = `## Skills

**Just bold text without colon**

**Real Category:** Item A · Item B
`
    const cv = parseCvMarkdown(mdBoldNoColon)
    // Only the colon-bearing line should produce a group
    expect(cv.skills.length).toBe(1)
    expect(cv.skills[0].category).toBe('Real Category')
  })
})

describe('readRepoSources (real files)', () => {
  it('reads and parses the real profile.yml and cv.md without DB', () => {
    const { profile, cv } = readRepoSources()
    // profile.yml assertions
    expect(profile.fullName).toBe('Tinotenda Maramba')
    expect(profile.email).toBe('tinotendamaramba26@gmail.com')
    expect(profile.targetRoles).toContain('Junior Project Manager')
    expect(profile.compTarget).toMatch(/15/)
    // cv.md assertions
    expect(cv.summary).toMatch(/Ambitious/)
    expect(cv.experience.length).toBeGreaterThan(0)
    expect(cv.experience[0].company).toMatch(/Cavendish/)
    expect(cv.education.length).toBeGreaterThan(0)
    expect(cv.certs.length).toBeGreaterThan(0)
    expect(cv.skills.length).toBeGreaterThan(0)
  })

  it('certs from real cv.md contain no horizontal-rule entries', () => {
    const { cv } = readRepoSources()
    // None of the cert entries may be a horizontal rule
    const hrPattern = /^[-*_]{3,}$/
    for (const cert of cv.certs) {
      expect(hrPattern.test(cert.trim())).toBe(false)
    }
    expect(cv.certs).not.toContain('---')
  })

  it('skill items from real cv.md do not contain fragments from parenthetical comma splits', () => {
    const { cv } = readRepoSources()
    const allItems = cv.skills.flatMap((g) => g.items)

    // If any skills line mentions Microsoft Office, the item must keep its closing paren
    // (i.e. no item ends mid-parenthetical like "Microsoft Office (Word")
    const msOfficeItems = allItems.filter((i) => i.includes('Microsoft Office'))
    for (const item of msOfficeItems) {
      // An item that starts with "Microsoft Office (" must close with ")"
      if (item.includes('Microsoft Office (')) {
        expect(item.endsWith(')')).toBe(true)
      }
    }

    // No skill item should be a bare "Excel" or "PowerPoint)" fragment
    expect(allItems.some((i) => i.trim() === 'Excel')).toBe(false)
    expect(allItems.some((i) => /^\s*PowerPoint\)/.test(i))).toBe(false)
  })
})
