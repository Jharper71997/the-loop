import QRCode from 'qrcode'
import { BARS } from '@/lib/bars'

export function slugifyName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function referralUrlFor(slug) {
  const base = process.env.TICKET_TAILOR_PUBLIC_URL || 'https://buytickets.at/jvillebrewloop'
  return `${base}?ref=${encodeURIComponent(slug)}`
}

export async function renderBartenderQr(url) {
  try {
    return await QRCode.toDataURL(url, {
      margin: 1,
      width: 600,
      color: { dark: '#0a0a0b', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch (err) {
    console.error('[bartenders] QR render failed', err)
    return null
  }
}

// Find a free slug starting from baseSlug, suffixing -2, -3, ... on collision.
// Returns { slug } when free, or null if it can't find one in 50 tries.
export async function pickFreeSlug(supabase, baseSlug) {
  let slug = baseSlug
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await supabase
      .from('bartenders')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle()
    if (!clash) return slug
    slug = `${baseSlug}-${i}`
  }
  return null
}

// Lowercased, alphanumeric form of the first name. This is what a customer
// types at checkout — no dashes, no caps, no spaces, so it survives whatever
// the customer actually keys in.
export function shareCodeBase(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// Pick a free share_code starting from base, suffixing -2, -3, ... on
// collision. Lookup is case-insensitive. Returns null if base is empty or
// no free code is found in 50 tries.
export async function pickFreeShareCode(supabase, base) {
  if (!base) return null
  let candidate = base
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await supabase
      .from('bartenders')
      .select('slug')
      .ilike('share_code', candidate)
      .maybeSingle()
    if (!clash) return candidate
    candidate = `${base}-${i}`
  }
  return null
}

// Build the public success-card payload for a bartender row. Lazily fills in
// qr_image_url and share_code if the row pre-dates either column — both are
// persisted back so subsequent reads are cheap. Shared by /api/bartender-signup
// and /api/bartender-lookup so the success card looks identical regardless
// of which path the bartender used to land on it.
export async function buildBartenderPayload(supabase, row) {
  const referralUrl = referralUrlFor(row.slug)
  const token = process.env.LEADERBOARD_TOKEN || ''
  const leaderboardUrl = token ? `/leaderboard?t=${encodeURIComponent(token)}` : '/leaderboard'

  let qrImageUrl = row.qr_image_url
  if (!qrImageUrl) {
    qrImageUrl = await renderBartenderQr(referralUrl)
    if (qrImageUrl) {
      await supabase
        .from('bartenders')
        .update({ qr_image_url: qrImageUrl })
        .eq('slug', row.slug)
    }
  }

  let shareCode = row.share_code
  if (!shareCode) {
    shareCode = await pickFreeShareCode(supabase, shareCodeBase(row.display_name))
    if (shareCode) {
      await supabase
        .from('bartenders')
        .update({ share_code: shareCode })
        .eq('slug', row.slug)
    }
  }

  // bar_slug isn't stored on the row — reverse-lookup against the static
  // BARS list. Falls back to null if the bar name no longer matches a known
  // partner (e.g. a bar was renamed in BARS but old rows still reference the
  // old name).
  const bar = BARS.find(b => b.name === row.bar)

  return {
    slug: row.slug,
    display_name: row.display_name,
    bar: row.bar,
    bar_slug: bar?.slug || null,
    referral_url: referralUrl,
    qr_image_url: qrImageUrl,
    leaderboard_url: leaderboardUrl,
    share_code: shareCode,
  }
}
