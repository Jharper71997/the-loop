import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Select, Textarea, SubmitButton } from '../../../../_components/FormShell'

export const dynamic = 'force-dynamic'

const STATUSES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active',   label: 'Active' },
  { value: 'paused',   label: 'Paused' },
  { value: 'inactive', label: 'Inactive' },
]

const METHODS = [
  { value: 'check',   label: 'Check' },
  { value: 'cash',    label: 'Cash' },
  { value: 'venmo',   label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'stripe',  label: 'Stripe / Card' },
  { value: 'other',   label: 'Other' },
]

async function updateBar(slug, formData) {
  'use server'
  const name = (formData.get('name') || '').toString().trim()
  if (!name) {
    redirect(`/leadership/bars/${slug}/edit?error=name_required`)
  }
  const monthly = parseFloat(formData.get('monthly_fee'))
  const monthlyCents = isFinite(monthly) && monthly >= 0 ? Math.round(monthly * 100) : 0
  const payment_method = (formData.get('payment_method') || 'check').toString()
  const status = (formData.get('status') || 'prospect').toString()
  const contact_name = (formData.get('contact_name') || '').toString().trim() || null
  const contact_phone = (formData.get('contact_phone') || '').toString().trim() || null
  const contact_email = (formData.get('contact_email') || '').toString().trim() || null
  const notes = (formData.get('notes') || '').toString().trim() || null

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('bars').update({
    name,
    monthly_fee_cents: monthlyCents,
    payment_method,
    status,
    contact_name,
    contact_phone,
    contact_email,
    notes,
    updated_at: new Date().toISOString(),
  }).eq('slug', slug)
  if (error) {
    redirect(`/leadership/bars/${slug}/edit?error=` + encodeURIComponent(error.message))
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/bars')
  revalidatePath(`/leadership/bars/${slug}`)
  redirect(`/leadership/bars/${slug}`)
}

export default async function EditBarPage({ params, searchParams }) {
  const { slug } = await params
  const sp = await searchParams
  const error = sp?.error

  const supabase = supabaseAdmin()
  const { data: bar } = await supabase.from('bars').select('*').eq('slug', slug).maybeSingle()
  if (!bar) notFound()

  const action = updateBar.bind(null, slug)

  return (
    <FormShell title={`Edit · ${bar.name}`} backTo={`/leadership/bars/${slug}`}>
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
        <Field label="Bar name" name="name" required defaultValue={bar.name} />
        <Field
          label="Monthly fee ($)"
          name="monthly_fee"
          type="number"
          step="0.01"
          min="0"
          defaultValue={bar.monthly_fee_cents > 0 ? (bar.monthly_fee_cents / 100).toFixed(2) : ''}
        />
        <Select label="Payment method" name="payment_method" options={METHODS} defaultValue={bar.payment_method || 'check'} required />
        <Select label="Status" name="status" options={STATUSES} defaultValue={bar.status || 'prospect'} required />
        <Field label="Contact name" name="contact_name" defaultValue={bar.contact_name || ''} />
        <Field label="Contact phone" name="contact_phone" defaultValue={bar.contact_phone || ''} />
        <Field label="Contact email" name="contact_email" type="email" defaultValue={bar.contact_email || ''} />
        <Textarea label="Notes" name="notes" defaultValue={bar.notes || ''} />
        <SubmitButton>Save changes</SubmitButton>
      </form>
    </FormShell>
  )
}
