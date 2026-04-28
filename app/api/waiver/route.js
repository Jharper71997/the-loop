import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordSignature, getCurrentWaiverVersion, contactHasSignedCurrent } from '@/lib/waiver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/waiver?contact_id=...
// Public: returns the current waiver text + whether this contact has signed it.
export async function GET(req) {
  const url = new URL(req.url)
  const contactId = url.searchParams.get('contact_id')
  const supabase = supabaseAdmin()

  const current = await getCurrentWaiverVersion(supabase)
  if (!current) return Response.json({ error: 'waiver_not_configured' }, { status: 500 })

  let alreadySigned = false
  let contactName = null
  if (contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('id', contactId)
      .maybeSingle()
    if (contact) {
      contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null
      alreadySigned = await contactHasSignedCurrent(supabase, contact.id)
    }
  }

  return Response.json({
    waiver: { id: current.id, version: current.version, body_md: current.body_md },
    contact_name: contactName,
    already_signed: alreadySigned,
  })
}

// POST /api/waiver  { contact_id, typed_name }
// Standalone signing flow used by the SMS-link page (/waiver/[contactId]).
export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const contactId = body.contact_id
  const typedName = (body.typed_name || '').trim()
  if (!contactId || !typedName) {
    return Response.json({ error: 'contact_id and typed_name required' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .maybeSingle()
  if (!contact) return Response.json({ error: 'contact not found' }, { status: 404 })

  try {
    const version = await recordSignature(supabase, {
      contactId: contact.id,
      fullNameTyped: typedName,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: req.headers.get('user-agent') || null,
    })
    return Response.json({ ok: true, version: version.version })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
