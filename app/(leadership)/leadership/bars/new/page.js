import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Select, Textarea, SubmitButton } from '../../../_components/FormShell'

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

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function createBar(formData) {
  'use server'
  const name = (formData.get('name') || '').toString().trim()
  if (!name) {
    redirect('/leadership/bars/new?error=name_required')
  }
  let slug = (formData.get('slug') || '').toString().trim()
  if (!slug) slug = slugify(name)
  if (!slug) {
    redirect('/leadership/bars/new?error=slug_required')
  }
  const monthly = parseFloat(formData.get('monthly_fee'))
  const monthlyCents = isFinite(monthly) && monthly > 0 ? Math.round(monthly * 100) : 0
  const payment_method = (formData.get('payment_method') || 'check').toString()
  const status = (formData.get('status') || 'prospect').toString()
  const contact_name = (formData.get('contact_name') || '').toString().trim() || null
  const contact_phone = (formData.get('contact_phone') || '').toString().trim() || null
  const contact_email = (formData.get('contact_email') || '').toString().trim() || null
  const notes = (formData.get('notes') || '').toString().trim() || null

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('bars').insert({
    slug,
    name,
    status,
    monthly_fee_cents: monthlyCents,
    payment_method,
    contact_name,
    contact_phone,
    contact_email,
    started_at: status === 'active' ? new Date().toISOString().slice(0, 10) : null,
    notes,
  })
  if (error) {
    if (error.code === '23505') {
      redirect('/leadership/bars/new?error=slug_taken')
    }
    redirect('/leadership/bars/new?error=' + encodeURIComponent(error.message))
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/bars')
  redirect('/leadership/bars')
}

export default async function NewBarPage({ searchParams }) {
  const sp = await searchParams
  const error = sp?.error
  return (
    <FormShell
      title="Add Bar"
      subtitle="Add a new partner bar to the financial roster"
      backTo="/leadership/bars"
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
          {error === 'name_required' ? 'Name is required.'
            : error === 'slug_required' ? 'Slug is required and could not be auto-derived from the name.'
            : error === 'slug_taken' ? 'A bar with that slug already exists.'
            : error}
        </div>
      )}
      <form action={createBar}>
        <Field
          label="Bar name"
          name="name"
          required
          autoFocus
          placeholder="The Angry Ginger"
        />
        <Field
          label="Slug"
          name="slug"
          placeholder="angry-ginger"
          hint="Auto-derived from name if blank. Lowercase, dashes only. Used in URLs and FK joins."
        />
        <Field
          label="Monthly fee ($)"
          name="monthly_fee"
          type="number"
          step="0.01"
          min="0"
          placeholder="300"
          hint="What they pay per month. Used for outstanding-this-month tracking."
        />
        <Select
          label="Payment method"
          name="payment_method"
          options={METHODS}
          defaultValue="check"
          required
        />
        <Select
          label="Status"
          name="status"
          options={STATUSES}
          defaultValue="prospect"
          required
        />
        <Field label="Contact name" name="contact_name" />
        <Field label="Contact phone" name="contact_phone" />
        <Field label="Contact email" name="contact_email" type="email" />
        <Textarea label="Notes" name="notes" placeholder="(optional)" />
        <SubmitButton>Add Bar</SubmitButton>
      </form>
    </FormShell>
  )
}
