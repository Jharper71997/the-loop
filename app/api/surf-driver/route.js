import { cookies } from 'next/headers'
import { SURF_DRIVER_COOKIE } from '@/lib/surfDriver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/surf-driver  body: { code } — unlock the Surf City Loop driver
// surface with the shared access code. DELETE — log out. Mirrors /api/loop-driver.
export async function POST(req) {
  let body = {}
  try { body = await req.json() } catch {}
  const code = process.env.SURF_DRIVER_CODE
  if (!code) return Response.json({ error: 'Surf driver code not configured.' }, { status: 500 })
  if (String(body?.code || '').trim() !== code) {
    return Response.json({ error: 'Wrong code.' }, { status: 401 })
  }
  const jar = await cookies()
  jar.set(SURF_DRIVER_COOKIE, code, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  })
  return Response.json({ ok: true })
}

export async function DELETE() {
  const jar = await cookies()
  jar.delete(SURF_DRIVER_COOKIE)
  return Response.json({ ok: true })
}
