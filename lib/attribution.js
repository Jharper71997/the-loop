// Client-side sale attribution (seller / QR slug + UTM tags).
//
// A seller link lands on /events?ref=<slug>, but the buyer then clicks through
// to /book/<id>, or closes the tab and comes back that night. Capturing only
// on /book dropped the tag in both cases, so AttributionCapture runs on every
// rider page and stores the tag in localStorage for ATTRIBUTION_TTL_MS.
// BookingForm reads it back at checkout.
//
// A later untagged visit (utm only, or nothing) never wipes a seller's slug.
// A new seller link replaces it: the last seller who handed over a link gets
// the sale.

const STORE_KEY = 'bl_attribution'
const ATTRIBUTION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function readStored() {
  try {
    const raw = localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    if (saved?.at && Date.now() - saved.at > ATTRIBUTION_TTL_MS) {
      localStorage.removeItem(STORE_KEY)
      return null
    }
    return saved
  } catch {
    return null
  }
}

// Reads tags off the current URL, merges them over anything stored, persists,
// and returns the result (or null when there's nothing to attribute).
export function captureAttribution() {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  // `qr` and `ref` both map to qr_code so seller/QR slugs work either way.
  const fresh = {
    qr_code: p.get('qr') || p.get('ref') || null,
    // rider-to-rider referral code (from /invite/<code>); separate from the
    // seller qr_code so a booking can carry both.
    referrer_code: p.get('rref') || null,
    utm_source: p.get('utm_source') || null,
    utm_medium: p.get('utm_medium') || null,
    utm_campaign: p.get('utm_campaign') || null,
  }
  const saved = readStored()
  const hasFresh = Object.values(fresh).some(Boolean)
  if (!hasFresh) return saved

  const merged = {
    ...fresh,
    qr_code: fresh.qr_code || saved?.qr_code || null,
    referrer_code: fresh.referrer_code || saved?.referrer_code || null,
    at: Date.now(),
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(merged)) } catch {}
  return merged
}
