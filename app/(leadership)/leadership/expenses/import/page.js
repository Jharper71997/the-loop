import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Select, SubmitButton } from '../../../_components/FormShell'

export const dynamic = 'force-dynamic'

// Stable category list mirroring Diamond's P&L PDF. Order matches the PDF
// for fast keyboard entry. Add new categories at the bottom — never reorder
// or rename, otherwise the qb_id-based deduplication breaks for prior months.
const CATEGORIES = [
  { slug: 'contractors',          label: 'Contractors',                hint: 'Driver pay, compliance' },
  { slug: 'cogs_merch',            label: 'Cost of Goods · Merch',     hint: 'Shirts, koozies, etc.' },
  { slug: 'vehicle_operating',     label: 'Vehicle Operating',          hint: 'Fuel + maintenance + repairs' },
  { slug: 'advertising_marketing', label: 'Advertising & Marketing',    hint: 'Ads, flyers, paid social' },
  { slug: 'bank_fees',             label: 'Bank Charges & Fees',        hint: 'Transaction fees' },
  { slug: 'insurance',             label: 'Insurance',                  hint: 'Business + General Liability + Workers Comp combined' },
  { slug: 'bookkeeping',           label: 'Bookkeeping',                hint: "Diamond's monthly fee" },
  { slug: 'meals',                 label: 'Meals & Entertainment',      hint: '' },
  { slug: 'office_software',       label: 'Office Software',            hint: 'QuickBooks, Google Workspace, app subs' },
  { slug: 'taxes_licenses',        label: 'Taxes & Licenses',           hint: '' },
]

function periodKey(year, monthIdx) {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`
}

function periodFromQueryOrDefault(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    const d = new Date()
    return periodKey(d.getFullYear(), d.getMonth())
  }
  return period
}

async function importExpenses(formData) {
  'use server'
  const period = (formData.get('period') || '').toString()
  if (!/^\d{4}-\d{2}$/.test(period)) {
    redirect('/leadership/expenses/import?error=invalid_period')
  }
  const expenseDate = `${period}-01`
  const supabase = supabaseAdmin()

  const rows = []
  for (const cat of CATEGORIES) {
    const raw = formData.get(`amount_${cat.slug}`)
    const dollars = parseFloat(raw)
    if (!isFinite(dollars) || dollars < 0) continue
    if (dollars === 0) continue  // skip zeros so we don't pollute the table
    rows.push({
      qb_id: `manual:${period}:${cat.slug}`,
      qb_account: cat.label,
      qb_category: cat.slug,
      category: 'manual',
      amount_cents: Math.round(dollars * 100),
      expense_date: expenseDate,
      vendor: null,
      notes: `Manually entered from Diamond's P&L for ${period}`,
      qb_synced_at: new Date().toISOString(),
    })
  }

  if (rows.length === 0) {
    redirect('/leadership/expenses/import?error=no_amounts')
  }

  const { error } = await supabase
    .from('expenses')
    .upsert(rows, { onConflict: 'qb_id' })

  if (error) {
    redirect('/leadership/expenses/import?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/leadership')
  revalidatePath('/leadership/expenses')
  revalidatePath('/leadership/profit-first')
  redirect('/leadership/expenses?imported=' + period)
}

export default async function ExpenseImportPage({ searchParams }) {
  const sp = await searchParams
  const period = periodFromQueryOrDefault(sp?.period)
  const error = sp?.error

  // Pre-fill from existing rows for that period (if any), otherwise from
  // the most recent prior period so Jacob doesn't re-type stable categories
  // like Insurance or Bookkeeping that change rarely.
  const supabase = supabaseAdmin()
  const periodDate = `${period}-01`

  const { data: thisMonth } = await supabase
    .from('expenses')
    .select('qb_category, amount_cents')
    .eq('expense_date', periodDate)
    .eq('category', 'manual')

  let priorAmounts = new Map()
  if ((thisMonth || []).length === 0) {
    const { data: priorRows } = await supabase
      .from('expenses')
      .select('qb_category, amount_cents, expense_date')
      .eq('category', 'manual')
      .lt('expense_date', periodDate)
      .order('expense_date', { ascending: false })
      .limit(60) // up to 6 months × 10 categories
    // Take the most recent value per category
    for (const r of priorRows || []) {
      if (r.qb_category && !priorAmounts.has(r.qb_category)) {
        priorAmounts.set(r.qb_category, r.amount_cents)
      }
    }
  }

  const thisMonthMap = new Map((thisMonth || []).map(r => [r.qb_category, r.amount_cents]))

  function defaultFor(slug) {
    const cents = thisMonthMap.get(slug) ?? priorAmounts.get(slug) ?? null
    if (cents == null) return ''
    return (cents / 100).toFixed(2)
  }

  const monthOptions = []
  const today = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = periodKey(d.getFullYear(), d.getMonth())
    monthOptions.push({
      value: key,
      label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    })
  }

  const isPriorPrefilled = (thisMonth || []).length === 0 && priorAmounts.size > 0

  return (
    <FormShell
      title="Monthly P&L Entry"
      subtitle={`Type the totals from Diamond's PDF · ~2 min`}
      backTo="/leadership/expenses"
    >
      {error && (
        <div style={{
          background: 'rgba(196,74,58,0.15)',
          border: '1px solid rgba(196,74,58,0.4)',
          color: '#f4b8ad',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 12,
          marginBottom: 14,
        }}>
          {error === 'invalid_period' ? 'Pick a valid month.'
            : error === 'no_amounts' ? 'Enter at least one non-zero amount.'
            : error}
        </div>
      )}
      {isPriorPrefilled && (
        <div style={{
          background: 'rgba(212,163,51,0.1)',
          border: '1px solid rgba(212,163,51,0.3)',
          color: '#d4a333',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 11,
          marginBottom: 14,
          letterSpacing: '0.04em',
        }}>
          Pre-filled from last month's values. Update the ones that changed.
        </div>
      )}
      <form action={importExpenses}>
        <Select
          label="Month"
          name="period"
          options={monthOptions}
          defaultValue={period}
          required
        />
        <div style={{
          borderTop: '1px solid #2a2a31',
          margin: '14px 0 8px',
          paddingTop: 14,
        }}>
          {CATEGORIES.map(cat => (
            <Field
              key={cat.slug}
              label={cat.label}
              name={`amount_${cat.slug}`}
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultFor(cat.slug)}
              hint={cat.hint || undefined}
            />
          ))}
        </div>
        <SubmitButton>Save P&L</SubmitButton>
      </form>
    </FormShell>
  )
}
