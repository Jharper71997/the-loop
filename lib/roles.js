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
//   party      — /admin/parties. Quoting a private night and minting the link
//                that sells it. NEXT_PUBLIC_PARTY_EMAILS
//
// Leadership implicitly satisfies security + driver + party (so Jacob/Richard
// can fill any role on the night without provisioning a separate account).

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

// Who can quote a private night and mint its booking link. Deliberately its
// own allowlist rather than "any staff": a party link is a live payment page
// for a number somebody typed, and the console is open to drivers and door
// staff. Empty by default, which means leadership only.
export function partyEmails() {
  return parseList(process.env.NEXT_PUBLIC_PARTY_EMAILS)
}

// Office/ops staff who get into the consoles but aren't in a night-of role
// (security/driver). Leadership + security + driver already imply staff; this
// is the catch-all allowlist for everyone else who needs the admin side.
export function staffEmails() {
  return parseList(process.env.NEXT_PUBLIC_STAFF_EMAILS)
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

export function isPartyBuilder(email) {
  const e = normalize(email)
  if (!e) return false
  return isLeadership(e) || partyEmails().includes(e)
}

// Anyone allowed to mark a rider boarded at the door. Security staff are
// the default; drivers (and leadership transitively) need it too so a driver
// doing a stop-level headcount can verify riders, and Jacob can spot-check.
export function canCheckIn(email) {
  return isSecurity(email) || isDriver(email)
}

// Anyone allowed into a staff console AT ALL (/admin, /surf, /loop). Being
// logged in is NOT enough — signup is public, so a rider could make an account.
// You must be a known staff email: leadership, security, driver, or on the
// explicit staff allowlist. Sub-paths (builder/security/driver) still layer
// their own role checks on top of this.
export function isStaff(email) {
  const e = normalize(email)
  if (!e) return false
  return isLeadership(e) || isSecurity(e) || isDriver(e) || staffEmails().includes(e)
}

// The staff consoles by URL: Brew /admin, Surf /surf, Marines /loop. Matched
// exactly or as a path prefix. Does NOT match the rider sites /surfcity or
// /marines (those are public and never start with '/surf/' | '/loop/').
const CONSOLE_PREFIXES = ['/admin', '/surf', '/loop']

export function isConsolePath(pathname) {
  return CONSOLE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Routes only leadership can hit. Staff who try get bounced back to /admin.
// /admin/loops, /admin/leaderboard, /admin/notifications all moved under
// /leadership (covered by the /leadership prefix below).
export const LEADERSHIP_ONLY_PREFIXES = [
  '/leadership',
  '/api/admin',
  '/api/leadership',
  // Surf City route builder lives in the Surf console (/surf) but is
  // leadership-only, mirroring Brew loop creation (which sits under /leadership).
  '/surf/builder',
  // The Loop (Marines) route builder, same deal, in the /loop console.
  '/loop/builder',
]

export function isLeadershipOnlyPath(pathname) {
  return LEADERSHIP_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// /admin/{security,driver} (Brew), /surf/{security,driver} (Surf) and
// /loop/{security,driver} (Marines) are gated by their own role allowlists on
// top of requiring a logged-in user.
export function isSecurityPath(pathname) {
  return pathname === '/admin/security' || pathname.startsWith('/admin/security/')
    || pathname === '/surf/security' || pathname.startsWith('/surf/security/')
    || pathname === '/loop/security' || pathname.startsWith('/loop/security/')
}

export function isDriverPath(pathname) {
  return pathname === '/admin/driver' || pathname.startsWith('/admin/driver/')
    || pathname === '/surf/driver' || pathname.startsWith('/surf/driver/')
    || pathname === '/loop/driver' || pathname.startsWith('/loop/driver/')
}

// The private-party desk. Brew only — Surf and Marines do not sell charters.
export function isPartyPath(pathname) {
  return pathname === '/admin/parties' || pathname.startsWith('/admin/parties/')
}
