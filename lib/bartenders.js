import QRCode from 'qrcode'

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
