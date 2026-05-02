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

const ROLES = [
  { value: 'driver',  label: 'Driver' },
  { value: 'liaison', label: 'Liaison' },
  { value: 'both',    label: 'Both (driver + liaison)' },
]

async function createDriver(formData) {
  'use server'
  const name = (formData.get('name') || '').toString().trim()
  if (!name) {
    redirect('/leadership/drivers/new?error=name_required')
  }
  const phone = (formData.get('phone') || '').toString().trim() || null
  const email = (formData.get('email') || '').toString().trim() || null
  const status = (formData.get('status') || 'prospect').toString()
  const role = (formData.get('role') || 'driver').toString()
  const notes = (formData.get('notes') || '').toString().trim() || null

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('drivers').insert({
    name,
    phone,
    email,
    status,
    role,
    started_at: status === 'active' ? new Date().toISOString().slice(0, 10) : null,
    notes,
  })
  if (error) {
    redirect('/leadership/drivers/new?error=' + encodeURIComponent(error.message))
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/drivers')
  redirect('/leadership/drivers')
}

export default async function NewDriverPage({ searchParams }) {
  const sp = await searchParams
  const error = sp?.error
  return (
    <FormShell
      title="Add Driver"
      subtitle="Driver / liaison roster"
      backTo="/leadership/drivers"
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
      <form action={createDriver}>
        <Field label="Name" name="name" required autoFocus placeholder="Hoenish" />
        <Field label="Phone" name="phone" placeholder="(910) 555-0123" />
        <Field label="Email" name="email" type="email" />
        <Select label="Status" name="status" options={STATUSES} defaultValue="prospect" required />
        <Select label="Role" name="role" options={ROLES} defaultValue="driver" required />
        <Textarea label="Notes" name="notes" placeholder="(optional)" />
        <SubmitButton>Add Driver</SubmitButton>
      </form>
    </FormShell>
  )
}
