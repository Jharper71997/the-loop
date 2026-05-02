import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordAlert } from '@/lib/alerts'
import { buildBartenderPayload } from '@/lib/bartenders'
import { normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEMA_MISSING_CODES = new Set(['42P01', '42703'])

// POST /api/bartender-lookup
// Body: { contact: string }    // phone OR email; we figure out which
// Returns the same payload shape as /api/bartender-signup for an existing
// bartender. Used by /bartender-qr so a bartender who lost her QR can pull
// it back up by entering the contact info she gave at signup.
//
// Why a dedicated endpoint instead of reusing /api/bartender-signup: signup
// requires first_name + bar + invite code, which a returning bartender may
// no longer remember. Lookup needs none of that — proving she knows the
// phone or email she registered with is the auth.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const raw = String(body?.contact || '').trim()
  if (!raw) return bad('contact required')

  // Heuristic: anything with an "@" is an email; everything else is a phone.
  // normalizeEmail / normalizePhone return null on malformed input.
  const email = raw.includes('@') ? normalizeEmail(raw) : null
  const phone = email ? null : normalizePhone(raw)

  if (!email && !phone) {
    return Response.json({
      error: 'Enter the phone or email you signed up with.',
    }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  const filters = []
  if (email) filters.push(`email.ilike.${email}`)
  if (phone) filters.push(`phone.eq.${phone}`)

  const { data, error } = await supabase
    .from('bartenders')
    .select('slug, display_name, bar, qr_image_url, active, share_code, email, phone')
    .or(filters.join(','))
    .limit(2)

  if (error) {
    if (SCHEMA_MISSING_CODES.has(error.code)) {
      await recordAlert(supabase, {
        kind: 'schema_missing',
        severity: 'error',
        subject: 'Bartender lookup failed — schema columns missing',
        body: 'sql/021_bartender_share_code.sql has not been applied to this Supabase. Run it in the SQL editor.',
        context: { table: 'bartenders', endpoint: '/api/bartender-lookup' },
      })
      return Response.json({
        error: 'Lookups are temporarily unavailable. Text us at (636) 266-1801.',
      }, { status: 503 })
    }
    console.error('[bartender-lookup] query failed', error)
    return Response.json({ error: 'Lookup failed. Please try again.' }, { status: 500 })
  }

  if (!data?.length) {
    return Response.json({
      error: "We couldn't find a bartender with that contact info. Make sure you're using the same phone or email you signed up with — or sign up first.",
    }, { status: 404 })
  }

  if (data.length > 1) {
    return Response.json({
      error: 'Found more than one bartender for that contact. Try the other one (phone vs email) so we can match you exactly.',
    }, { status: 409 })
  }

  return Response.json(await buildBartenderPayload(supabase, data[0]))
}

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 })
}
