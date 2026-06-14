import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { appUrl } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /invite/<code> — a rider's personal referral link. Validates the code,
// lands the visitor on the events list, and drops a durable cookie so the
// referrer gets credit even after the visitor browses to a specific loop. The
// credit is leaderboard-only (no discount is applied to the friend's order).
export async function GET(req, { params }) {
  const { code } = await params
  const clean = String(code || '').trim().toUpperCase()
  const base = appUrl(req.headers.get('origin') || req.headers.get('referer'))

  let valid = false
  if (clean) {
    try {
      const sb = supabaseAdmin()
      const { data } = await sb
        .from('contacts')
        .select('id')
        .eq('referral_code', clean)
        .maybeSingle()
      valid = !!data
    } catch (err) {
      console.error('[invite] lookup failed', err)
    }
  }

  const dest = new URL('/events', base)
  if (valid) dest.searchParams.set('rref', clean)
  const res = NextResponse.redirect(dest)
  if (valid) {
    res.cookies.set('bl_rref', clean, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
      path: '/',
    })
  }
  return res
}
