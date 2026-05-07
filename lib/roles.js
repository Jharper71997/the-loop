// Role helpers. All roles are email-based and configured via env vars so
// access control is reversible without a deploy.
//
//   leadership — full admin nav (Metrics, QR, Finance, Track).
//                NEXT_PUBLIC_LEADERSHIP_EMAILS
//   staff      — Tonight/Schedule, Loops, Contacts.
//                Anyone with a valid Supabase login who isn't blocked.
//   security   — /security scanner page only. Door scanning at the bar.
//                NEXT_PUBLIC_SECURITY_EMAILS
//   driver     — /admin/driver page (GPS pings + pickup scanner + route log).
//                NEXT_PUBLIC_DRIVER_EMAILS
//
// Leadership implicitly satisfies security + driver (so Jacob/Richard can fill
// any role on the night without provisioning a separate account).

const LEADERSHIP_FALLBACK = ['jacob@jvillebrewloop.com', 'richard@jvillebrewloop.com']

function parseList(raw) {
  if (!raw) return []
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

export function leadershipEmails() {
  const list = parseList(process.env.NEXT_PUBLIC_LEADERSHIP_EMAILS)
  return list.length ? list : LEADERSHIP_FALLBACK
}

export function securityEmails() {
  return parseList(process.env.NEXT_PUBLIC_SECURITY_EMAILS)
}

export function driverEmails() {
  return parseList(process.env.NEXT_PUBLIC_DRIVER_EMAILS)
}

function normalize(email) {
  return email ? String(email).trim().toLowerCase() : ''
}

export function isLeadership(email) {
  const e = normalize(email)
  if (!e) return false
  return leadershipEmails().includes(e)
}

export function isSecurity(email) {
  const e = normalize(email)
  if (!e) return false
  return isLeadership(e) || securityEmails().includes(e)
}

export function isDriver(email) {
  const e = normalize(email)
  if (!e) return false
  return isLeadership(e) || driverEmails().includes(e)
}

// Anyone allowed to mark a rider boarded at the door. Security staff are
// the default; drivers (and leadership transitively) need it too so a driver
// doing a stop-level headcount can verify riders, and Jacob can spot-check.
export function canCheckIn(email) {
  return isSecurity(email) || isDriver(email)
}

// Routes only leadership can hit. Staff who try get bounced back to /admin.
// /admin/loops, /admin/leaderboard, /admin/notifications all moved under
// /leadership (covered by the /leadership prefix below).
export const LEADERSHIP_ONLY_PREFIXES = [
  '/leadership',
  '/api/admin',
  '/api/leadership',
]

export function isLeadershipOnlyPath(pathname) {
  return LEADERSHIP_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// /admin/security and /admin/driver are gated by their own role allowlists in
// addition to requiring a logged-in Supabase user.
export function isSecurityPath(pathname) {
  return pathname === '/admin/security' || pathname.startsWith('/admin/security/')
}

export function isDriverPath(pathname) {
  return pathname === '/admin/driver' || pathname.startsWith('/admin/driver/')
}
