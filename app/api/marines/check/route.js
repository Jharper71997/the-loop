import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isContactVerified } from '@/lib/marinesVerify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/marines/check  { phone?, email? } -> { verified: bool }
// Client-side soft gate for the buy page: lets the rider know up front whether
// they're cleared before they fill out the form. The authoritative gate is in
// /api/checkout (kind==='marines' rejects an unverified buyer with 403), so a
// tampered "verified:true" here can't actually buy a ride.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ verified: false }, { status: 400 }) }

  const { phone, email } = body || {}
  if (!phone && !email) return Response.json({ verified: false })

  try {
    const verified = await isContactVerified(supabaseAdmin(), { phone, email })
    return Response.json({ verified: !!verified })
  } catch {
    return Response.json({ verified: false }, { status: 500 })
  }
}
