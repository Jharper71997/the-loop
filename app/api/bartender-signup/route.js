import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { BARS } from '@/lib/bars'
import { recordAlert } from '@/lib/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/bartender-signup
// Body: { first_name, bar_slug, code }
// Returns: { slug, display_name, bar, referral_url, qr_image_url, leaderboard_url }
//
// Idempotent: re-submitting the same first_name + bar_slug returns the existing
// row's slug + QR. Slug collisions (different person, same first name + bar) are
// resolved with -2, -3, ... suffixes.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const firstName = String(body?.first_name || '').trim()
  const barSlug = String(body?.bar_slug || '').trim()
  const code = String(body?.code || '').trim()

  if (!firstName) return bad('first_name required')
  if (!barSlug) return bad('bar_slug required')

  const expectedCode = (process.env.BARTENDER_SIGNUP_CODE || '').trim()
  if (expectedCode && code !== expectedCode) {
    return Response.json({ error: 'invalid invite code' }, { status: 403 })
  }

  const bar = BARS.find(b => b.slug === barSlug)
  if (!bar) return bad('unknown bar')

  const firstSlug = slugify(firstName)
  if (!firstSlug) return bad('first_name has no usable letters')

  const supabase = supabaseAdmin()
  const baseSlug = `${bar.slug}-${firstSlug}`

  // Idempotency: if a row already exists for this exact (bar, display_name),
  // return it. Cheap dedupe so a bartender hitting submit twice doesn't end up
  // with two slugs.
  const { data: existing, error: lookupErr } = await supabase
    .from('bartenders')
    .select('slug, display_name, bar, qr_image_url, active')
    .eq('bar', bar.name)
    .ilike('display_name', firstName)
    .maybeSingle()

  // 42P01 = relation does not exist. Means the migration was forgotten in
  // this environment — surface a friendly message and alert Jacob.
  if (lookupErr?.code === '42P01') {
    await recordAlert(supabase, {
      kind: 'schema_missing',
      severity: 'error',
      subject: 'Bartender signup failed — bartenders table missing',
      body: 'sql/010_bartender_referrals.sql has not been applied to this Supabase. Run it in the SQL editor.',
      context: { table: 'bartenders', endpoint: '/api/bartender-signup' },
    })
    return Response.json({
      error: 'Signups are temporarily unavailable. Text us at (636) 266-1801 and we’ll get you set up.',
    }, { status: 503 })
  }

  if (existing) {
    return Response.json(await buildPayload(supabase, existing, bar))
  }

  // Resolve slug collision: -2, -3, ... if base is taken by a different name.
  let slug = baseSlug
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await supabase
      .from('bartenders')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle()
    if (!clash) break
    slug = `${baseSlug}-${i}`
  }

  const referralUrl = referralUrlFor(slug)
  const qrDataUrl = await renderQr(referralUrl)

  const row = {
    slug,
    display_name: firstName,
    bar: bar.name,
    qr_image_url: qrDataUrl,
    active: true,
  }

  const { error } = await supabase.from('bartenders').insert(row)
  if (error) {
    if (error.code === '42P01') {
      await recordAlert(supabase, {
        kind: 'schema_missing',
        severity: 'error',
        subject: 'Bartender signup failed — bartenders table missing',
        body: 'sql/010_bartender_referrals.sql has not been applied to this Supabase. Run it in the SQL editor.',
        context: { table: 'bartenders', endpoint: '/api/bartender-signup' },
      })
      return Response.json({
        error: 'Signups are temporarily unavailable. Text us at (636) 266-1801 and we’ll get you set up.',
      }, { status: 503 })
    }
    await recordAlert(supabase, {
      kind: 'finalize_failed',
      subject: 'Bartender signup insert failed',
      body: error.message,
      context: { display_name: firstName, bar: bar.name },
    })
    return Response.json({ error: 'Could not complete signup. Please try again.' }, { status: 500 })
  }

  return Response.json(await buildPayload(supabase, row, bar))
}

// Server-render the QR locally with the `qrcode` library. No external API
// dependency — same approach as the rider boarding pass at /tickets/<code>.
async function renderQr(url) {
  try {
    return await QRCode.toDataURL(url, {
      margin: 1,
      width: 600,
      color: { dark: '#0a0a0b', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch (err) {
    console.error('[bartender-signup] QR render failed', err)
    return null
  }
}

async function buildPayload(supabase, row, bar) {
  const referralUrl = referralUrlFor(row.slug)
  const token = process.env.LEADERBOARD_TOKEN || ''
  const leaderboardUrl = token ? `/leaderboard?t=${encodeURIComponent(token)}` : '/leaderboard'

  // Older rows may have a null or stale qr_image_url (signed up before this
  // path was switched to local rendering). Lazily generate + persist so the
  // bartender always sees a working QR.
  let qrImageUrl = row.qr_image_url
  if (!qrImageUrl) {
    qrImageUrl = await renderQr(referralUrl)
    if (qrImageUrl) {
      await supabase
        .from('bartenders')
        .update({ qr_image_url: qrImageUrl })
        .eq('slug', row.slug)
    }
  }

  return {
    slug: row.slug,
    display_name: row.display_name,
    bar: row.bar,
    bar_slug: bar.slug,
    referral_url: referralUrl,
    qr_image_url: qrImageUrl,
    leaderboard_url: leaderboardUrl,
  }
}

function referralUrlFor(slug) {
  const base = process.env.TICKET_TAILOR_PUBLIC_URL || 'https://buytickets.at/jvillebrewloop'
  return `${base}?ref=${encodeURIComponent(slug)}`
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 })
}
