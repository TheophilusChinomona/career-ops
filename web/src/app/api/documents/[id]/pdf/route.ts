import { type NextRequest } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Next 16: params is async
    const { id } = await params

    // Resolve session
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Load the Document scoped to the authenticated user
    const doc = await db.document.findFirst({ where: { id, userId } })
    if (!doc) {
      return Response.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check the file exists on disk
    if (!existsSync(doc.pdfPath)) {
      return Response.json({ error: 'PDF file not found' }, { status: 404 })
    }

    // Read the PDF file and return it
    const buffer = readFileSync(doc.pdfPath)

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.label)}.pdf"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ error: message }, { status: 500 })
  }
}
