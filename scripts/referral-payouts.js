// Monthly referral payouts = 20% of ACTUAL ticket revenue each referrer drove,
// combining Ticket Tailor + native /book (Stripe) sales. Read-only.
//
// The local TICKET_TAILOR_API_KEY is currently 403/expired, so TT orders are
// read from a saved orders dump (pull via the Ticket Tailor MCP `orders_get`
// for the month, then pass the saved file path). Native sales come from the
// Supabase `orders` table (metadata.qr_code = bartender slug).
//
//   node scripts/referral-payouts.js <tt-orders.json> [YYYY-MM]
//
// Commission is on collected revenue (line_item.total), so $0 comps and
// discounted walk-ons are paid correctly. Generic tags (bare bar name, widget)
// are listed but NOT paid — they aren't an individual referrer.
const fs = require('fs'), path = require('path'), { createClient } = require('@supabase/supabase-js')
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const RATE = 0.20
const TT_FILE = process.argv[2]
const MONTH = process.argv[3] || '2026-05'
// Non-individual tags: the TT widget plus bare bar-level links (no person).
const GENERIC = new Set(['website_widget', 'angry-ginger', 'twin-ravens', 'shirley-vs', 'shirley-v-s', 'unhinged', 'archies', 'archies-pub', 'hideaway', 'hideaway-lounge', 'black-rose'])
if (!TT_FILE) { console.error('Usage: node scripts/referral-payouts.js <tt-orders.json> [YYYY-MM]'); process.exit(1) }

;(async () => {
  const [Y, M] = MONTH.split('-').map(Number)
  const startISO = new Date(`${MONTH}-01T00:00:00-05:00`).toISOString()
  const endISO = new Date(Date.UTC(Y, M, 1)).toISOString()

  const { data: bts } = await sb.from('bartenders').select('slug, display_name, bar, active, share_code')
  const bySlug = new Map((bts || []).map(b => [b.slug, b]))
  const barSlugs = new Set((bts || []).map(b => String(b.bar || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')))

  // tag -> { tickets, grossCents }  (TT)
  const tag = new Map()
  const j = JSON.parse(fs.readFileSync(TT_FILE, 'utf8'))
  for (const o of j.data || []) {
    const t = o.referral_tag; if (!t) continue
    const items = (o.line_items || []).filter(li => li.type === 'ticket')
    const tix = items.reduce((s, li) => s + Number(li.quantity || 0), 0)
    const gross = items.reduce((s, li) => s + Number(li.total || 0), 0)
    if (!tix) continue
    const c = tag.get(t) || { tickets: 0, gross: 0, native: 0 }; c.tickets += tix; c.gross += gross; tag.set(t, c)
  }

  // Native /book (Stripe) — orders.metadata.qr_code = slug. (May: all dropped.)
  const { data: nat } = await sb.from('orders')
    .select('party_size, total_cents, metadata').eq('status', 'paid').gte('paid_at', startISO).lt('paid_at', endISO)
  for (const o of nat || []) {
    const slug = o.metadata?.qr_code; if (!slug) continue
    const c = tag.get(slug) || { tickets: 0, gross: 0, native: 0 }
    c.tickets += Number(o.party_size) || 0; c.gross += Number(o.total_cents) || 0; c.native += Number(o.party_size) || 0
    tag.set(slug, c)
  }

  const rows = [...tag.entries()].map(([t, v]) => {
    const b = bySlug.get(t)
    // Generic if: explicit list, matches a bar slug, or is a bare bar prefix
    // that registered seller slugs extend (e.g. "angry-ginger" -> "angry-ginger-allin").
    const isPrefix = (bts || []).some(x => x.slug.startsWith(t + '-'))
    const isGeneric = GENERIC.has(t) || barSlugs.has(t) || (!b && isPrefix)
    return {
      tag: t, name: b ? b.display_name : null, bar: b ? b.bar : null,
      registered: !!(b && b.active), generic: isGeneric,
      tickets: v.tickets, gross: v.gross / 100, payout: +(v.gross / 100 * RATE).toFixed(2),
    }
  }).sort((a, b) => b.payout - a.payout)

  console.log(`\n=== ${MONTH} referral payouts — 20% of actual ticket revenue ===\n`)
  console.log('  ' + 'Referrer'.padEnd(24) + 'Bar'.padEnd(18) + 'Seats'.padStart(6) + 'Gross'.padStart(8) + '  Payout')
  let total = 0
  for (const r of rows) {
    const who = r.name || (r.generic ? `${r.tag} (generic)` : `${r.tag} (UNREGISTERED)`)
    const pay = r.generic ? null : r.payout
    if (pay) total += pay
    console.log('  ' + who.padEnd(24) + String(r.bar || '').slice(0, 16).padEnd(18) +
      String(r.tickets).padStart(6) + ('$' + r.gross.toFixed(0)).padStart(8) + '   ' + (pay == null ? '— (not a referrer)' : '$' + pay.toFixed(2)))
  }
  console.log(`\n  TOTAL PAYOUT: $${total.toFixed(2)}`)
  console.log('  Note: native /book credited $0 for May (pre-2026-06-03 tag-drop bug) — may understate referrals.')
})().catch(e => { console.error(e); process.exit(1) })
