import { db } from '@/lib/db'

export async function GET() {
  const exists = (await db.user.count()) > 0
  return Response.json({ exists })
}
