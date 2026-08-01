import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// One-shot backfill: walks order_items with tt_ticket_id set and tt_barcode
// null, queries the TT API for each ticket's barcode, writes it back.
// Idempotent — re-running only touches rows still missing the barcode.
//
// Usage:
//   fetch('/api/leadership/tt-barcode-backfill', { method: 'POST' }).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)))

const TT_BASE = 'https://api.tickettailor.com/v1'

export async function POST() {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return Response.json({ error: 'no_api_key' }, { status: 500 })
  const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')

  const supabase = supabaseAdmin()

  // Diagnostic counts so we can tell why "nothing to backfill" if it happens.
  const { count: ttIdCount } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .not('tt_ticket_id', 'is', null)
  const { count: ttBarcodeCount } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .not('tt_barcode', 'is', null)
  const { count: totalCount } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })

  const { data: rows, error } = await supabase
    .from('order_items')
    .select('id, tt_ticket_id, tt_barcode')
    .not('tt_ticket_id', 'is', null)
    .is('tt_barcode', null)
    .limit(500)

  if (error) return Response.json({ error: error.message, diagnostics: { totalCount, ttIdCount, ttBarcodeCount } }, { status: 500 })
  if (!rows?.length) {
    return Response.json({
      ok: true,
      scanned: 0,
      updated: 0,
      message: 'nothing_to_backfill',
      diagnostics: {
        total_order_items: totalCount,
        with_tt_ticket_id: ttIdCount,
        with_tt_barcode: ttBarcodeCount,
      },
    })
  }

  let updated = 0
  let notFound = 0
  let failed = 0
  const errors = []

  for (const row of rows) {
    const ttId = row.tt_ticket_id
    const res = await fetch(`${TT_BASE}/issued_tickets/${ttId}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (res.status === 404) { notFound++; continue }
    if (!res.ok) { failed++; errors.push({ id: row.id, status: res.status }); continue }
    const ticket = await res.json().catch(() => null)
    const barcode = ticket?.barcode ? String(ticket.barcode) : null
    if (!barcode) { failed++; continue }

    const { error: updErr } = await supabase
      .from('order_items')
      .update({ tt_barcode: barcode })
      .eq('id', row.id)
    if (updErr) { failed++; errors.push({ id: row.id, error: updErr.message }); continue }
    updated++
  }

  return Response.json({
    ok: true,
    scanned: rows.length,
    updated,
    not_found: notFound,
    failed,
    errors: errors.slice(0, 10),
  })
}
