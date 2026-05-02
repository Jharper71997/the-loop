import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { BARS } from '@/lib/bars'
import {
  slugifyName,
  referralUrlFor,
  renderBartenderQr,
  pickFreeSlug,
  shareCodeBase,
  pickFreeShareCode,
} from '@/lib/bartenders'
import { normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { ensureBartenderVoucher } from '@/lib/ticketTailorVouchers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCHEMA_MISSING_CODES = new Set(['42P01', '42703'])

// Middleware gates this endpoint behind leadership auth via the parent /admin
// route prefix. Editing here can change display_name + bar but never the slug
// (the slug is the Ticket Tailor referral_tag — changing it would orphan all
// historical attribution).

export async function GET() {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('bartenders')
    .select('slug, display_name, bar, qr_image_url, active, share_code, email, phone, tt_voucher_id, created_at')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ bartenders: data || [] })
}

// POST /api/admin/bartenders
// Body: { first_name, bar_slug }
// Creates a new bartender row directly (admin onboarding without the public
// signup form). Mirrors the slug + QR generation logic from the signup route.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const firstName = String(body?.first_name || '').trim()
  const barSlug = String(body?.bar_slug || '').trim()
  const email = normalizeEmail(body?.email)
  const phone = normalizePhone(body?.phone)
  if (!firstName) return bad('first_name required')
  if (!barSlug) return bad('bar_slug required')

  const bar = BARS.find(b => b.slug === barSlug)
  if (!bar) return bad('unknown bar')

  const firstSlug = slugifyName(firstName)
  if (!firstSlug) return bad('first_name has no usable letters')

  const supabase = supabaseAdmin()
  const baseSlug = `${bar.slug}-${firstSlug}`

  // Idempotency: if a row already exists for this exact (bar, display_name),
  // surface a 409 rather than silently creating a duplicate.
  const { data: existing } = await supabase
    .from('bartenders')
    .select('slug')
    .eq('bar', bar.name)
    .ilike('display_name', firstName)
    .maybeSingle()
  if (existing) {
    return Response.json({ error: 'A bartender with that name already exists at this bar.' }, { status: 409 })
  }

  const slug = await pickFreeSlug(supabase, baseSlug)
  if (!slug) return Response.json({ error: 'could not find a free slug' }, { status: 500 })

  const qrImageUrl = await renderBartenderQr(referralUrlFor(slug))
  const shareCode = await pickFreeShareCode(supabase, shareCodeBase(firstName))

  const row = {
    slug,
    display_name: firstName,
    bar: bar.name,
    qr_image_url: qrImageUrl,
    active: true,
    share_code: shareCode,
    email,
    phone,
  }

  const { error } = await supabase.from('bartenders').insert(row)
  if (error) {
    if (SCHEMA_MISSING_CODES.has(error.code)) {
      return Response.json({
        error: 'Schema columns missing. Run sql/021_bartender_share_code.sql in Supabase before adding bartenders.',
      }, { status: 503 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  ensureBartenderVoucher(supabase, { slug, shareCode, displayName: firstName }).catch(err => {
    console.error('[admin/bartenders] TT voucher create failed', err)
  })

  return Response.json({ bartender: row })
}

// PATCH /api/admin/bartenders
// Body: { slug, display_name?, bar_slug?, active? }
// Edits any combination of display_name / bar / active. Slug is immutable.
// QR doesn't need to regenerate when name/bar change because the QR points at
// the TT URL with the slug, which is unchanged.
export async function PATCH(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const slug = String(body?.slug || '').trim()
  if (!slug) return bad('slug required')

  const updates = {}

  if ('display_name' in body) {
    const next = String(body.display_name || '').trim()
    if (!next) return bad('display_name cannot be empty')
    updates.display_name = next
  }

  if ('bar_slug' in body && body.bar_slug) {
    const bar = BARS.find(b => b.slug === body.bar_slug)
    if (!bar) return bad('unknown bar')
    updates.bar = bar.name
  }

  if ('active' in body) {
    updates.active = Boolean(body.active)
  }

  if ('email' in body) {
    updates.email = normalizeEmail(body.email) // null clears the field
  }

  if ('phone' in body) {
    updates.phone = normalizePhone(body.phone)
  }

  if (Object.keys(updates).length === 0) return bad('no changes provided')

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('bartenders')
    .update(updates)
    .eq('slug', slug)
    .select('slug, display_name, bar, qr_image_url, active, share_code, email, phone, tt_voucher_id, created_at')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'bartender not found' }, { status: 404 })
  return Response.json({ bartender: data })
}

// DELETE /api/admin/bartenders?slug=foo
// Hard-deletes a roster row. Used to clean up typos or duplicates where the
// row never had any ticket attribution. For "stop counting them" without
// losing history, prefer PATCH active=false.
export async function DELETE(req) {
  const url = new URL(req.url)
  const slug = String(url.searchParams.get('slug') || '').trim()
  if (!slug) return bad('slug required')

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('bartenders')
    .delete()
    .eq('slug', slug)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 })
}
