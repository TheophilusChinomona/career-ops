// Next.js 16: middleware.ts is deprecated and renamed to proxy.ts.
// The exported function must be named `proxy` (or use default export).
// API is otherwise identical to Next.js 15 middleware.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export function proxy(req: NextRequest) {
  const session = getSessionCookie(req)
  if (!session) return NextResponse.redirect(new URL('/login', req.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|api/auth|api/has-user|_next|favicon).*)'],
}
