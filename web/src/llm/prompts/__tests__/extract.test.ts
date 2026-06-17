import { describe, it, expect } from 'vitest'
import { buildJobExtractPrompt } from '../extract'

describe('buildJobExtractPrompt', () => {
  it('includes markdown content and page title in the prompt', () => {
    const markdown = 'We are hiring a Senior Engineer at Acme Corp in Remote...'
    const pageTitle = 'Senior Engineer - Acme Corp'
    const { system, prompt } = buildJobExtractPrompt({ markdown, pageTitle })

    expect(prompt).toContain(markdown)
    expect(prompt).toContain(pageTitle)
  })

  it('asks for JSON with company, role, location fields', () => {
    const { system, prompt } = buildJobExtractPrompt({ markdown: 'some jd', pageTitle: 'Job' })

    // System must instruct JSON extraction of the three fields
    expect(system).toMatch(/JSON/i)
    expect(system).toMatch(/company/i)
    expect(system).toMatch(/role/i)
    expect(system).toMatch(/location/i)

    // Prompt must also reference the expected schema
    expect(prompt).toMatch(/\{company.*role.*location\}/i)
  })

  it('truncates very long markdown to ~6000 chars', () => {
    const longMarkdown = 'x'.repeat(10000)
    const { prompt } = buildJobExtractPrompt({ markdown: longMarkdown, pageTitle: 'Job' })

    // The truncated content + surrounding text should be well under 10000 chars
    expect(prompt.length).toBeLessThan(7000)
    expect(prompt).toContain('[truncated]')
  })

  it('does not truncate markdown under 6000 chars', () => {
    const shortMarkdown = 'Short job description that fits easily'
    const { prompt } = buildJobExtractPrompt({ markdown: shortMarkdown, pageTitle: 'Job' })

    expect(prompt).toContain(shortMarkdown)
    expect(prompt).not.toContain('[truncated]')
  })
})
