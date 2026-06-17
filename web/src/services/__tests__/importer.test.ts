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
})
