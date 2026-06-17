import { describe, it, expect } from 'vitest'
import { renderCoverHtml } from '../cover-html'

const contact = {
  name: 'Jane Developer',
  email: 'jane@example.com',
  phone: '+27 82 123 4567',
  linkedin: 'linkedin.com/in/janedeveloper',
  location: 'Cape Town, South Africa',
  roleTag: 'Software Engineer',
}

const recipient = {
  company: 'Acme Corp',
  hiringTeam: 'Hiring Team — Backend Engineer',
}

const date = '17 June 2026'

const body = `I am applying for the Backend Engineer role at Acme Corp.

I bring five years of TypeScript and Node.js experience, having built scalable APIs serving millions of requests.

I would love to discuss this opportunity further. Thank you for your consideration.`

describe('renderCoverHtml', () => {
  it('includes the recipient company', () => {
    const html = renderCoverHtml({ contact, recipient, date, body })
    expect(html).toContain('Acme Corp')
  })

  it('includes the date', () => {
    const html = renderCoverHtml({ contact, recipient, date, body })
    expect(html).toContain('17 June 2026')
  })

  it('splits body on blank lines into paragraphs', () => {
    const html = renderCoverHtml({ contact, recipient, date, body })
    const paragraphs = body.split(/\n\n+/)
    for (const para of paragraphs) {
      // Each paragraph should appear in the HTML
      expect(html).toContain(para.trim())
    }
    // Should have multiple <p> tags
    const pCount = (html.match(/<p>/g) || []).length
    expect(pCount).toBeGreaterThanOrEqual(paragraphs.length)
  })

  it('includes the candidate name', () => {
    const html = renderCoverHtml({ contact, recipient, date, body })
    expect(html).toContain('Jane Developer')
  })

  it('includes ./fonts/ font-face references', () => {
    const html = renderCoverHtml({ contact, recipient, date, body })
    expect(html).toContain('./fonts/')
  })

  it('includes the hiring team label', () => {
    const html = renderCoverHtml({ contact, recipient, date, body })
    expect(html).toContain('Backend Engineer')
  })
})
