import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizePhone } from '@/lib/phone'
import { verifyPassForRide } from '@/lib/loopPass'
import { rateLimit, clientIp } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/loop-pass/check
// Body: { phone, event_id }
// Returns: { covered: boolean, reason? }
//
// Lets /book tell a member "your seat is $0" the moment they type their phone,
// instead of only after they hit Pay. It runs the same live check checkout
// does (verifyPassForRide), but it is a preview only: checkout re-verifies and
// is the only thing that ever zeroes a seat.
//
// Returns no name or contact details, only yes/no, so typing someone else's
// number tells you nothing more than whether it holds a pass.
export async function POST(req) {
  if (!(await rateLimit('pass_check', clientIp(req), 20, 600))) {
    return Response.json({ covered: false, reason: 'rate_limited' }, { status: 429 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ covered: false }, { status: 400 }) }

  const phone = normalizePhone(body?.phone)
  const eventId = String(body?.event_id || '').trim()
  if (!phone || !eventId) return Response.json({ covered: false })

  const supabase = supabaseAdmin()
  const [{ data: event }, { data: contact }] = await Promise.all([
    supabase.from('events').select('id, event_date, kind, is_private').eq('id', eventId).maybeSingle(),
    supabase.from('contacts').select('id').eq('phone', phone).limit(1).maybeSingle(),
  ])
  // Same scope as checkout: Brew Loop public loops only.
  if (!event || event.kind !== 'brew' || event.is_private) return Response.json({ covered: false })
  if (!contact?.id) return Response.json({ covered: false })

  const check = await verifyPassForRide(supabase, {
    contactId: contact.id,
    riderPhone: phone,
    buyerPhone: phone,
    eventId: event.id,
    eventDate: event.event_date,
  })
  if (check.covered) return Response.json({ covered: true })
  // Only the reasons a member can act on. Everything else reads as "no pass".
  const reason = ['already_booked', 'period_ends_before_ride', 'unpaid', 'verify_failed'].includes(check.reason)
    ? check.reason
    : undefined
  return Response.json({ covered: false, reason })
}
