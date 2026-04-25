// Leadership emails get the full admin nav (Metrics, QR, Finance, Track).
// Everyone else (staff) sees only Tonight, Loops, Contacts.
//
// Configure via NEXT_PUBLIC_LEADERSHIP_EMAILS=email1,email2,... in Vercel env.
// The default fallback covers Jacob so the app is never locked out if the env
// var isn't set yet.

const FALLBACK = ['jacob@jvillebrewloop.com', 'jharper@sharperprocess.com']

export function leadershipEmails() {
  const raw = process.env.NEXT_PUBLIC_LEADERSHIP_EMAILS
  if (!raw) return FALLBACK
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isLeadership(email) {
  if (!email) return false
  return leadershipEmails().includes(String(email).trim().toLowerCase())
}

// Routes only leadership can hit. Staff who try get bounced back to /admin.
export const LEADERSHIP_ONLY_PREFIXES = [
  '/admin/metrics',
  '/admin/qr',
  '/admin/finance',
]

export function isLeadershipOnlyPath(pathname) {
  return LEADERSHIP_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}
