import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Select, Textarea, SubmitButton } from '../../../../../_components/FormShell'

export const dynamic = 'force-dynamic'

const METHODS = [
  { value: 'check',    label: 'Check' },
  { value: 'cash',     label: 'Cash' },
  { value: 'venmo',    label: 'Venmo' },
  { value: 'cashapp',  label: 'Cash App' },
  { value: 'stripe',   label: 'Stripe / Card' },
  { value: 'other',    label: 'Other' },
]

async function recordBarPayment(barSlug, formData) {
  'use server'
  const dollars = parseFloat(formData.get('amount'))
  const method = (formData.get('method') || 'check').toString()
  const period = (formData.get('paid_for_period') || '').toString() || null
  const reference = (formData.get('reference') || '').toString().trim() || null
  const notes = (formData.get('notes') || '').toString().trim() || null
  if (!isFinite(dollars) || dollars <= 0) {
    redirect(`/leadership/bars/${barSlug}/payments/new?error=invalid`)
  }
  const supabase = supabaseAdmin()

  const { error: insertErr } = await supabase.from('bar_payments').insert({
    bar_slug: barSlug,
    amount_cents: Math.round(dollars * 100),
    method,
    paid_for_period: period,
    reference,
    notes,
  })
  if (insertErr) {
    redirect(`/leadership/bars/${barSlug}/payments/new?error=` + encodeURIComponent(insertErr.message))
  }

  // First payment flips a 'prospect' bar to 'active'.
  const { data: bar } = await supabase
    .from('bars')
    .select('status, started_at')
    .eq('slug', barSlug)
    .maybeSingle()
  if (bar?.status === 'prospect') {
    await supabase
      .from('bars')
      .update({
        status: 'active',
        started_at: bar.started_at || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('slug', barSlug)
  }

  revalidatePath('/leadership')
  revalidatePath('/leadership/bars')
  redirect('/leadership/bars')
}

export default async function NewBarPaymentPage({ params, searchParams }) {
  const { slug } = await params
  const sp = await searchParams
  const error = sp?.error

  const supabase = supabaseAdmin()
  const { data: bar } = await supabase
    .from('bars')
    .select('slug, name, status, monthly_fee_cents, payment_method')
    .eq('slug', slug)
    .maybeSingle()
  if (!bar) notFound()

  const action = recordBarPayment.bind(null, slug)
  const today = new Date()
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const defaultAmount = bar.monthly_fee_cents > 0 ? (bar.monthly_fee_cents / 100).toFixed(2) : ''

  return (
    <FormShell
      title={`Payment · ${bar.name}`}
      subtitle={`${bar.status} · monthly $${(bar.monthly_fee_cents / 100).toFixed(0)}`}
      backTo="/leadership/bars"
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
          {error === 'invalid' ? 'Enter a valid amount.' : error}
        </div>
      )}
      <form action={action}>
        <Field
          label="Amount ($)"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={defaultAmount}
          required
          autoFocus
          hint="Pre-filled from bar's monthly fee"
        />
        <Select
          label="Method"
          name="method"
          options={METHODS}
          defaultValue={bar.payment_method || 'check'}
          required
        />
        <Field
          label="Period covered"
          name="paid_for_period"
          type="date"
          defaultValue={defaultPeriod}
          hint="Which month this payment covers"
        />
        <Field
          label="Reference"
          name="reference"
          placeholder="Check #1234, Venmo @handle, etc."
          hint="Optional"
        />
        <Textarea
          label="Notes"
          name="notes"
          placeholder="(optional)"
        />
        <SubmitButton>Record Payment</SubmitButton>
      </form>
    </FormShell>
  )
}
