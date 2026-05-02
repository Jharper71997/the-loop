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

const ROLES = [
  { value: 'driver',  label: 'Driver' },
  { value: 'liaison', label: 'Liaison' },
  { value: 'both',    label: 'Both (driver + liaison)' },
]

async function updateDriver(id, formData) {
  'use server'
  const name = (formData.get('name') || '').toString().trim()
  if (!name) {
    redirect(`/leadership/drivers/${id}/edit?error=name_required`)
  }
  const phone = (formData.get('phone') || '').toString().trim() || null
  const email = (formData.get('email') || '').toString().trim() || null
  const status = (formData.get('status') || 'prospect').toString()
  const role = (formData.get('role') || 'driver').toString()
  const notes = (formData.get('notes') || '').toString().trim() || null

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('drivers').update({
    name, phone, email, status, role, notes,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) {
    redirect(`/leadership/drivers/${id}/edit?error=` + encodeURIComponent(error.message))
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/drivers')
  revalidatePath(`/leadership/drivers/${id}`)
  redirect(`/leadership/drivers/${id}`)
}

export default async function EditDriverPage({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const error = sp?.error

  const supabase = supabaseAdmin()
  const { data: driver } = await supabase.from('drivers').select('*').eq('id', id).maybeSingle()
  if (!driver) notFound()

  const action = updateDriver.bind(null, id)

  return (
    <FormShell title={`Edit · ${driver.name}`} backTo={`/leadership/drivers/${id}`}>
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
        <Field label="Name" name="name" required defaultValue={driver.name} />
        <Field label="Phone" name="phone" defaultValue={driver.phone || ''} />
        <Field label="Email" name="email" type="email" defaultValue={driver.email || ''} />
        <Select label="Status" name="status" options={STATUSES} defaultValue={driver.status || 'prospect'} required />
        <Select label="Role" name="role" options={ROLES} defaultValue={driver.role || 'driver'} required />
        <Textarea label="Notes" name="notes" defaultValue={driver.notes || ''} />
        <SubmitButton>Save changes</SubmitButton>
      </form>
    </FormShell>
  )
}
