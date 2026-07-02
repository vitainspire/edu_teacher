import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Paths that are always public — no auth required
const PUBLIC_PREFIXES = [
  '/login',
  '/admin/login',
  '/api/admin/login',
  '/api/admin/register',
  '/api/school/has-admin',
  '/api/student',
  '/favicon.ico',
  '/sw.js',
  '/workbox',
  '/icons',
  '/manifest',
  '/screenshots',
  '/api/health',
  // Student-facing AI routes — protected by rate-limit, not Supabase session
  '/api/practice-quiz',
  '/api/catchup-plan',
  // Scanner portal routes — no Supabase session, rate-limited only
  '/api/multi-grade-scan',
  '/api/scanner-save-score',
  '/api/scanner-upload',
  '/api/worksheet-marks',
  '/api/worksheet-save-score',
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '-')
  )
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public paths
  if (isPublic(pathname)) return NextResponse.next()

  // Student portal pages — separate cookie auth, no Supabase session needed here
  if (pathname.startsWith('/student')) {
    if (!req.cookies.has('edu-student-id')) {
      return NextResponse.redirect(new URL('/student/login', req.url))
    }
    return NextResponse.next()
  }

  // Root redirect
  if (pathname === '/') {
    const role = req.cookies.get('edu-role')?.value
    const dest = role === 'scanner' ? '/scanner/connect' : role === 'admin' ? '/admin/dashboard' : '/home'
    return NextResponse.redirect(new URL(dest, req.url))
  }

  // Build a Supabase client that can read/refresh the session from cookies.
  // `auth.getUser()` makes a network call to verify the token signature —
  // unlike manual base64 decode, this cannot be bypassed with a forged JWT.
  let response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          response = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // API routes return JSON; page routes redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Scanner staff cannot access teacher or admin routes
  if (!pathname.startsWith('/scanner') && !pathname.startsWith('/admin') && !pathname.startsWith('/api/')) {
    const role = req.cookies.get('edu-role')?.value
    if (role === 'scanner') {
      return NextResponse.redirect(new URL('/scanner/connect', req.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|css)$).*)',
  ],
}
