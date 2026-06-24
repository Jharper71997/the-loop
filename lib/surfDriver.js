import { cookies } from 'next/headers'

// Surf City Loop driver surface is gated by a shared access code
// (SURF_DRIVER_CODE), separate from Brew's Supabase driver login, the Marines
// LOOP_DRIVER_CODE, and the Surf admin code. Mirrors lib/loopDriver.
export const SURF_DRIVER_COOKIE = 'surf_driver'

export async function isSurfDriver() {
  const code = process.env.SURF_DRIVER_CODE
  if (!code) return false
  const jar = await cookies()
  return jar.get(SURF_DRIVER_COOKIE)?.value === code
}
