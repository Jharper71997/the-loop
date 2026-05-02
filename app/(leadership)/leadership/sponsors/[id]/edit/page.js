import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Select, Textarea, SubmitButton } from '../../../../_components/FormShell'

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

async function updateSponsor(id, formData) {
  'use server'
  const name = (formData.get('name') || '').toString().trim()
  if (!name) {
    redirect(`/leadership/sponsors/${id}/edit?error=name_required`)
  }
  const contact = (formData.get('contact') || '').toString().trim() || null
  const tier = (formData.get('tier') || '').toString().trim() || null
  const monthly = parseFloat(formData.get('monthly_amount'))
  const status = (formData.get('status') || 'prospect').toString()
  const notes = (formData.get('notes') || '').toString().trim() || null

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('sponsors').update({
    name,
    contact,
    tier,
    amount_committed: isFinite(monthly) && monthly > 0 ? monthly : null,
    status,
    notes,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) {
    redirect(`/leadership/sponsors/${id}/edit?error=` + encodeURIComponent(error.message))
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/sponsors')
  revalidatePath(`/leadership/sponsors/${id}`)
  redirect(`/leadership/sponsors/${id}`)
}

export default async function EditSponsorPage({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const error = sp?.error

  const supabase = supabaseAdmin()
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!sponsor) notFound()

  const action = updateSponsor.bind(null, id)

  return (
    <FormShell
      title={`Edit · ${sponsor.name}`}
      backTo={`/leadership/sponsors/${id}`}
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
      <form action={action}>
        <Field label="Sponsor name" name="name" required defaultValue={sponsor.name} />
        <Field label="Contact" name="contact" defaultValue={sponsor.contact || ''} />
        <Select label="Tier" name="tier" options={TIERS} defaultValue={sponsor.tier || ''} />
        <Field
          label="Monthly amount ($)"
          name="monthly_amount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={sponsor.amount_committed || ''}
        />
        <Select label="Status" name="status" options={STATUSES} defaultValue={sponsor.status || 'prospect'} required />
        <Textarea label="Notes" name="notes" defaultValue={sponsor.notes || ''} />
        <SubmitButton>Save changes</SubmitButton>
      </form>
    </FormShell>
  )
}
