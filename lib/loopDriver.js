import { cookies } from 'next/headers'

// Legacy: the old standalone Loop driver surface was gated by a shared access
// code (LOOP_DRIVER_CODE), separate from Brew Loop's Supabase driver login. The
// new Marines driver page (/loop/driver) is email-gated like the rest of the
// console; this remains only as a fallback authorizer for /api/shuttle/ping and
// is inert unless LOOP_DRIVER_CODE is set.
export const LOOP_DRIVER_COOKIE = 'loop_driver'

export async function isLoopDriver() {
  const code = process.env.LOOP_DRIVER_CODE
  if (!code) return false
  const jar = await cookies()
  return jar.get(LOOP_DRIVER_COOKIE)?.value === code
}
