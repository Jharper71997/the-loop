import { NextResponse } from 'next/server'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// One-time / on-demand pull of sponsors from the Asana Lead Mgmt project.
// Project GID and section/field GIDs are pinned per memory:
//   reference_asana_lead_management.md

const ASANA_PROJECT_GID = '1212841090558432'

const SECTION_TO_STATUS = {
  '1212801113929851': 'paid',       // Current Sponsors (was "Sold")
  '1212801113929850': 'committed',  // Hot 0-7 Days
  '1212841090558437': 'committed',  // Agreement Sent 7-30 Days
  '1212909270382148': 'prospect',   // Prospect Responded, paperwork, no meeting
  '1212841090558435': 'prospect',   // New - No Contact/Answer
  '1212841090558436': 'prospect',   // Prospects - contact, no appointment
  '1212841090558438': 'prospect',   // Nurture 3-6 month
  '1212801113929816': 'inactive',   // Cold
  // '1213892010959470' (Bar owner/contacts) and '1212841090558433' (Helpful info)
  // are intentionally absent — those are bars / docs, not sponsors.
}

const FIELD = {
  industry:           '1212841174841244',
  contactName:        '1212841174841249',
  role:               '1212841174841254',
  phone:              '1212841174841259',
  email:              '1212841174841264',
  sponsorshipLevel:   '1212841174841269',
  priority:           '1212801798360990',
}

// Tier-derived monthly amount fallback. Used when the row has no
// existing amount_committed in the DB.
const TIER_DEFAULT_MONTHLY = {
  Platinum: 500,
  Gold:     250,
  Standard: 150,
}

function fieldByGid(custom_fields, gid) {
  const f = (custom_fields || []).find(c => c.gid === gid)
  if (!f) return null
  return f.text_value ?? f.enum_value?.name ?? null
}

export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const token = process.env.ASANA_PERSONAL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({
      ok: false,
      error: 'ASANA_PERSONAL_ACCESS_TOKEN not configured. Add it to Vercel env vars to enable sync. In the meantime sponsors can be added via /leadership/sponsors/new or seeded with the SQL block in the v1.5 plan.',
    }, { status: 400 })
  }

  // Fetch all tasks in the Lead Mgmt project with the custom fields + section we need.
  const url = new URL(`https://app.asana.com/api/1.0/projects/${ASANA_PROJECT_GID}/tasks`)
  url.searchParams.set('opt_fields',
    'name,memberships.section.gid,memberships.section.name,custom_fields.gid,custom_fields.text_value,custom_fields.enum_value.name'
  )
  url.searchParams.set('limit', '100')

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ ok: false, error: `Asana API error ${res.status}: ${text}` }, { status: 502 })
  }
  const { data: tasks } = await res.json()

  const supabase = supabaseAdmin()
  const summary = { fetched: tasks.length, inserted: 0, updated: 0, skipped: 0 }

  for (const t of tasks) {
    const sectionGid = t.memberships?.[0]?.section?.gid
    const status = SECTION_TO_STATUS[sectionGid]
    if (!status) { summary.skipped += 1; continue }

    const name = (t.name || '').trim()
    if (!name) { summary.skipped += 1; continue }

    const tier = fieldByGid(t.custom_fields, FIELD.sponsorshipLevel)
    const contactName = fieldByGid(t.custom_fields, FIELD.contactName)
    const phone = fieldByGid(t.custom_fields, FIELD.phone)
    const email = fieldByGid(t.custom_fields, FIELD.email)
    const industry = fieldByGid(t.custom_fields, FIELD.industry)

    // Existing row check — match by name (case-insensitive), don't overwrite
    // amount_paid or status if it's already moved past prospect.
    const { data: existing } = await supabase
      .from('sponsors')
      .select('id, status, amount_committed, amount_paid')
      .ilike('name', name)
      .maybeSingle()

    const monthlyDefault = tier ? TIER_DEFAULT_MONTHLY[tier] : null
    const incomingCommitted = existing?.amount_committed ?? monthlyDefault

    const contactBlob = [contactName, phone, email].filter(Boolean).join(' · ') || null
    const notes = industry ? `Industry: ${industry}` : null

    if (existing) {
      const finalStatus = (existing.status === 'paid') ? 'paid' : status
      await supabase.from('sponsors').update({
        contact: contactBlob,
        tier: tier || null,
        amount_committed: incomingCommitted,
        status: finalStatus,
        notes: existing.notes || notes,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
      summary.updated += 1
    } else {
      await supabase.from('sponsors').insert({
        name,
        contact: contactBlob,
        tier: tier || null,
        amount_committed: incomingCommitted,
        status,
        notes,
      })
      summary.inserted += 1
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
