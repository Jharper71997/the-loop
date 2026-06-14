import { cookies } from 'next/headers'

// The Loop admin is gated by a single shared access code (LOOP_ADMIN_CODE),
// completely separate from Brew Loop's Supabase leadership login. Entering the
// code sets an httpOnly cookie; admin pages + APIs check it here.
export const LOOP_ADMIN_COOKIE = 'loop_admin'

export async function isLoopAdmin() {
  const code = process.env.LOOP_ADMIN_CODE
  if (!code) return false
  const jar = await cookies()
  return jar.get(LOOP_ADMIN_COOKIE)?.value === code
}
