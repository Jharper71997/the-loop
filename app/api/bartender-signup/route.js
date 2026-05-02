import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { BARS } from '@/lib/bars'
import { recordAlert } from '@/lib/alerts'
import {
  shareCodeBase,
  pickFreeShareCode,
  pickFreeSlug,
  slugifyName,
  referralUrlFor,
  renderBartenderQr,
  buildBartenderPayload,
} from '@/lib/bartenders'
import { normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { ensureBartenderVoucher } from '@/lib/ticketTailorVouchers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 42P01 = undefined_table, 42703 = undefined_column. Both mean a migration
// hasn't been applied to this Supabase environment. Surface the same friendly
// "temporarily unavailable" UX in either case so a missed migration is loud
// instead of silent.
const SCHEMA_MISSING_CODES = new Set(['42P01', '42703'])

// POST /api/bartender-signup
// Body: { first_name, bar_slug, code, email, phone }
// Returns: { slug, display_name, bar, bar_slug, referral_url, qr_image_url,
//            leaderboard_url, share_code }
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const firstName = String(body?.first_name || '').trim()
  const barSlug = String(body?.bar_slug || '').trim()
  const code = String(body?.code || '').trim()
  const email = normalizeEmail(body?.email)
  const phone = normalizePhone(body?.phone)

  if (!firstName) return bad('first_name required')
  if (!barSlug) return bad('bar_slug required')
  if (!email && !phone) return bad('email or phone required')

  const expectedCode = (process.env.BARTENDER_SIGNUP_CODE || '').trim()
  if (expectedCode && code !== expectedCode) {
    return Response.json({ error: 'invalid invite code' }, { status: 403 })
  }

  const bar = BARS.find(b => b.slug === barSlug)
  if (!bar) return bad('unknown bar')

  const firstSlug = slugifyName(firstName)
  if (!firstSlug) return bad('first_name has no usable letters')

  const supabase = supabaseAdmin()

  // Contact-first lookup: a returning bartender who forgot which bar she
  // originally picked still gets her existing row back as long as her phone
  // or email matches. Two different "Alyssa"s at two different bars stay
  // disambiguated because their contact info differs.
  if (email || phone) {
    const filters = []
    if (email) filters.push(`email.ilike.${email}`)
    if (phone) filters.push(`phone.eq.${phone}`)
    const { data: byContact, error: contactErr } = await supabase
      .from('bartenders')
      .select('slug, display_name, bar, qr_image_url, active, share_code, email, phone')
      .or(filters.join(','))
      .limit(2)

    if (contactErr && SCHEMA_MISSING_CODES.has(contactErr.code)) {
      return await schemaMissing(supabase)
    }

    if (byContact?.length === 1) {
      return Response.json(await buildBartenderPayload(supabase, byContact[0]))
    }
    // 0 or 2+ matches → fall through to the bar+name path. 2+ is rare (same
    // contact info across multiple bartender rows); falling through lets the
    // form's bar+name disambiguate it.
  }

  // Bar+name lookup (legacy idempotent path).
  const { data: existing, error: lookupErr } = await supabase
    .from('bartenders')
    .select('slug, display_name, bar, qr_image_url, active, share_code, email, phone')
    .eq('bar', bar.name)
    .ilike('display_name', firstName)
    .maybeSingle()

  if (lookupErr && SCHEMA_MISSING_CODES.has(lookupErr.code)) {
    return await schemaMissing(supabase)
  }

  if (existing) {
    // Backfill missing contact info on the existing row (don't overwrite
    // a value that's already there).
    const contactPatch = {}
    if (email && !existing.email) contactPatch.email = email
    if (phone && !existing.phone) contactPatch.phone = phone
    if (Object.keys(contactPatch).length) {
      await supabase.from('bartenders').update(contactPatch).eq('slug', existing.slug)
      Object.assign(existing, contactPatch)
    }
    return Response.json(await buildBartenderPayload(supabase, existing))
  }

  // Fresh signup.
  const baseSlug = `${bar.slug}-${firstSlug}`
  const slug = await pickFreeSlug(supabase, baseSlug)
  if (!slug) return Response.json({ error: 'could not find a free slug' }, { status: 500 })

  const referralUrl = referralUrlFor(slug)
  const qrDataUrl = await renderBartenderQr(referralUrl)
  const shareCode = await pickFreeShareCode(supabase, shareCodeBase(firstName))

  const row = {
    slug,
    display_name: firstName,
    bar: bar.name,
    qr_image_url: qrDataUrl,
    active: true,
    share_code: shareCode,
    email,
    phone,
  }

  const { error: insertErr } = await supabase.from('bartenders').insert(row)
  if (insertErr) {
    if (SCHEMA_MISSING_CODES.has(insertErr.code)) {
      return await schemaMissing(supabase)
    }
    await recordAlert(supabase, {
      kind: 'finalize_failed',
      subject: 'Bartender signup insert failed',
      body: insertErr.message,
      context: { display_name: firstName, bar: bar.name },
    })
    return Response.json({ error: 'Could not complete signup. Please try again.' }, { status: 500 })
  }

  // Fire-and-forget: create a TT voucher so the customer can type this
  // bartender's share_code in TT's "promo credit or voucher code" field at
  // checkout. Failing here doesn't block signup — the URL referral path
  // still works.
  ensureBartenderVoucher(supabase, { slug, shareCode, displayName: firstName }).catch(err => {
    console.error('[bartender-signup] TT voucher create failed', err)
  })

  return Response.json(await buildBartenderPayload(supabase, row))
}

async function schemaMissing(supabase) {
  await recordAlert(supabase, {
    kind: 'schema_missing',
    severity: 'error',
    subject: 'Bartender signup failed — schema columns missing',
    body: 'sql/021_bartender_share_code.sql has not been applied to this Supabase. Run it in the SQL editor.',
    context: { table: 'bartenders', endpoint: '/api/bartender-signup' },
  })
  return Response.json({
    error: 'Signups are temporarily unavailable. Text us at (636) 266-1801 and we’ll get you set up.',
  }, { status: 503 })
}

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 })
}
