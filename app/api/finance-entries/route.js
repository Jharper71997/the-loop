import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/finance-entries
// Body:
//   { kind: 'expense', expense: { category, vendor, amount_cents, group_id?, expense_date, notes? } }
//   { kind: 'bank',    bank:    { account_name, balance_cents, notes? } }
export async function POST(req) {
  const body = await req.json().catch(() => null)
  if (!body?.kind) return Response.json({ error: 'kind required' }, { status: 400 })
  const supabase = supabaseAdmin()

  if (body.kind === 'expense') {
    const e = body.expense || {}
    if (!e.category || !e.amount_cents || !e.expense_date) {
      return Response.json({ error: 'category, amount_cents, expense_date required' }, { status: 400 })
    }
    const { error } = await supabase.from('expenses').insert({
      category: e.category,
      vendor: e.vendor || null,
      amount_cents: e.amount_cents,
      group_id: e.group_id || null,
      expense_date: e.expense_date,
      notes: e.notes || null,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (body.kind === 'bank') {
    const b = body.bank || {}
    if (!b.account_name || b.balance_cents == null) {
      return Response.json({ error: 'account_name, balance_cents required' }, { status: 400 })
    }
    const { error } = await supabase.from('bank_balances').insert({
      account_name: b.account_name,
      balance_cents: b.balance_cents,
      notes: b.notes || null,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'unknown kind' }, { status: 400 })
}

// DELETE /api/finance-entries?kind=expense&id=...
export async function DELETE(req) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')
  const id = url.searchParams.get('id')
  if (!kind || !id) return Response.json({ error: 'kind and id required' }, { status: 400 })
  const table = kind === 'expense' ? 'expenses' : kind === 'bank' ? 'bank_balances' : null
  if (!table) return Response.json({ error: 'unknown kind' }, { status: 400 })

  const supabase = supabaseAdmin()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
