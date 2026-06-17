import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (must come before any imports that use them) ---

vi.mock('@/lib/db', () => ({
  db: {
    document: { findFirst: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

const { mockReadFileFn } = vi.hoisted(() => ({
  mockReadFileFn: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFileFn },
  readFile: mockReadFileFn,
}))

import { GET } from '../route'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

type MockDb = {
  document: { findFirst: ReturnType<typeof vi.fn> }
}

const mockDb = db as unknown as MockDb
const mockAuth = auth as unknown as { api: { getSession: ReturnType<typeof vi.fn> } }

// --- fixtures ---

const fakeUser = { id: 'user-1', email: 'tino@example.com' }
const fakeDoc = {
  id: 'doc-1',
  userId: 'user-1',
  jobId: 'job-1',
  type: 'cv',
  label: 'CV — TechCo',
  html: '<html>CV</html>',
  pdfPath: '/storage/pdfs/cv-tino-techco.pdf',
  createdAt: new Date(),
}
const fakePdfBuffer = Buffer.from('%PDF-1.4 fake pdf content')

function buildRequest(docId: string): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/documents/${docId}/pdf`, {
    method: 'GET',
  })
  return [req, { params: Promise.resolve({ id: docId }) }]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.api.getSession.mockResolvedValue({ user: fakeUser })
  mockDb.document.findFirst.mockResolvedValue(fakeDoc)
  mockReadFileFn.mockResolvedValue(fakePdfBuffer)
})

describe('GET /api/documents/[id]/pdf', () => {
  it('returns 401 when no session', async () => {
    mockAuth.api.getSession.mockResolvedValue(null)
    const [req, ctx] = buildRequest('doc-1')
    const res = await GET(req as Parameters<typeof GET>[0], ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 when document not found (wrong user or missing)', async () => {
    mockDb.document.findFirst.mockResolvedValue(null)
    const [req, ctx] = buildRequest('doc-1')
    const res = await GET(req as Parameters<typeof GET>[0], ctx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Document not found')
  })

  it('returns 404 when PDF file is missing on disk (ENOENT)', async () => {
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    mockReadFileFn.mockRejectedValue(enoent)
    const [req, ctx] = buildRequest('doc-1')
    const res = await GET(req as Parameters<typeof GET>[0], ctx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('PDF file not found')
  })

  it('returns 200 with application/pdf Content-Type and the file buffer on success', async () => {
    const [req, ctx] = buildRequest('doc-1')
    const res = await GET(req as Parameters<typeof GET>[0], ctx)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Length')).toBe(String(fakePdfBuffer.byteLength))

    const arrayBuffer = await res.arrayBuffer()
    expect(Buffer.from(arrayBuffer)).toEqual(fakePdfBuffer)
  })
})
