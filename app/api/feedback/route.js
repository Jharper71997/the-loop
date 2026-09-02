import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordAlert } from '@/lib/alerts'
import { normalizeEmail, upsertContactByPhoneOrEmail } from '@/lib/contacts'
import { grantSurveyReward } from '@/lib/surveyReward'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public write endpoint for the post-ride survey. Two front doors:
//
//   /feedback/<token>  a per-ticket token from order_items.feedback_token,
//                      minted by the cron and only ever sent to that rider.
//   /feedback          the open link, keyed on a UUID the browser mints.
//
// Neither has a login, because a survey behind a login is a survey nobody fills
// out. The token door is the whole auth story for attributed responses: worst
// case for a leaked token is a bogus rating on one ride. The open door buys no
// trust at all, so its rows are stamped source='link', carry no event, and stay
// out of the response-rate math on /leadership/feedback. It does have to carry a
// name and a cell, though: an anonymous "book the whole shuttle" is a lead we
// cannot return, so the open form makes those the price of finishing and this
// route resolves them onto a real contact row.
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
  const publicToken = normalizePublicToken(body?.public_token)
  if (!token && !publicToken) return Response.json({ error: 'missing_token' }, { status: 400 })

  const sb = supabaseAdmin()

  // Ticket-token path resolves the rider and the ride they were on. The
  // open-link path has neither, and keys the row on the browser's UUID instead.
  let item = null
  let order = null
  let event = null

  if (token) {
    const { data: found } = await sb
      .from('order_items')
      .select('id, order_id, contact_id, rider_first_name')
      .eq('feedback_token', token)
      .maybeSingle()
    if (!found) return Response.json({ error: 'invalid_token' }, { status: 404 })
    item = found

    const { data: ord } = await sb
      .from('orders')
      .select('id, event_id, buyer_name')
      .eq('id', item.order_id)
      .maybeSingle()
    order = ord || null

    if (order?.event_id) {
      const { data: ev } = await sb
        .from('events')
        .select('id, name, event_date, group_id')
        .eq('id', order.event_id)
        .maybeSingle()
      event = ev || null
    }
  }

  // Whichever credential arrived is also the upsert key, so reopening the link
  // edits the same row instead of stacking duplicates.
  const conflictKey = item ? 'order_item_id' : 'public_token'
  const priorQuery = sb
    .from('ride_feedback')
    .select('id, rating, comment, review_clicked_at')
  const { data: prior } = item
    ? await priorQuery.eq('order_item_id', item.id).maybeSingle()
    : await priorQuery.eq('public_token', publicToken).maybeSingle()

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
    order_item_id: item?.id || null,
    public_token: item ? null : publicToken,
    source: item ? 'survey' : 'link',
    order_id: item?.order_id || null,
    event_id: event?.id || null,
    group_id: event?.group_id || null,
    contact_id: item?.contact_id || null,
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
  if ('first_name' in body) row.first_name = trimOrNull(body.first_name, 80)
  if ('phone' in body) row.phone = trimOrNull(body.phone, 40)
  if ('email' in body) row.email = normalizeEmail(body.email) || null
  if ('marketing_opt_in' in body) row.marketing_opt_in = !!body.marketing_opt_in

  // Open-link responses arrive with a name and cell instead of a ticket. Run
  // them through the same dedupe every other rider surface uses, so a repeat
  // rider lands back on their existing contact rather than spawning a twin —
  // and so a 3-star comment comes with someone to call.
  if (!item && row.phone) {
    const contact = await upsertContactByPhoneOrEmail(sb, {
      firstName: row.first_name || null,
      email: row.email || null,
      phone: row.phone,
      // Only ever grant consent here, never revoke it: an unticked box on a
      // survey is not the same as opting out of a list they joined elsewhere.
      ...(row.marketing_opt_in ? { smsConsent: true } : {}),
    })
    if (contact?.id) row.contact_id = contact.id
  }

  // Return the id: the reward send below needs a row to claim, and on a first
  // submit there is no `prior` to take it from.
  const { data: saved, error } = await sb
    .from('ride_feedback')
    .upsert(row, { onConflict: conflictKey })
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[feedback] upsert failed', error.message)
    return Response.json({ error: 'save_failed' }, { status: 500 })
  }

  // Backfill the contact's email if the rider just gave us one we didn't have.
  // Guarded on null so a typo here can never overwrite a working address.
  if (row.email && item?.contact_id) {
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
    const who = item?.rider_first_name || order?.buyer_name || row.first_name || 'A rider'
    const when = event?.event_date || (item ? 'unknown date' : 'open link, ride date unknown')
    await recordAlert(sb, {
      kind: 'low_ride_rating',
      severity: 'warning',
      subject: `${row.rating}-star ride — ${when}`,
      body: `${who} rated the Loop ${row.rating}/5 (${when}).` +
            (row.comment ? `\n\n"${row.comment}"` : '\n\n(no comment left)') +
            (row.phone ? `\n\nCall back: ${row.phone}` : ''),
      context: {
        flow: 'ride_feedback',
        order_item_id: item?.id || null,
        event_id: event?.id || null,
        source: row.source,
        rating: row.rating,
      },
    })
  }

  // Pay the 50%-off code for finishing the survey. Only the submit POST carries
  // an email, so this cannot fire on the star tap, and the review-click POST
  // returns long before it. Deliberately not gated on rating: paying only happy
  // riders is review gating (see lib/surveyReward.js).
  //
  // Awaited on purpose. Fire-and-forget on a serverless function gets killed
  // with the response, and a rider who was promised a code and got nothing is
  // the failure that matters most here.
  const feedbackId = saved?.id || prior?.id || null
  if (row.email && feedbackId && (row.rating ?? prior?.rating) != null) {
    await grantSurveyReward(sb, {
      feedbackId,
      email: row.email,
      firstName: row.first_name || item?.rider_first_name || firstWord(order?.buyer_name),
      origin: originOf(req),
    })
  }

  return Response.json({ ok: true })
}

function originOf(req) {
  try { return new URL(req.url).origin } catch { return null }
}

function firstWord(name) {
  const s = String(name || '').trim()
  return s ? s.split(/\s+/)[0] : ''
}

// The open link's key. Constrained to the UUID shape the client mints, so the
// unique index cannot be stuffed with arbitrary keys by a script.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function normalizePublicToken(v) {
  const t = String(v || '').trim().toLowerCase()
  return UUID_RE.test(t) ? t : null
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
