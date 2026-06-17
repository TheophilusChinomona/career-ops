import { describe, it, expect } from 'vitest'
import { renderCvHtml } from '../cv-html'
import type { TailoredCvOut } from '@/llm/schemas'

const cv: TailoredCvOut = {
  roleTag: 'Senior Software Engineer',
  summary: 'A proven software engineer with deep TypeScript expertise.',
  competencies: ['TypeScript', 'Node.js', 'System Design', 'CI/CD'],
  experience: [
    {
      company: 'Acme Corp',
      role: 'Software Engineer',
      location: 'Remote',
      period: '2020 – Present',
      bullets: ['Built scalable APIs serving 10k rps', 'Led migration to microservices'],
    },
  ],
  education: [
    { title: 'BSc Computer Science', org: 'University of Cape Town', period: '2015 – 2019', desc: 'Graduated with distinction' },
  ],
  certs: ['AWS Certified Developer', 'Google Cloud Associate'],
  skills: [
    { category: 'Languages', items: ['TypeScript', 'Python'] },
    { category: 'Tools', items: ['Docker', 'Kubernetes'] },
  ],
}

const contact = {
  name: 'Jane Developer',
  email: 'jane@example.com',
  phone: '+27 82 123 4567',
  linkedin: 'linkedin.com/in/janedeveloper',
  location: 'Cape Town, South Africa',
}

describe('renderCvHtml', () => {
  it('includes the candidate name', () => {
    const html = renderCvHtml(cv, contact)
    expect(html).toContain('Jane Developer')
  })

  it('includes the roleTag', () => {
    const html = renderCvHtml(cv, contact)
    expect(html).toContain('Senior Software Engineer')
  })

  it('includes every competency', () => {
    const html = renderCvHtml(cv, contact)
    for (const comp of cv.competencies) {
      expect(html).toContain(comp)
    }
  })

  it('includes every company', () => {
    const html = renderCvHtml(cv, contact)
    for (const job of cv.experience) {
      expect(html).toContain(job.company)
    }
  })

  it('includes ./fonts/ font-face references', () => {
    const html = renderCvHtml(cv, contact)
    expect(html).toContain('./fonts/')
  })

  it('includes summary text', () => {
    const html = renderCvHtml(cv, contact)
    expect(html).toContain(cv.summary)
  })

  it('includes education', () => {
    const html = renderCvHtml(cv, contact)
    expect(html).toContain('BSc Computer Science')
    expect(html).toContain('University of Cape Town')
  })

  it('includes certifications', () => {
    const html = renderCvHtml(cv, contact)
    expect(html).toContain('AWS Certified Developer')
  })

  it('includes skills', () => {
    const html = renderCvHtml(cv, contact)
    expect(html).toContain('Languages')
    expect(html).toContain('TypeScript')
  })
})
