import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  isLeadership,
  isLeadershipOnlyPath,
  isSecurityPath,
  isDriver,
  isDriverPath,
  canCheckIn,
  isStaff,
  isConsolePath,
} from '@/lib/roles'

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/staff',
  '/book',
  '/waiver',
  '/events',
  '/bars',
  '/about',
  // Brew marketing-website pages absorbed from the old Squarespace site.
  '/merch',
  '/cart',
  '/sponsors',
  '/api/merch/',
  '/my-tickets',
  '/tickets/',
  '/r/',
  '/pass',
  '/invite/',
  '/leaderboard',
  '/bartender-signup',
  '/track',
  '/widget',
  '/marines',
  '/api/marines/',
  // Surf City Loop — second bar-shuttle business (kind='surf'). The rider
  // surface is public at /surfcity (Brew (external) chrome, business-aware).
  // Staff use the shared /admin console + the leadership-gated route builder at
  // /api/admin/loops (NOT public). /api/surf/ is the public rider ticket lookup.
  '/surfcity',
  '/api/surf/',
  '/api/shuttle/current',
  // The Loop driver pings with a code (loop_driver cookie), no Supabase session,
  // so middleware must let the request reach the handler — which authorizes
  // both Brew Loop (isDriver) and Loop (code + marines group) drivers itself.
  '/api/shuttle/ping',
  '/api/track/cohort',
  '/api/qr-image',
  '/api/ticket-tailor-webhook',
  '/api/stripe-webhook',
  '/api/checkout',
  '/api/loop-pass',
  '/api/waitlist',
  '/api/chat',
  '/api/waiver',
  '/api/leaderboard',
  '/api/bartender-signup',
  '/api/my-tickets',
  // Cron entry points — Vercel hits them without a Supabase cookie. Each route
  // verifies CRON_SECRET internally; middleware just lets the request reach it.
  '/api/cron/',
]

const LEGACY_ADMIN_PREFIXES = ['/groups', '/contacts', '/finance']

// Old admin-side leadership pages now live under /leadership. Keep these
// here so any bookmarks / links land on the right place. /security moved
// inside the admin shell at /admin/security.
const LEADERSHIP_RELOCATIONS = {
  '/admin/finance': '/leadership/finance',
  '/admin/metrics': '/leadership',
  '/admin/qr': '/leadership/qr',
  '/admin/groups/new': '/leadership/loops/new',
  '/admin/leaderboard': '/leadership/leaderboard',
  '/admin/loops': '/leadership/loops',
  '/admin/notifications': '/leadership/alerts',
  '/security': '/admin/security',
  // Driver page moved inside the admin shell — keep old bookmarks working.
  '/driver': '/admin/driver',
}

// Soft-removed routes — files may still exist on disk but middleware blocks
// every request so direct URLs land somewhere sensible.
const REMOVED_PREFIXES = [
  '/api/qr',
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
  for (const [oldPrefix, newPrefix] of Object.entries(LEADERSHIP_RELOCATIONS)) {
    if (pathname === oldPrefix || pathname.startsWith(oldPrefix + '/')) {
      return newPrefix + pathname.slice(oldPrefix.length)
    }
  }
  return null
}

export async function middleware(req) {
  const { pathname } = req.nextUrl

  // Static assets in /public (logos, icons, manifests, fonts) — never gate these
  // behind auth, or <img>/manifest/font requests 302 to /login and render broken.
  // The route matcher already excludes /_next/static and favicon.ico; this covers
  // everything else served from /public plus generated files (sitemap/robots).
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|txt|xml|woff2?|ttf|otf|map|webmanifest)$/i.test(pathname)) {
    return NextResponse.next()
  }

  // Tag the request with the active staff console's business so server pages can
  // read it via getActiveBusiness(). Brew console = /admin, Surf console = /surf,
  // Marines ("The Loop") console = /loop.
  // NOTE: this does NOT match the rider sites /surfcity or /marines (they aren't
  // '/surf'|'/loop' and don't start with '/surf/'|'/loop/'); rider pages don't
  // read this header anyway.
  const surfAdmin = pathname === '/surf' || pathname.startsWith('/surf/')
  const loopAdmin = pathname === '/loop' || pathname.startsWith('/loop/')
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-business', surfAdmin ? 'surf' : loopAdmin ? 'marines' : 'brew')

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

  let res = NextResponse.next({ request: { headers: requestHeaders } })

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

  // The staff consoles (/admin, /surf, /loop) require a known staff login, not
  // just any authenticated user — signup is public, so a rider could create an
  // account. A logged-in non-staff user is sent to the matching rider home
  // (not /login, which would loop them since they ARE logged in).
  if (isConsolePath(pathname) && !isStaff(user.email)) {
    const url = req.nextUrl.clone()
    url.pathname = surfAdmin ? '/surfcity' : loopAdmin ? '/marines' : '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (isLeadershipOnlyPath(pathname) && !isLeadership(user.email)) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  if (isSecurityPath(pathname) && !canCheckIn(user.email)) {
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
