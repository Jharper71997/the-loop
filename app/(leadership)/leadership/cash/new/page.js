import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, SubmitButton, Textarea } from '../../../_components/FormShell'

export const dynamic = 'force-dynamic'

async function submitBalance(formData) {
  'use server'
  const dollarsRaw = formData.get('balance')
  const account = (formData.get('account_name') || 'NFCU').toString().trim()
  const notes = (formData.get('notes') || '').toString().trim() || null
  const dollars = parseFloat(dollarsRaw)
  if (!isFinite(dollars) || dollars < 0) {
    redirect('/leadership/cash/new?error=invalid')
  }
  const supabase = supabaseAdmin()
  const { error } = await supabase.from('bank_balances').insert({
    account_name: account,
    balance_cents: Math.round(dollars * 100),
    notes,
  })
  if (error) {
    redirect('/leadership/cash/new?error=' + encodeURIComponent(error.message))
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/cash')
  redirect('/leadership/cash')
}

export default async function NewCashPage({ searchParams }) {
  const params = await searchParams
  const error = params?.error
  // Pre-fill account name from most recent entry if any.
  const supabase = supabaseAdmin()
  const { data: latest } = await supabase
    .from('bank_balances')
    .select('account_name')
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle()
  const defaultAccount = latest?.account_name || 'NFCU'

  return (
    <FormShell
      title="Record Bank Balance"
      subtitle="Quick weekly snapshot · ~30 sec"
      backTo="/leadership/cash"
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
          {error === 'invalid' ? 'Enter a valid balance.' : error}
        </div>
      )}
      <form action={submitBalance}>
        <Field
          label="Balance ($)"
          name="balance"
          type="number"
          step="0.01"
          min="0"
          placeholder="2586.00"
          required
          autoFocus
          hint="Total cash on hand right now"
        />
        <Field
          label="Account"
          name="account_name"
          defaultValue={defaultAccount}
          required
          hint="Which account this balance is for"
        />
        <Textarea
          label="Notes"
          name="notes"
          placeholder="(optional)"
        />
        <SubmitButton>Save Balance</SubmitButton>
      </form>
    </FormShell>
  )
}
