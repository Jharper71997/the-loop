import { randomInt } from 'node:crypto'
// Thin wrapper around qrcode.ai (the provider behind app.qrcode-ai.com).
// Generates a styled QR PNG for a given target URL. If the key is missing or
// the API errors, we fall back to null — the admin UI still renders the
// target URL and the /r/<code> redirect, so scan tracking works regardless.
//
// Auth: Bearer {QRCODE_AI_API_KEY}.
// Docs: https://qrcode.ai/api-documentation (rate limits + styling options).

const DEFAULT_BASE = 'https://qrcode.ai/api'

export async function generateQr({ url, label, style }) {
  const key = process.env.QRCODE_AI_API_KEY
  if (!key) return { imageUrl: null, error: 'QRCODE_AI_API_KEY not configured' }
  if (!url) return { imageUrl: null, error: 'url required' }

  const base = process.env.QRCODE_AI_BASE_URL || DEFAULT_BASE

  try {
    const form = new FormData()
    form.append('url', url)
    if (label) form.append('name', label)
    if (style?.color) form.append('color', style.color)
    if (style?.background) form.append('background', style.background)
    if (style?.logo_url) form.append('logo_url', style.logo_url)

    const res = await fetch(`${base}/qrcodes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { imageUrl: null, error: `qrcode.ai ${res.status}: ${text.slice(0, 200)}` }
    }

    const json = await res.json().catch(() => null)
    const imageUrl =
      json?.qr_code_url ||
      json?.image_url ||
      json?.data?.image_url ||
      json?.data?.qr_code_url ||
      null
    return { imageUrl, raw: json }
  } catch (err) {
    return { imageUrl: null, error: `qrcode.ai fetch failed: ${err.message}` }
  }
}

// Short random slug, drawn from a CSPRNG.
//
// This backs per-ticket check-in codes, and a check-in code IS the rider's
// credential — it opens their boarding pass and their security chat. It used
// to use Math.random(), which is V8's xorshift128+: not cryptographic, and
// finalizeBooking mints a whole order's codes in one tight loop, so a single
// multi-seat purchase hands out a long run of consecutive outputs from one
// generator state. That is far more than enough to recover the state and
// derive other riders' codes. The raw entropy was fine; the source was not.
//
// randomInt() is rejection-sampled by Node, so there is no modulo bias.
export function randomCode(len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[randomInt(alphabet.length)]
  }
  return out
}
