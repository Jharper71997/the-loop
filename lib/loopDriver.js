import { cookies } from 'next/headers'

// The Loop driver surface is gated by a shared access code (LOOP_DRIVER_CODE),
// separate from both Brew Loop's Supabase driver login AND the Loop admin code.
// A driver enters the code on their phone; the driver page + the loop-driver
// APIs check it here. Mirrors lib/loopAdmin so the standalone (loop) product
// never depends on a Supabase session.
export const LOOP_DRIVER_COOKIE = 'loop_driver'

export async function isLoopDriver() {
  const code = process.env.LOOP_DRIVER_CODE
  if (!code) return false
  const jar = await cookies()
  return jar.get(LOOP_DRIVER_COOKIE)?.value === code
}
