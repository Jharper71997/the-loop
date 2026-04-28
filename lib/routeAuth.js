import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isLeadership } from './roles'

// Returns null if the request is from a leadership-tier user (Jacob/Richard
// or whoever is on NEXT_PUBLIC_LEADERSHIP_EMAILS), or a Response to return
// immediately if not. Use this on internal-only POST routes that the public
// site doesn't call but a logged-in staff user could otherwise hit.
//
// Middleware already requires a Supabase login for non-PUBLIC_PREFIXES paths,
// so by the time we get here the cookie is set. We just have to confirm the
// email is in the leadership allowlist.
export async function denyIfNotLeadership() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // route-handler context, no need to write back
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  if (!isLeadership(user.email)) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  return null
}
