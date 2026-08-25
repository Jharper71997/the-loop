import { timingSafeEqual } from 'node:crypto'
import { isCombinedSite } from './site'

// Returns null if the request is an authorized Vercel cron call, or a Response
// to return immediately if not. Callers do:
//   const denied = denyIfNotCron(req); if (denied) return denied
//
// Vercel cron sets `Authorization: Bearer <CRON_SECRET>`. We compare in
// constant time so the secret can't be brute-forced byte-by-byte via timing.
export function denyIfNotCron(req) {
  // vercel.json is shared by every project built from this repo, so each extra
  // deployment (the standalone Loop site) registers the same schedules and the
  // jobs would run twice a day against one database — double reconciles, double
  // alerts. Only the combined Brew deployment actually executes them.
  if (!isCombinedSite) {
    return Response.json({ skipped: 'not_the_cron_deployment' }, { status: 200 })
  }

  // Two secrets are accepted. CRON_SECRET is what Vercel injects into its own
  // scheduled calls. EXTERNAL_CRON_SECRET is for the schedules Vercel can't
  // run — the Hobby plan is daily-only, so the sub-hourly pickup reminder is
  // driven by pg_cron inside Supabase instead. Either one authorizes a call.
  const accepted = [process.env.CRON_SECRET, process.env.EXTERNAL_CRON_SECRET].filter(Boolean)
  if (!accepted.length) {
    // Fail closed when not configured. Returning 500 would put Vercel into a
    // retry loop on a misconfig; 401 is the right shape for "auth missing".
    return Response.json({ error: 'cron_secret_unset' }, { status: 401 })
  }
  const provided = Buffer.from(req.headers.get('authorization') || '')
  const ok = accepted.some(secret => {
    const expected = Buffer.from(`Bearer ${secret}`)
    return provided.length === expected.length && timingSafeEqual(provided, expected)
  })
  if (!ok) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}
