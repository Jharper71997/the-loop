import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordAlert } from '@/lib/alerts'
import { normalizeEmail } from '@/lib/contacts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public write endpoint for the post-ride survey at /feedback/<token>.
//
// The token from order_items.feedback_token is the whole auth story: it is
// random, per-ticket, and only ever sent to that rider. There is no login,
// because a survey behind a login is a survey nobody fills out. Worst case for
// a leaked token is a bogus rating on one ride.
//
// Called several times per rider — once when the star is tapped (so a rating
// survives someone closing the tab), once on submit, and once more if they tap
// through to Google. Every call upserts the same row keyed on order_item_id, so
// the writes are idempotent and later ones just fill in more fields.

const LOW_RATING_THRESHOLD = 3
const RIDE_AGAIN = new Set(['yes', 'maybe', 'no'])
const MAX_INTERESTS = 12

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400 })
  }

  const token = String(body?.token || '').toUpperCase().trim()
  if (!token) return Response.json({ error: 'missing_token' }, { status: 400 })

  const sb = supabaseAdmin()

  const { data: item } = await sb
    .from('order_items')
    .select('id, order_id, contact_id, rider_first_name')
    .eq('feedback_token', token)
    .maybeSingle()
  if (!item) return Response.json({ error: 'invalid_token' }, { status: 404 })

  const { data: order } = await sb
    .from('orders')
    .select('id, event_id, buyer_name')
    .eq('id', item.order_id)
    .maybeSingle()

  const { data: event } = order?.event_id
    ? await sb.from('events').select('id, name, event_date, group_id').eq('id', order.event_id).maybeSingle()
    : { data: null }

  const { data: prior } = await sb
    .from('ride_feedback')
    .select('id, rating, comment, review_clicked_at')
    .eq('order_item_id', item.id)
    .maybeSingle()

  // Google click-through is its own tiny write — don't let it clobber answers.
  if (body.review_clicked) {
    if (prior?.id) {
      await sb
        .from('ride_feedback')
        .update({ review_clicked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', prior.id)
    }
    return Response.json({ ok: true })
  }

  const rating = clampRating(body.rating)
  const row = {
    order_item_id: item.id,
    order_id: item.order_id || null,
    event_id: event?.id || null,
    group_id: event?.group_id || null,
    contact_id: item.contact_id || null,
    updated_at: new Date().toISOString(),
  }

  // Only overwrite fields the caller actually sent. The first POST carries just
  // the rating; sending `undefined` through would blank the rest on submit.
  if (rating != null) row.rating = rating
  if ('driver_rating' in body) row.driver_rating = clampRating(body.driver_rating)
  if ('bars_rating' in body) row.bars_rating = clampRating(body.bars_rating)
  if ('timing_rating' in body) row.timing_rating = clampRating(body.timing_rating)
  if ('favorite_bar' in body) row.favorite_bar = trimOrNull(body.favorite_bar)
  if ('ride_again' in body) row.ride_again = RIDE_AGAIN.has(body.ride_again) ? body.ride_again : null
  if ('comment' in body) row.comment = trimOrNull(body.comment, 4000)
  if ('group_type' in body) row.group_type = trimOrNull(body.group_type)
  if ('heard_about' in body) row.heard_about = trimOrNull(body.heard_about)
  if ('interests' in body) row.interests = toStringArray(body.interests)
  if ('email' in body) row.email = normalizeEmail(body.email) || null
  if ('marketing_opt_in' in body) row.marketing_opt_in = !!body.marketing_opt_in

  const { error } = await sb
    .from('ride_feedback')
    .upsert(row, { onConflict: 'order_item_id' })
  if (error) {
    console.error('[feedback] upsert failed', error.message)
    return Response.json({ error: 'save_failed' }, { status: 500 })
  }

  // Backfill the contact's email if the rider just gave us one we didn't have.
  // Guarded on null so a typo here can never overwrite a working address.
  if (row.email && item.contact_id) {
    await sb
      .from('contacts')
      .update({ email: row.email })
      .eq('id', item.contact_id)
      .is('email', null)
  }

  // Raise a notification the first time a ride comes back at 3 stars or less,
  // and again if they later add words to it. Anything above that needs no
  // human — it lands in the report either way.
  const isLow = row.rating != null && row.rating <= LOW_RATING_THRESHOLD
  const wasLow = prior?.rating != null && prior.rating <= LOW_RATING_THRESHOLD
  const gainedComment = !!row.comment && row.comment !== prior?.comment
  if (isLow && (!wasLow || gainedComment)) {
    const who = item.rider_first_name || order?.buyer_name || 'A rider'
    await recordAlert(sb, {
      kind: 'low_ride_rating',
      severity: 'warning',
      subject: `${row.rating}-star ride — ${event?.event_date || 'unknown date'}`,
      body: `${who} rated the ${event?.event_date || 'unknown'} Loop ${row.rating}/5.` +
            (row.comment ? `\n\n"${row.comment}"` : '\n\n(no comment left)'),
      context: {
        flow: 'ride_feedback',
        order_item_id: item.id,
        event_id: event?.id || null,
        rating: row.rating,
      },
    })
  }

  return Response.json({ ok: true })
}

function clampRating(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.round(n)
  if (i < 1 || i > 5) return null
  return i
}

// Bounded on both length and count — this lands in a text[] straight from a
// public endpoint, so an unbounded array is a free write amplifier.
function toStringArray(v) {
  if (!Array.isArray(v)) return []
  return v
    .map(x => trimOrNull(x, 120))
    .filter(Boolean)
    .slice(0, MAX_INTERESTS)
}

function trimOrNull(v, max = 500) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.slice(0, max)
}
