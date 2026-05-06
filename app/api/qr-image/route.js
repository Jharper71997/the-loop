import QRCode from 'qrcode'

export const runtime = 'nodejs'

// Server-rendered QR PNG. Used by the booking confirmation email so the
// receipt shows a scannable code inline — Gmail and Apple Mail load
// external images by default, but they strip data: URIs, so we host the
// PNG ourselves and reference it by URL.
//
// Usage: <img src="${APP_URL}/api/qr-image?data=<encoded-url>&size=480">
//
// Cached aggressively (1 year) — the URL fully determines the image, so
// the same /tickets/<code> always renders the same QR.
export async function GET(req) {
  try {
    const url = new URL(req.url)
    const data = url.searchParams.get('data')
    if (!data) {
      return new Response('missing data', { status: 400 })
    }
    const sizeRaw = parseInt(url.searchParams.get('size') || '480', 10)
    const size = Number.isFinite(sizeRaw) ? Math.max(120, Math.min(800, sizeRaw)) : 480

    const buf = await QRCode.toBuffer(data, {
      type: 'png',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0a0a0b',
        light: '#ffffff',
      },
    })

    return new Response(buf, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    return new Response(`qr generation failed: ${err?.message || err}`, { status: 500 })
  }
}
