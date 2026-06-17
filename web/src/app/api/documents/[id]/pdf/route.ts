import { type NextRequest } from 'next/server'
import { readFile } from 'node:fs/promises'
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

    // Read the PDF file asynchronously
    let fileBuffer: Buffer
    try {
      fileBuffer = await readFile(doc.pdfPath)
    } catch (fsErr) {
      if ((fsErr as NodeJS.ErrnoException).code === 'ENOENT') {
        return Response.json({ error: 'PDF file not found' }, { status: 404 })
      }
      throw fsErr
    }

    // Copy into a plain ArrayBuffer to satisfy BodyInit typing
    const ab = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    ) as ArrayBuffer

    return new Response(ab, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.label)}.pdf"`,
        'Content-Length': String(fileBuffer.byteLength),
      },
    })
  } catch (err) {
    console.error('[documents/pdf] unexpected error', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
