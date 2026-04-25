import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PREFIXES = [
  '/login',
  '/staff',
  '/book',
  '/track',
  '/waiver',
  '/events',
  '/bars',
  '/my-tickets',
  '/r/',
  '/api/ticket-tailor-webhook',
  '/api/stripe-webhook',
  '/api/checkout',
  '/api/waiver',
]

const LEGACY_ADMIN_PREFIXES = ['/groups', '/contacts', '/finance', '/metrics', '/qr']

function isPublic(pathname) {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some(p => {
    if (p.endsWith('/')) return pathname.startsWith(p)
    return pathname === p || pathname.startsWith(p + '/')
  })
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

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
