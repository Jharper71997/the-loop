import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Fixed-window rate limit backed by Postgres (check_rate_limit, sql/054).
// Returns true if the request is ALLOWED, false if it blew the budget.
//
// Replaces the per-instance Map limiters, which reset on every Vercel cold
// start and were therefore not a real control.
//
// Fails OPEN: any limiter error resolves to true. Booking a ride must not fail
// because the limiter had a bad day.
//
//   if (!(await rateLimit('my_tickets', clientIp(req), 5, 60)))
//     return Response.json({ error: 'Too many requests' }, { status: 429 })
export async function rateLimit(bucket, key, max, windowSecs) {
  try {
    const { data, error } = await supabaseAdmin().rpc('check_rate_limit', {
      p_bucket: bucket,
      p_key: String(key || 'unknown'),
      p_max: max,
      p_window_secs: windowSecs,
    })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}

// Best-effort client IP from proxy headers.
export function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
