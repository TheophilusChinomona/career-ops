import yaml from 'js-yaml'
import fs from 'node:fs'
import path from 'node:path'
import type { Prisma } from '../generated/prisma'

// Convenience alias: JSON field values accepted by Prisma
type JsonInput = Prisma.InputJsonValue

// ---------------------------------------------------------------------------
// Types matching the Prisma Profile / CvMaster shapes (writable fields only)
// ---------------------------------------------------------------------------

export interface ParsedProfile {
  fullName: string
  email: string
  phone?: string
  location?: string
  linkedin?: string
  targetRoles: string[]
  compTarget?: string
}

export interface ExperienceItem {
  company: string
  role: string
  period: string
  location?: string
  bullets: string[]
}

export interface EducationItem {
  title: string
  org: string
  period: string
  desc?: string
}

export interface SkillGroup {
  category: string
  items: string[]
}

export interface ParsedCv {
  summary: string
  experience: ExperienceItem[]
  education: EducationItem[]
  certs: string[]
  skills: SkillGroup[]
}

// ---------------------------------------------------------------------------
// parseProfileYaml
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileDoc = Record<string, any>

export function parseProfileYaml(yamlStr: string): ParsedProfile {
  const doc = yaml.load(yamlStr) as ProfileDoc

  const candidate = doc?.candidate ?? {}
  const targetRolesPrimary: string[] = doc?.target_roles?.primary ?? []
  const comp = doc?.compensation ?? {}

  return {
    fullName: candidate.full_name ?? '',
    email: candidate.email ?? '',
    phone: candidate.phone ?? undefined,
    location: candidate.location ?? undefined,
    linkedin: candidate.linkedin ?? undefined,
    targetRoles: Array.isArray(targetRolesPrimary) ? targetRolesPrimary : [],
    compTarget: comp.target_range ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// parseCvMarkdown
// ---------------------------------------------------------------------------

export function parseCvMarkdown(md: string): ParsedCv {
  // Split into sections by ## headings
  const sections = splitBySections(md)

  const summary = extractSummary(sections)
  const experience = extractExperience(sections)
  const education = extractEducation(sections)
  const certs = extractCerts(sections)
  const skills = extractSkills(sections)

  return { summary, experience, education, certs, skills }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Split markdown into a map of section heading → section body text.
 *  The key is the normalised heading text (lowercased). */
function splitBySections(md: string): Map<string, string> {
  const result = new Map<string, string>()
  // Split on ## lines (but not ### lines)
  const parts = md.split(/\n(?=## )/g)

  for (const part of parts) {
    const lines = part.split('\n')
    const heading = lines[0]
    if (heading.startsWith('## ')) {
      const key = heading.replace(/^## /, '').trim().toLowerCase()
      const body = lines.slice(1).join('\n').trim()
      result.set(key, body)
    }
    // Everything before the first ## is preamble (name / header) — ignored
  }
  return result
}

function findSection(sections: Map<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = sections.get(k)
    if (found !== undefined) return found
  }
  // Fuzzy: partial match
  for (const [key, val] of sections) {
    for (const k of keys) {
      if (key.includes(k)) return val
    }
  }
  return ''
}

function extractSummary(sections: Map<string, string>): string {
  return findSection(sections, 'professional summary', 'summary').trim()
}

function extractExperience(sections: Map<string, string>): ExperienceItem[] {
  const body = findSection(sections, 'experience')
  if (!body) return []

  // Split on ### headings
  const subSections = body.split(/\n(?=### )/g)
  const items: ExperienceItem[] = []

  for (const sub of subSections) {
    if (!sub.trim()) continue
    const lines = sub.split('\n')
    const roleLine = lines[0].startsWith('### ') ? lines[0].replace(/^### /, '').trim() : ''
    if (!roleLine) continue

    // Find the **Company** · period line (or similar bold/plain company line)
    let company = ''
    let period = ''
    let location: string | undefined

    // Bullets
    const bullets: string[] = []

    for (const line of lines.slice(1)) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('- ')) {
        bullets.push(trimmed.slice(2).trim())
        continue
      }

      // Company·period line: **Company Name** · period  or  Company Name · period
      if (trimmed.includes('·') || trimmed.includes('•')) {
        const [compPart, ...rest] = trimmed.split(/\s*[·•]\s*/)
        company = compPart.replace(/\*\*/g, '').trim()
        period = rest.join(' · ').trim()
        // If company contains a comma followed by location (e.g., "Company, Zambia"), split it
        if (company.includes(',')) {
          const [c, loc] = company.split(',', 2)
          company = c.trim()
          location = loc.trim()
        }
        continue
      }
    }

    items.push({ company, role: roleLine, period, location, bullets })
  }

  return items
}

function extractEducation(sections: Map<string, string>): EducationItem[] {
  const body = findSection(sections, 'education')
  if (!body) return []

  const subSections = body.split(/\n(?=### )/g)
  const items: EducationItem[] = []

  for (const sub of subSections) {
    if (!sub.trim()) continue
    const lines = sub.split('\n')
    const titleLine = lines[0].startsWith('### ') ? lines[0].replace(/^### /, '').trim() : ''
    if (!titleLine) continue

    let org = ''
    let period = ''
    const descLines: string[] = []

    for (const line of lines.slice(1)) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('- ')) {
        descLines.push(trimmed.slice(2).trim())
        continue
      }

      if (trimmed.includes('·') || trimmed.includes('•')) {
        const [orgPart, ...rest] = trimmed.split(/\s*[·•]\s*/)
        org = orgPart.replace(/\*\*/g, '').trim()
        period = rest.join(' · ').trim()
        continue
      }
    }

    items.push({ title: titleLine, org, period, desc: descLines.join(' ') || undefined })
  }

  return items
}

function extractCerts(sections: Map<string, string>): string[] {
  const body = findSection(sections, 'certifications', 'certs', 'certificates')
  if (!body) return []

  const certs: string[] = []
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      certs.push(trimmed.slice(2).trim())
    } else if (trimmed && !trimmed.startsWith('#')) {
      certs.push(trimmed)
    }
  }
  return certs.filter(Boolean)
}

function extractSkills(sections: Map<string, string>): SkillGroup[] {
  const body = findSection(sections, 'skills')
  if (!body) return []

  const groups: SkillGroup[] = []

  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Pattern: **Category:** items  or  **Category:** items
    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*[:\s]+(.+)$/)
    if (boldMatch) {
      const category = boldMatch[1].replace(/:$/, '').trim()
      const items = boldMatch[2].split(/[·•,]/).map((s) => s.trim()).filter(Boolean)
      groups.push({ category, items })
      continue
    }

    // Plain "Category: items" line
    const plainMatch = trimmed.match(/^([^:]+):\s+(.+)$/)
    if (plainMatch) {
      const category = plainMatch[1].trim()
      const items = plainMatch[2].split(/[·•,]/).map((s) => s.trim()).filter(Boolean)
      groups.push({ category, items })
    }
  }

  return groups
}

// ---------------------------------------------------------------------------
// readRepoSources — read and parse the real files without hitting the DB
// (unit-testable; no Prisma import here)
// ---------------------------------------------------------------------------

export function readRepoSources(): { profile: ParsedProfile; cv: ParsedCv } {
  // web/ is one level below the career-ops root
  const root = path.resolve(__dirname, '../../..')
  const profilePath = path.join(root, 'config', 'profile.yml')
  const cvPath = path.join(root, 'cv.md')

  const profileYaml = fs.readFileSync(profilePath, 'utf-8')
  const cvMd = fs.readFileSync(cvPath, 'utf-8')

  return {
    profile: parseProfileYaml(profileYaml),
    cv: parseCvMarkdown(cvMd),
  }
}

// ---------------------------------------------------------------------------
// seedFromRepo — upsert Profile + CvMaster for a user.
// Kept separate so unit tests can test readRepoSources() without DB.
// ---------------------------------------------------------------------------

export async function seedFromRepo(userId: string): Promise<void> {
  // Lazy-import db so unit tests that never call this function don't need a
  // live Postgres connection.
  const { db } = await import('@/lib/db')
  const { profile, cv } = readRepoSources()

  await db.profile.upsert({
    where: { userId },
    create: {
      userId,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin: profile.linkedin,
      targetRoles: profile.targetRoles,
      compTarget: profile.compTarget,
    },
    update: {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin: profile.linkedin,
      targetRoles: profile.targetRoles,
      compTarget: profile.compTarget,
    },
  })

  await db.cvMaster.upsert({
    where: { userId },
    create: {
      userId,
      summary: cv.summary,
      experience: cv.experience as unknown as JsonInput,
      education: cv.education as unknown as JsonInput,
      certs: cv.certs as unknown as JsonInput,
      skills: cv.skills as unknown as JsonInput,
    },
    update: {
      summary: cv.summary,
      experience: cv.experience as unknown as JsonInput,
      education: cv.education as unknown as JsonInput,
      certs: cv.certs as unknown as JsonInput,
      skills: cv.skills as unknown as JsonInput,
    },
  })
}
