import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// One-shot: set a ticket_type's capacity. Leadership-gated.
//
// Usage:
//   fetch('/api/leadership/fix-capacity', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ ticket_type_id: '76ded9af-51b1-43f6-9799-cdf2400bf379', capacity: 13 })
//   }).then(r => r.json()).then(console.log)

export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  let body
  try { body = await req.json() } catch { body = null }
  const ticketTypeId = body?.ticket_type_id
  const capacity = Number(body?.capacity)
  if (!ticketTypeId || !Number.isFinite(capacity) || capacity < 0) {
    return Response.json({ error: 'ticket_type_id + capacity (non-negative number) required' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  const { data: before } = await supabase
    .from('ticket_types')
    .select('id, name, capacity, event_id, stop_index')
    .eq('id', ticketTypeId)
    .maybeSingle()
  if (!before) return Response.json({ error: 'ticket_type not found' }, { status: 404 })

  const { error } = await supabase
    .from('ticket_types')
    .update({ capacity })
    .eq('id', ticketTypeId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: after } = await supabase
    .from('ticket_types')
    .select('id, name, capacity, event_id, stop_index')
    .eq('id', ticketTypeId)
    .maybeSingle()

  return Response.json({ ok: true, before, after })
}
