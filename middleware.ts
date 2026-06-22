import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Paths/prefixes that are always public — no auth required
const PUBLIC = ['/login', '/favicon.ico', '/sw.js', '/workbox', '/icons', '/manifest', '/screenshots', '/api/health']

function jwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isValidJwt(token: string): boolean {
  const payload = jwtPayload(token)
  if (!payload || !payload.sub) return false
  if (payload.exp && payload.exp * 1000 < Date.now()) return false
  return true
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pass through public paths
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '-'))) {
    return NextResponse.next()
  }

  // Root redirect — check role cookie
  if (pathname === '/') {
    const hasSession = req.cookies.has('edu-session')
    if (!hasSession) return NextResponse.redirect(new URL('/login', req.url))
    const role = req.cookies.get('edu-role')?.value
    const dest = role === 'scanner' ? '/scanner/connect' : '/home'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  // Check presence cookie
  const hasSession = req.cookies.has('edu-session')

  // If an Authorization header is present, validate the JWT regardless of cookie
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (!isValidJwt(token)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  if (!hasSession) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Scanner staff attempting to access teacher routes — redirect to scanner
  if (!pathname.startsWith('/scanner') && !pathname.startsWith('/api/')) {
    const role = req.cookies.get('edu-role')?.value
    if (role === 'scanner') {
      return NextResponse.redirect(new URL('/scanner/connect', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|css)$).*)',
  ],
}
