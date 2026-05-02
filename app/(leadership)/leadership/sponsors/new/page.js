import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Select, Textarea, SubmitButton } from '../../../_components/FormShell'

export const dynamic = 'force-dynamic'

const STATUSES = [
  { value: 'prospect',  label: 'Prospect' },
  { value: 'committed', label: 'Committed (signed, awaiting first payment)' },
  { value: 'paid',      label: 'Paid (active)' },
  { value: 'inactive',  label: 'Inactive' },
]

const TIERS = [
  { value: '',         label: '— None —' },
  { value: 'Platinum', label: 'Platinum' },
  { value: 'Gold',     label: 'Gold' },
  { value: 'Standard', label: 'Standard' },
]

async function createSponsor(formData) {
  'use server'
  const name = (formData.get('name') || '').toString().trim()
  if (!name) {
    redirect('/leadership/sponsors/new?error=name_required')
  }
  const contact = (formData.get('contact') || '').toString().trim() || null
  const tier = (formData.get('tier') || '').toString().trim() || null
  const monthly = parseFloat(formData.get('monthly_amount'))
  const status = (formData.get('status') || 'prospect').toString()
  const notes = (formData.get('notes') || '').toString().trim() || null

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('sponsors').insert({
    name,
    contact,
    tier,
    amount_committed: isFinite(monthly) && monthly > 0 ? monthly : null,
    status,
    notes,
  })
  if (error) {
    redirect('/leadership/sponsors/new?error=' + encodeURIComponent(error.message))
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/sponsors')
  redirect('/leadership/sponsors')
}

export default async function NewSponsorPage({ searchParams }) {
  const sp = await searchParams
  const error = sp?.error
  return (
    <FormShell
      title="Add Sponsor"
      subtitle="One-off entry for sponsors not yet in Asana"
      backTo="/leadership/sponsors"
    >
      {error && (
        <div style={{
          background: 'rgba(196,74,58,0.15)',
          border: '1px solid rgba(196,74,58,0.4)',
          color: '#f4b8ad',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 13,
          marginBottom: 14,
        }}>
          {error === 'name_required' ? 'Name is required.' : error}
        </div>
      )}
      <form action={createSponsor}>
        <Field
          label="Sponsor name"
          name="name"
          required
          autoFocus
          placeholder="Dragon Brew Cafe"
        />
        <Field
          label="Contact"
          name="contact"
          placeholder="Who's the point of contact?"
        />
        <Select
          label="Tier"
          name="tier"
          options={TIERS}
          defaultValue=""
        />
        <Field
          label="Monthly amount ($)"
          name="monthly_amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="250"
          hint="Stored as amount_committed; treated as monthly fee for outstanding tracking"
        />
        <Select
          label="Status"
          name="status"
          options={STATUSES}
          defaultValue="prospect"
          required
        />
        <Textarea
          label="Notes"
          name="notes"
          placeholder="(optional)"
        />
        <SubmitButton>Add Sponsor</SubmitButton>
      </form>
    </FormShell>
  )
}
