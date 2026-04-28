import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Daily cleanup of abandoned Stripe Checkout sessions.
//
// A pending order is created at the moment the rider clicks Pay; the row only
// flips to 'paid' when the Stripe webhook fires post-payment. If the rider
// closes the tab before paying, the row sits in 'pending' forever and inflates
// the capacity count. This cron deletes pendings older than 24h.
//
// Auth: CRON_SECRET via constant-time Bearer compare (lib/cronAuth).

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const supabase = supabaseAdmin()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Delete pendings older than cutoff. order_items cascade via FK on delete.
  const { data, error } = await supabase
    .from('orders')
    .delete()
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    deleted: data?.length || 0,
    cutoff,
  })
}
