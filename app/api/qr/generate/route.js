import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { generateQr, randomCode } from '@/lib/qrcodeAi'
import { appUrl } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/qr/generate
// Body: { kind, label?, target_url, utm_source?, utm_medium?, utm_campaign?,
//         bar_id?, sponsor_id?, order_item_id?, style? }
// Returns: { code, redirect_url, png_url, qr }
//
// Admin-only via middleware.js. We mint a short `code`, record the row, then
// ask qrcode.ai to render a styled PNG whose decoded URL points to our
// /r/<code> redirect (not the final target). That means scans are always
// logged even if the caller later changes the target.
export async function POST(req) {
  let body
  try { body = await req.json() } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const kind = body.kind
  const ALLOWED_KINDS = ['attribution', 'checkin', 'bar', 'waiver', 'sponsor']
  if (!ALLOWED_KINDS.includes(kind)) {
    return Response.json({ error: `kind must be one of ${ALLOWED_KINDS.join('|')}` }, { status: 400 })
  }
  if (!body.target_url) {
    return Response.json({ error: 'target_url required' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Mint a unique short code. Collisions are astronomically unlikely but we
  // retry a couple times just in case.
  let code = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomCode(8)
    const { data } = await admin
      .from('qr_codes')
      .select('id')
      .eq('code', candidate)
      .maybeSingle()
    if (!data) { code = candidate; break }
  }
  if (!code) return Response.json({ error: 'could not mint unique code' }, { status: 500 })

  const redirectUrl = `${appUrl()}/r/${code}`

  // Generate styled PNG via qrcode.ai — non-blocking if the key or service
  // is unavailable; we still record the row so scan tracking works.
  const qr = await generateQr({
    url: redirectUrl,
    label: body.label || `${kind}-${code}`,
    style: body.style || { color: '#d4a333', background: '#0a0a0b' },
  })

  const { data: inserted, error } = await admin
    .from('qr_codes')
    .insert({
      code,
      kind,
      label: body.label || null,
      target_url: body.target_url,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      bar_id: body.bar_id || null,
      sponsor_id: body.sponsor_id || null,
      order_item_id: body.order_item_id || null,
      png_url: qr.imageUrl || null,
    })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    code,
    redirect_url: redirectUrl,
    png_url: inserted.png_url,
    qr_error: qr.error || null,
    qr: inserted,
  })
}
