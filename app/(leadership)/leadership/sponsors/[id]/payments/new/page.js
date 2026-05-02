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

async function recordPayment(sponsorId, formData) {
  'use server'
  const dollars = parseFloat(formData.get('amount'))
  const method = (formData.get('method') || 'check').toString()
  const period = (formData.get('paid_for_period') || '').toString() || null
  const reference = (formData.get('reference') || '').toString().trim() || null
  const notes = (formData.get('notes') || '').toString().trim() || null
  if (!isFinite(dollars) || dollars <= 0) {
    redirect(`/leadership/sponsors/${sponsorId}/payments/new?error=invalid`)
  }
  const supabase = supabaseAdmin()

  const { error: insertErr } = await supabase.from('sponsor_payments').insert({
    sponsor_id: sponsorId,
    amount_cents: Math.round(dollars * 100),
    method,
    paid_for_period: period,
    reference,
    notes,
  })
  if (insertErr) {
    redirect(`/leadership/sponsors/${sponsorId}/payments/new?error=` + encodeURIComponent(insertErr.message))
  }

  // Bump sponsors.amount_paid (rolling total) and mark status='paid' if first payment.
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('amount_paid, status')
    .eq('id', sponsorId)
    .maybeSingle()
  const newPaid = Number(sponsor?.amount_paid || 0) + dollars
  await supabase
    .from('sponsors')
    .update({
      amount_paid: newPaid,
      status: sponsor?.status === 'prospect' ? 'paid' : (sponsor?.status || 'paid'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sponsorId)

  revalidatePath('/leadership')
  revalidatePath('/leadership/sponsors')
  redirect('/leadership/sponsors')
}

export default async function NewSponsorPaymentPage({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const error = sp?.error

  const supabase = supabaseAdmin()
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('id, name, tier, amount_committed, amount_paid, status')
    .eq('id', id)
    .maybeSingle()
  if (!sponsor) notFound()

  const action = recordPayment.bind(null, id)
  // Default period = current month, YYYY-MM-01
  const today = new Date()
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  return (
    <FormShell
      title={`Payment · ${sponsor.name}`}
      subtitle={`${sponsor.status} · committed ${sponsor.amount_committed ? '$' + Number(sponsor.amount_committed).toLocaleString() : 'n/a'} · paid $${Number(sponsor.amount_paid || 0).toLocaleString()}`}
      backTo="/leadership/sponsors"
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
          placeholder="250.00"
          required
          autoFocus
        />
        <Select
          label="Method"
          name="method"
          options={METHODS}
          defaultValue="check"
          required
        />
        <Field
          label="Period covered"
          name="paid_for_period"
          type="date"
          defaultValue={defaultPeriod}
          hint="Which month this payment covers (defaults to this month)"
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
