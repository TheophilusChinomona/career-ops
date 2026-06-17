import path from 'node:path'
import { mkdirSync } from 'node:fs'
// Parent repo module (career-ops/generate-pdf.mjs). Path is relative to this file.
// @ts-expect-error - JS module without types
import { renderHtmlToPdf } from '../../../generate-pdf.mjs'

const OUTPUT_DIR = process.env.PDF_OUTPUT_DIR || path.resolve(process.cwd(), 'storage/pdfs')

export async function renderPdf(html: string, basename: string, format: 'a4' | 'letter' = 'a4'): Promise<string> {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const out = path.join(OUTPUT_DIR, `${basename}.pdf`)
  // baseDir lets the parent resolve ./fonts paths; point at career-ops root.
  await renderHtmlToPdf(html, out, { format, baseDir: path.resolve(process.cwd(), '..') })
  return out
}
