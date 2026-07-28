// One-shot: register "Roeder" as a Brew Loop referral seller (bartenders row),
// matching exactly what /api/bartender-signup would create, and emit a printable
// QR PNG to the Desktop.
//
// Keyed to his email so that when he logs in and configures himself in the app,
// the contact-first lookup returns THIS same row (same slug / code / QR) instead
// of minting a duplicate.
//
//   node scripts/create-roeder-referral.js            # dry run (no DB write)
//   node scripts/create-roeder-referral.js --commit   # insert the row
//
// Always writes the QR PNG locally so it can be previewed either way.

const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')
const { createClient } = require('@supabase/supabase-js')

const COMMIT = process.argv.includes('--commit')

// --- load .env.local ---
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const TT_BASE = env.TICKET_TAILOR_PUBLIC_URL || 'https://buytickets.at/jvillebrewloop'
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// --- target ---
const EMAIL = 'droederiv@yahoo.com'
const DISPLAY = 'Roeder'
const WANT_SLUG = 'roeder'
const WANT_CODE = 'roeder'
const DESKTOP = 'C:/Users/jacob/OneDrive/Desktop/brewloop-roeder-referral-qr.png'

const referralUrlFor = (slug) => `${TT_BASE}?ref=${encodeURIComponent(slug)}`

async function pickFreeSlug(base) {
  let slug = base
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase.from('bartenders').select('slug').eq('slug', slug).maybeSingle()
    if (!data) return slug
    slug = `${base}-${i}`
  }
  return null
}
async function pickFreeShareCode(base) {
  let c = base
  for (let i = 2; i < 50; i++) {
    const { data } = await supabase.from('bartenders').select('slug').ilike('share_code', c).maybeSingle()
    if (!data) return c
    c = `${base}-${i}`
  }
  return null
}

async function main() {
  // Reuse an existing row if he (or a prior run) is already in the table.
  const { data: existing, error: exErr } = await supabase
    .from('bartenders')
    .select('slug, display_name, bar, share_code, email, active')
    .or(`email.ilike.${EMAIL},slug.eq.${WANT_SLUG}`)
    .limit(2)
  if (exErr) throw exErr

  let row
  if (existing && existing.length) {
    row = existing[0]
    console.log(`[exists] reusing row: ${row.slug} (code ${row.share_code}, email ${row.email || 'none'})`)
  } else {
    const slug = await pickFreeSlug(WANT_SLUG)
    const shareCode = await pickFreeShareCode(WANT_CODE)
    if (!slug || !shareCode) throw new Error('could not allocate slug/share_code')
    const referralUrl = referralUrlFor(slug)
    const qrDataUrl = await QRCode.toDataURL(referralUrl, {
      margin: 1, width: 600, color: { dark: '#0a0a0b', light: '#ffffff' }, errorCorrectionLevel: 'M',
    })
    row = { slug, display_name: DISPLAY, bar: null, qr_image_url: qrDataUrl, active: true, share_code: shareCode, email: EMAIL, phone: null }
    if (COMMIT) {
      const { error: insErr } = await supabase.from('bartenders').insert(row)
      if (insErr) throw insErr
      console.log(`[insert] created bartenders row: ${slug}`)
    } else {
      console.log(`[dry-run] WOULD insert bartenders row: ${slug} (code ${shareCode})`)
    }
  }

  const referralUrl = referralUrlFor(row.slug)
  // Crisp printable PNG to the Desktop (black on white, standard scannable).
  await QRCode.toFile(DESKTOP, referralUrl, {
    margin: 1, width: 1024, color: { dark: '#0a0a0b', light: '#ffffff' }, errorCorrectionLevel: 'M',
  })

  console.log('\n=== Roeder referral ===')
  console.log('display_name :', row.display_name)
  console.log('slug         :', row.slug)
  console.log('share_code   :', String(row.share_code).toUpperCase())
  console.log('referral_url :', referralUrl)
  console.log('qr_png       :', DESKTOP)
  console.log('committed    :', COMMIT)
}

main().catch((e) => { console.error(e); process.exit(1) })
