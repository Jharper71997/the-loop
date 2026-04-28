import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  isLeadership,
  isLeadershipOnlyPath,
  isSecurity,
  isSecurityPath,
  isDriver,
  isDriverPath,
} from '@/lib/roles'

const PUBLIC_PREFIXES = [
  '/login',
  '/staff',
  '/book',
  '/track',
  '/waiver',
  '/events',
  '/bars',
  '/my-tickets',
  '/tickets/',
  '/r/',
  '/leaderboard',
  '/bartender-signup',
  '/api/ticket-tailor-webhook',
  '/api/stripe-webhook',
  '/api/checkout',
  '/api/waiver',
  '/api/leaderboard',
  '/api/bartender-signup',
]

const LEGACY_ADMIN_PREFIXES = ['/groups', '/contacts', '/finance', '/metrics', '/qr']

// Phase C: finance is being removed from this app. Routes still exist on disk
// (so we can revive them later by deleting these prefixes) but middleware
// blocks every request. Soft-remove, not a delete.
const REMOVED_PREFIXES = [
  '/admin/finance',
  '/api/finance-summary',
  '/api/finance-data',
  '/api/finance-entries',
]

function isPublic(pathname) {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some(p => {
    if (p.endsWith('/')) return pathname.startsWith(p)
    return pathname === p || pathname.startsWith(p + '/')
  })
}

function isRemoved(pathname) {
  return REMOVED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

function legacyRedirect(pathname) {
  for (const prefix of LEGACY_ADMIN_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return '/admin' + pathname
    }
  }
  return null
}

export async function middleware(req) {
  const { pathname } = req.nextUrl

  if (isRemoved(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'gone' }, { status: 410 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url, 302)
  }

  const redirectTo = legacyRedirect(pathname)
  if (redirectTo) {
    const url = req.nextUrl.clone()
    url.pathname = redirectTo
    return NextResponse.redirect(url, 308)
  }

  if (isPublic(pathname)) {
    return NextResponse.next()
  }

  let res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set({ name, value })
            res.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLeadershipOnlyPath(pathname) && !isLeadership(user.email)) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  if (isSecurityPath(pathname) && !isSecurity(user.email)) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  if (isDriverPath(pathname) && !isDriver(user.email)) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
