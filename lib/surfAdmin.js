import { cookies } from 'next/headers'

// Surf City Loop admin is gated by a single shared access code (SURF_ADMIN_CODE),
// separate from Brew Loop's Supabase leadership login AND from the Marines
// LOOP_ADMIN_CODE. Mirrors lib/loopAdmin so the Surf console never depends on a
// Supabase session. Entering the code sets an httpOnly cookie; Surf admin pages
// + /api/surf-admin/* check it here.
export const SURF_ADMIN_COOKIE = 'surf_admin'

export async function isSurfAdmin() {
  const code = process.env.SURF_ADMIN_CODE
  if (!code) return false
  const jar = await cookies()
  return jar.get(SURF_ADMIN_COOKIE)?.value === code
}
