import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { MARINES_VERIFIED_COOKIE } from '@/lib/marines'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/marines/verify  { firstName, lastName, phone, email?, dodId }
//
// Instant military verification for The Loop (Marines). A valid 10-digit DoD ID
// (EDIPI, off the back of the military ID) clears the rider to ride — the driver
// still checks the physical card at the door, which is the real gate. We DO NOT
// store the DoD ID (OPSEC): it's used only to gate this request. We set the
// contact's military_verified flag, keep a no-number audit row, and drop a cookie
// so the checkout flow knows they're cleared without re-collecting anything.
//
// Public route (under /api/marines/, whitelisted in middleware) — no login.

const DOD_RE = /^\d{10}$/

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }

  const firstName = String(body?.firstName || '').trim()
  const lastName = String(body?.lastName || '').trim()
  const phone = normalizePhone(body?.phone)
  const email = normalizeEmail(body?.email)
  const dodId = String(body?.dodId || '').replace(/\D/g, '')

  if (!firstName) return Response.json({ error: 'Enter your first name.' }, { status: 400 })
  if (!phone) return Response.json({ error: 'Enter the phone number you can be reached at.' }, { status: 400 })
  if (!DOD_RE.test(dodId)) {
    return Response.json(
      { error: 'Your DoD ID is the 10-digit number on the back of your military ID (CAC).' },
      { status: 400 }
    )
  }

  const sb = supabaseAdmin()

  const contact = await upsertContactByPhoneOrEmail(sb, { firstName, lastName, email, phone })
  if (!contact?.id) {
    return Response.json({ error: 'Could not save your info. Try again.' }, { status: 500 })
  }

  const nowIso = new Date().toISOString()
  const { error: upErr } = await sb
    .from('contacts')
    .update({
      military_verified: true,
      military_verified_at: nowIso,
      military_branch: 'USMC',
      // DoD ID intentionally NOT stored (OPSEC) — it only gated this request.
    })
    .eq('id', contact.id)
  if (upErr) {
    // Most likely cause: migration 033 hasn't been run (missing military_verified
    // columns). Surface it so it's obvious.
    return Response.json({ error: 'verify_write_failed', detail: upErr.message }, { status: 500 })
  }

  // Keep an auditable verification record (WHO cleared + WHEN), but never the DoD
  // ID itself.
  await sb.from('military_verifications').insert({
    contact_id: contact.id,
    full_name: `${firstName} ${lastName}`.trim(),
    email,
    phone,
    branch: 'USMC',
    status: 'approved',
    method: 'self',
    reviewed_at: nowIso,
    reviewed_by: 'self:dod_id',
  })

  const jar = await cookies()
  jar.set(MARINES_VERIFIED_COOKIE, contact.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 120, // ~4 months; they verify once
  })

  return Response.json({ ok: true, contactId: contact.id, firstName })
}
