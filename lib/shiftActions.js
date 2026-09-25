'use server'

// Assign / unassign crew on a weekend night from the staff console
// (/admin/schedule). The whole crew can open that page, so unlike the
// /leadership pages there is no middleware wall in front of these actions —
// the leadership check has to happen here, on the server, every call.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from './supabaseAdmin'
import { isLeadership } from './roles'
import { pushShiftToGCal, deleteShiftFromGCal } from './googleCalendar'

const PAGE = '/admin/schedule'

async function requireLeadership() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isLeadership(user.email)) redirect(PAGE + '?error=forbidden')
}

function refresh() {
  revalidatePath(PAGE)
  revalidatePath('/leadership/schedule')
  revalidatePath('/leadership/drivers')
}

export async function addCrewShift(formData) {
  await requireLeadership()

  const shift_date = (formData.get('shift_date') || '').toString()
  const night = (formData.get('night') || '').toString()
  const role = (formData.get('role') || '').toString()
  const driverIdRaw = (formData.get('driver_id') || '').toString()
  let driver_id = driverIdRaw && driverIdRaw !== 'custom' ? driverIdRaw : null
  const customName = (formData.get('person_name') || '').toString().trim()
  const notes = (formData.get('notes') || '').toString().trim() || null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(shift_date) || !['fri', 'sat'].includes(night) || !['driver', 'security'].includes(role)) {
    redirect(PAGE + '?error=invalid')
  }

  const supabase = supabaseAdmin()
  let person_name = customName
  if (driver_id) {
    const { data: d } = await supabase.from('drivers').select('name').eq('id', driver_id).maybeSingle()
    if (d?.name) person_name = d.name
  }
  if (!person_name) redirect(PAGE + '?error=name_required')

  // A typed name joins the roster so next weekend it's in the dropdown.
  // Case-insensitive match first: "doug" and "Doug" are one person.
  if (!driver_id) {
    const { data: matches } = await supabase
      .from('drivers')
      .select('id, name, status')
      .ilike('name', person_name)
      .limit(1)
    const match = matches?.[0]
    if (match) {
      driver_id = match.id
      person_name = match.name
      if (match.status !== 'active') {
        await supabase.from('drivers').update({ status: 'active' }).eq('id', match.id)
      }
    } else {
      const { data: created } = await supabase
        .from('drivers')
        .insert({
          name: person_name,
          status: 'active',
          role: role === 'security' ? 'liaison' : 'driver',
          started_at: new Date().toISOString().slice(0, 10),
          notes: 'Added from the crew schedule',
        })
        .select('id')
        .single()
      if (created?.id) driver_id = created.id
    }
  }

  const { data: inserted, error } = await supabase
    .from('staff_shifts')
    .insert({ shift_date, night, role, driver_id, person_name, notes })
    .select()
    .single()
  if (error) redirect(PAGE + '?error=' + encodeURIComponent(error.message))

  const eventId = await pushShiftToGCal(inserted)
  if (eventId) {
    await supabase.from('staff_shifts').update({ gcal_event_id: eventId }).eq('id', inserted.id)
  }

  refresh()
  redirect(PAGE)
}

export async function removeCrewShift(formData) {
  await requireLeadership()

  const id = (formData.get('id') || '').toString()
  if (!id) redirect(PAGE)

  const supabase = supabaseAdmin()
  const { data: existing } = await supabase
    .from('staff_shifts')
    .select('id, gcal_event_id')
    .eq('id', id)
    .maybeSingle()

  if (existing?.gcal_event_id) await deleteShiftFromGCal(existing.gcal_event_id)
  await supabase.from('staff_shifts').delete().eq('id', id)

  refresh()
  redirect(PAGE)
}
