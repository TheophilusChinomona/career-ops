import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { renderPdf } from '../pdf'

// Requires a real Chromium browser. Guarded by RUN_PDF_TESTS env flag so the
// default `npx vitest run` suite stays fast and green without a browser.
// Enable with: RUN_PDF_TESTS=1 npx vitest run pdf
describe.skipIf(!process.env.RUN_PDF_TESTS)('renderPdf', () => {
  it('produces a PDF file from HTML', async () => {
    const out = await renderPdf('<!doctype html><html><body><h1>Hi</h1></body></html>', 'test-output')
    expect(existsSync(out)).toBe(true)
    expect(out.endsWith('.pdf')).toBe(true)
  }, 30000)
})
