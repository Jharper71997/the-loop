import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Aggregates everything finance-related (sponsors, expenses, bank, per-loop
// profit) so the Finance page can render in one fetch.
export async function GET() {
  const supabase = supabaseAdmin()

  const [sponsorsRes, expensesRes, banksRes, ordersRes, groupsRes] = await Promise.all([
    supabase.from('sponsors')
      .select('id, name, contact, tier, amount_committed, amount_paid, status, notes')
      .order('amount_committed', { ascending: false }),
    supabase.from('expenses')
      .select('id, category, vendor, amount_cents, group_id, expense_date, notes')
      .order('expense_date', { ascending: false })
      .limit(200),
    supabase.from('bank_balances')
      .select('id, account_name, balance_cents, as_of, notes')
      .order('as_of', { ascending: false })
      .limit(50),
    supabase.from('orders')
      .select('id, event_id, total_cents, status, paid_at, party_size, events(group_id, event_date, name)')
      .eq('status', 'paid')
      .limit(500),
    supabase.from('groups')
      .select('id, name, event_date')
      .order('event_date', { ascending: false })
      .limit(40),
  ])

  // Latest balance per account.
  const latestBank = {}
  for (const b of banksRes.data || []) {
    if (!latestBank[b.account_name]) latestBank[b.account_name] = b
  }

  // Per-loop profit: revenue (from native orders) minus expenses tagged to that group.
  const loops = {}
  for (const g of groupsRes.data || []) {
    loops[g.id] = { id: g.id, name: g.name, event_date: g.event_date, revenue: 0, expenses: 0, tickets: 0 }
  }
  for (const o of ordersRes.data || []) {
    const gid = o.events?.group_id
    if (!gid || !loops[gid]) continue
    loops[gid].revenue += o.total_cents || 0
    loops[gid].tickets += o.party_size || 0
  }
  for (const e of expensesRes.data || []) {
    if (e.group_id && loops[e.group_id]) {
      loops[e.group_id].expenses += e.amount_cents || 0
    }
  }
  const perLoop = Object.values(loops)
    .filter(l => l.revenue > 0 || l.expenses > 0)
    .sort((a, b) => (a.event_date < b.event_date ? 1 : -1))

  const sponsorTotals = (sponsorsRes.data || []).reduce(
    (acc, s) => {
      acc.committed += Number(s.amount_committed || 0)
      acc.paid += Number(s.amount_paid || 0)
      return acc
    },
    { committed: 0, paid: 0 }
  )

  const expensesMTD = (expensesRes.data || [])
    .filter(e => e.expense_date && e.expense_date.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s, e) => s + (e.amount_cents || 0), 0)

  return Response.json({
    sponsors: sponsorsRes.data || [],
    sponsorTotals,
    expenses: expensesRes.data || [],
    expensesMTD,
    bank: Object.values(latestBank),
    perLoop,
  })
}
