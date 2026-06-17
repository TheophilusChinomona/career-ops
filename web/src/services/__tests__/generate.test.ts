import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CvMaster } from '@/generated/prisma'
import type { LLMProvider } from '@/llm/types'
import type { TailoredCvOut } from '@/llm/schemas'
import type { CvContact } from '@/render/cv-html'

// Mock runValidated before importing
vi.mock('@/llm/run', () => ({
  runValidated: vi.fn(),
}))

// Mock renderPdf — NEVER launch a real browser in this test
vi.mock('@/render/pdf', () => ({
  renderPdf: vi.fn(),
}))

import { generateCv, generateCover } from '../generate'
import { runValidated } from '@/llm/run'
import { renderPdf } from '@/render/pdf'

const mockRunValidated = runValidated as ReturnType<typeof vi.fn>
const mockRenderPdf = renderPdf as ReturnType<typeof vi.fn>

// ---------- fixtures ----------

const fakeCvMaster: CvMaster = {
  id: 'cv-1',
  userId: 'user-1',
  summary: 'Full-stack developer with 5 years experience',
  experience: [
    { company: 'Acme', role: 'Engineer', period: '2022-2024', bullets: ['Built things'] },
  ],
  education: [{ title: 'BSc CS', org: 'UCT', period: '2018', desc: '' }],
  certs: ['AWS SA'],
  skills: [{ category: 'Languages', items: ['TypeScript', 'Python'] }],
}

const fakeTailoredCv: TailoredCvOut = {
  roleTag: 'Senior Full-Stack Engineer',
  summary: 'Experienced full-stack developer specialising in React and Node.js.',
  competencies: ['React', 'Node.js', 'TypeScript', 'System Design'],
  experience: [
    {
      company: 'Acme',
      role: 'Senior Engineer',
      period: '2022-2024',
      bullets: ['Built scalable APIs'],
    },
  ],
  education: [{ title: 'BSc CS', org: 'UCT', period: '2018' }],
  certs: ['AWS SA'],
  skills: [{ category: 'Languages', items: ['TypeScript', 'Python'] }],
}

const fakeContact: CvContact = {
  name: 'Tino Maramba',
  email: 'tino@example.com',
  phone: '+1234567890',
  location: 'Remote',
  linkedin: 'linkedin.com/in/tino',
}

const fakeProvider: LLMProvider = {
  complete: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRenderPdf.mockResolvedValue('/storage/pdfs/cv-tino-acme.pdf')
})

// ======= generateCv =======

describe('generateCv', () => {
  it('calls runValidated with TailoredCvSchema, renders HTML, renders PDF, returns { html, pdfPath, cv }', async () => {
    mockRunValidated.mockResolvedValue(fakeTailoredCv)

    const result = await generateCv({
      cvMaster: fakeCvMaster,
      jobJD: 'We need a full-stack developer.',
      contact: fakeContact,
      provider: fakeProvider,
    })

    // runValidated must be called once with the provider
    expect(mockRunValidated).toHaveBeenCalledOnce()
    const [calledProvider, , calledArgs] = mockRunValidated.mock.calls[0]
    expect(calledProvider).toBe(fakeProvider)
    expect(calledArgs.system).toBeTruthy()
    expect(calledArgs.prompt).toContain('full-stack developer')

    // renderPdf must be called (browser skipped — it's mocked)
    expect(mockRenderPdf).toHaveBeenCalledOnce()

    // returned html should contain rendered content
    expect(result.html).toContain('Tino Maramba')
    expect(result.html).toContain('Senior Full-Stack Engineer')

    // pdfPath is the mocked path
    expect(result.pdfPath).toBe('/storage/pdfs/cv-tino-acme.pdf')

    // cv is the parsed TailoredCvOut
    expect(result.cv).toEqual(fakeTailoredCv)
  })
})

// ======= generateCover =======

describe('generateCover', () => {
  it('calls provider.complete with cover prompt, renders HTML, renders PDF, returns { html, pdfPath, text }', async () => {
    const mockComplete = vi.fn().mockResolvedValue(
      'Dear Hiring Team,\n\nI am excited to apply for the Senior Engineer role at TechCo.\n\nKind regards,\nTino'
    )
    const coverProvider: LLMProvider = { complete: mockComplete }

    mockRenderPdf.mockResolvedValue('/storage/pdfs/cover-tino-techco.pdf')

    const fakeProfile = {
      id: 'profile-1',
      userId: 'user-1',
      fullName: 'Tino Maramba',
      email: 'tino@example.com',
      phone: null,
      location: 'Remote',
      linkedin: null,
      targetRoles: ['Senior Engineer'],
      compTarget: '$150k',
      narrative: 'Driven developer',
      llmProvider: null,
      model: null,
    }

    const result = await generateCover({
      profile: fakeProfile as import('@/generated/prisma').Profile,
      cvSummary: 'Strong CV with 5 years of experience.',
      job: { company: 'TechCo', role: 'Senior Engineer', rawJD: 'Looking for a senior engineer.' },
      contact: fakeContact,
      provider: coverProvider,
      date: '17 June 2026',
    })

    // provider.complete must be called with the cover prompt
    expect(mockComplete).toHaveBeenCalledOnce()
    const [promptArgs] = mockComplete.mock.calls[0]
    expect(promptArgs.system).toBeTruthy()
    expect(promptArgs.prompt).toContain('TechCo')

    // renderPdf called
    expect(mockRenderPdf).toHaveBeenCalledOnce()

    // returned html contains cover content
    expect(result.html).toContain('Tino Maramba')

    // pdfPath is the mocked path
    expect(result.pdfPath).toBe('/storage/pdfs/cover-tino-techco.pdf')

    // text is the raw cover letter body
    expect(result.text).toContain('TechCo')
  })
})
