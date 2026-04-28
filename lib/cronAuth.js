import { timingSafeEqual } from 'node:crypto'

// Returns null if the request is an authorized Vercel cron call, or a Response
// to return immediately if not. Callers do:
//   const denied = denyIfNotCron(req); if (denied) return denied
//
// Vercel cron sets `Authorization: Bearer <CRON_SECRET>`. We compare in
// constant time so the secret can't be brute-forced byte-by-byte via timing.
export function denyIfNotCron(req) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    // Fail closed when not configured. Returning 500 would put Vercel into a
    // retry loop on a misconfig; 401 is the right shape for "auth missing".
    return Response.json({ error: 'cron_secret_unset' }, { status: 401 })
  }
  const provided = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${expected}`

  const a = Buffer.from(provided)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}
