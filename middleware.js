import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  isLeadership,
  isLeadershipOnlyPath,
  isSecurityPath,
  isDriver,
  isDriverPath,
  isPartyBuilder,
  isPartyPath,
  canCheckIn,
  isStaff,
  isConsolePath,
} from '@/lib/roles'
import { isLoopSite } from '@/lib/site'

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
  '/contact',
  '/api/contact',
  // A private party's booking page. There is no public parties page — this is
  // the only party surface, and it is reachable only by the token we text to
  // one group. "Private" here means unlisted and noindexed, NOT logged-in: the
  // customer opening that link has no account and never will, so leaving it
  // out sent every party we sold to /login.
  '/party',
  '/api/merch/',
  '/my-tickets',
  '/tickets',
  // Per-seat claim link. The buyer forwards /c/<token> to a friend, who fills
  // in their info and signs the waiver there. Same reasoning as '/party'
  // above: the token IS the credential and the friend has no account, so
  // gating this sent every shared seat to the STAFF login. /tickets/<code>
  // redirects here for an unclaimed seat, so that link died the same way.
  '/c/',
  '/api/claim/',
  // Ride survey. /feedback/<token> is minted per ticket by the morning-after
  // cron; bare /feedback is the open link we text out by hand. No login by
  // design: a rider who has to sign in leaves no feedback. Listed WITHOUT the
  // trailing slash on purpose, so the bare path matches too — with it, the open
  // link 307s riders to the STAFF login, same trap as '/party' and '/c/'.
  '/feedback',
  '/api/feedback',
  // Bartender sales-contest QR lookup (public page + the phone/email lookup
  // it calls).
  '/bartender-qr',
  '/api/bartender-lookup',
  // Rider push-notification opt-in, called from the public rider shell.
  '/api/push/subscribe',
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

// ---------------------------------------------------------------------------
// Standalone The Loop site (NEXT_PUBLIC_SITE=marines, its own Vercel project +
// domain). Everything below is inert on the combined Brew deployment.
//
// The page files stay where they are — /marines for riders, /loop for staff —
// and the public URLs are mapped onto them. So on the Loop domain:
//
//   /            -> /marines           (rider home)
//   /events      -> /marines/events
//   /book/abc    -> /marines/book/abc
//   /admin/...   -> /loop/...          (staff console)
//
// Auth and role checks run against the INTERNAL path so /admin/builder is
// still recognized as the leadership-only /loop/builder.
// ---------------------------------------------------------------------------

// Rider routes that exist under /marines and should answer at the root.
const LOOP_RIDER_ROOTS = [
  '/events', '/book', '/track', '/my-tickets', '/tickets',
  '/bars', '/waiver', '/verify', '/ride',
]

// Brew- and Surf-only surfaces. The Loop carries no alcohol association (its
// riders are largely under 21), so the bar directory, merch store, sponsor
// pages and Loop Pass must not be reachable on this domain at all.
const LOOP_HIDDEN_PREFIXES = [
  '/surfcity', '/surf', '/leadership', '/merch', '/cart', '/sponsors',
  '/leaderboard', '/pass', '/about', '/contact', '/bartender-signup', '/r', '/invite',
  '/widget',
  // Their APIs go too, so a cached bundle on this domain can't reach into
  // another business's data.
  '/api/merch', '/api/surf', '/api/loop-pass', '/api/leaderboard',
  '/api/bartender-signup', '/api/contact',
]

// Public URL -> the path the app actually serves.
function loopInternalPath(pathname) {
  if (pathname === '/') return '/marines'
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return '/loop' + pathname.slice('/admin'.length)
  }
  for (const root of LOOP_RIDER_ROOTS) {
    if (pathname === root || pathname.startsWith(root + '/')) {
      return '/marines' + pathname
    }
  }
  return pathname
}

// Inverse of loopInternalPath, for redirect targets. Code elsewhere computes
// redirects in internal terms ('/marines', '/loop/security'); riders and staff
// must land on the public spelling.
function loopPublicPath(internal) {
  if (internal === '/marines') return '/'
  if (internal.startsWith('/marines/')) return internal.slice('/marines'.length)
  if (internal === '/loop') return '/admin'
  if (internal.startsWith('/loop/')) return '/admin' + internal.slice('/loop'.length)
  return internal
}

// The prefixed spellings still resolve, but 308 to the canonical root URL so
// existing QR codes and texted links keep working without splitting the site
// into two addresses for the same page.
function loopCanonicalRedirect(pathname) {
  if (pathname === '/marines' || pathname.startsWith('/marines/')) {
    return loopPublicPath(pathname) || '/'
  }
  if (pathname === '/loop' || pathname.startsWith('/loop/')) {
    return loopPublicPath(pathname)
  }
  return null
}

function isLoopHidden(pathname) {
  return LOOP_HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
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

  // Static assets in /public (logos, icons, manifests, fonts, video) — never gate
  // these behind auth, or <img>/<video>/manifest/font requests 302 to /login and
  // render broken. The route matcher already excludes /_next/static and
  // favicon.ico; this covers everything else served from /public plus generated
  // files (sitemap/robots).
  //
  // mp4/webm/mov are here because the landing-page hero plays real shuttle
  // footage from /public/brand/video — without them the request 307s to /login
  // and the hero silently falls back to its poster with no visible error.
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|txt|xml|woff2?|ttf|otf|map|webmanifest|mp4|webm|mov|m4v)$/i.test(pathname)) {
    return NextResponse.next()
  }

  // Send a redirect to a path expressed in internal terms, translating it to
  // the public spelling first when this is the standalone Loop site.
  const goTo = (internal, status) => {
    const url = req.nextUrl.clone()
    url.pathname = isLoopSite ? loopPublicPath(internal) : internal
    return NextResponse.redirect(url, status)
  }

  // On the standalone Loop site, resolve the public URL to the path the app
  // actually serves; every check below runs against that. On the combined Brew
  // deployment `path` is just `pathname` and nothing changes.
  let path = pathname
  if (isLoopSite) {
    const canonical = loopCanonicalRedirect(pathname)
    if (canonical) {
      const url = req.nextUrl.clone()
      url.pathname = canonical
      return NextResponse.redirect(url, 308)
    }
    // Brew/Surf surfaces do not exist on this domain. Pages send the visitor
    // home; APIs 404 instead so a stray fetch fails loudly rather than getting
    // an HTML page back where JSON was expected.
    if (isLoopHidden(pathname)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url, 307)
    }
    path = loopInternalPath(pathname)
  }

  // Tag the request with the active staff console's business so server pages can
  // read it via getActiveBusiness(). Brew console = /admin, Surf console = /surf,
  // Marines ("The Loop") console = /loop.
  // NOTE: this does NOT match the rider sites /surfcity or /marines (they aren't
  // '/surf'|'/loop' and don't start with '/surf/'|'/loop/'); rider pages don't
  // read this header anyway.
  const surfAdmin = path === '/surf' || path.startsWith('/surf/')
  const loopAdmin = path === '/loop' || path.startsWith('/loop/')
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(
    'x-business',
    surfAdmin ? 'surf' : loopAdmin || isLoopSite ? 'marines' : 'brew'
  )

  // Serve `path`, rewriting only when it differs from the URL the visitor typed.
  const proceed = () => {
    if (path === pathname) {
      return NextResponse.next({ request: { headers: requestHeaders } })
    }
    const url = req.nextUrl.clone()
    url.pathname = path
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  if (isRemoved(path)) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'gone' }, { status: 410 })
    }
    return goTo('/admin', 302)
  }

  const redirectTo = legacyRedirect(path)
  if (redirectTo) {
    return goTo(redirectTo, 308)
  }

  if (isPublic(path)) {
    return proceed()
  }

  let res = proceed()

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
  if (isConsolePath(path) && !isStaff(user.email)) {
    const home = surfAdmin ? '/surfcity' : loopAdmin ? '/marines' : '/'
    const url = req.nextUrl.clone()
    url.pathname = isLoopSite ? loopPublicPath(home) : home
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Bounce targets below are the console home, which is /loop on the Loop site
  // and therefore /admin once translated.
  if (isLeadershipOnlyPath(path) && !isLeadership(user.email)) {
    return goTo('/admin')
  }

  if (isSecurityPath(path) && !canCheckIn(user.email)) {
    return goTo('/admin')
  }

  if (isDriverPath(path) && !isDriver(user.email)) {
    return goTo('/admin')
  }

  // The party desk mints live payment links, so it gets its own allowlist on
  // top of being staff — the console is open to drivers and door staff, and a
  // charter link is a price somebody typed that a customer will be charged.
  if (isPartyPath(path) && !isPartyBuilder(user.email)) {
    return goTo('/admin')
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
