import type { CvMaster, Profile } from '@/generated/prisma'
import type { LLMProvider } from '@/llm/types'
import { runValidated } from '@/llm/run'
import { TailoredCvSchema, type TailoredCvOut } from '@/llm/schemas'
import { buildTailoredCvPrompt } from '@/llm/prompts/cv'
import { buildCoverLetterPrompt } from '@/llm/prompts/cover'
import { renderCvHtml, type CvContact } from '@/render/cv-html'
import { renderCoverHtml, type CoverContact, type CoverRecipient } from '@/render/cover-html'
import { renderPdf } from '@/render/pdf'

// ---- types ----

export interface GenerateCvInput {
  cvMaster: CvMaster
  jobJD: string
  contact: CvContact
  provider: LLMProvider
  archetype?: string
}

export interface GenerateCvResult {
  html: string
  pdfPath: string
  cv: TailoredCvOut
}

export interface JobRef {
  company: string
  role: string
  rawJD?: string | null
}

export interface GenerateCoverInput {
  profile: Profile
  cvSummary: string
  job: JobRef
  contact: CvContact
  provider: LLMProvider
  recipient?: CoverRecipient
  date?: string
}

export interface GenerateCoverResult {
  html: string
  pdfPath: string
  text: string
}

// ---- helpers ----

/** Derive a filesystem-safe slug from contact name + company or job context */
function makeSlug(parts: string[]): string {
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// ---- generateCv ----

export async function generateCv({
  cvMaster,
  jobJD,
  contact,
  provider,
  archetype = 'general',
}: GenerateCvInput): Promise<GenerateCvResult> {
  // 1. Build tailored CV via LLM
  const cv = await runValidated(
    provider,
    TailoredCvSchema,
    buildTailoredCvPrompt({ cvMaster, jobJD, archetype }),
  )

  // 2. Render to HTML
  const html = renderCvHtml(cv, contact)

  // 3. Render to PDF (slug derived from contact name)
  const slug = makeSlug([contact.name])
  const pdfPath = await renderPdf(html, `cv-${slug}`)

  return { html, pdfPath, cv }
}

// ---- generateCover ----

export async function generateCover({
  profile,
  cvSummary,
  job,
  contact,
  provider,
  recipient,
  date,
}: GenerateCoverInput): Promise<GenerateCoverResult> {
  // Map Prisma Job fields → cover prompt's local Job interface
  const promptArgs = buildCoverLetterPrompt({
    profile,
    cvSummary,
    job: {
      company: job.company,
      roleTitle: job.role,    // Prisma uses `role`, prompt expects `roleTitle`
      jd: job.rawJD ?? '',    // Prisma uses `rawJD`, prompt expects `jd`
    },
  })

  // 1. Generate cover letter as plain text
  const text = await provider.complete(promptArgs)

  // 2. Build recipient (fall back to job.company)
  const resolvedRecipient: CoverRecipient = recipient ?? { company: job.company }

  // 3. Build cover contact (CoverContact shape is a subset of CvContact)
  const coverContact: CoverContact = {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    linkedin: contact.linkedin,
    location: contact.location,
  }

  // 4. Render to HTML
  const resolvedDate = date ?? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const html = renderCoverHtml({
    contact: coverContact,
    recipient: resolvedRecipient,
    date: resolvedDate,
    body: text,
  })

  // 5. Render to PDF
  const slug = makeSlug([contact.name, job.company])
  const pdfPath = await renderPdf(html, `cover-${slug}`)

  return { html, pdfPath, text }
}
