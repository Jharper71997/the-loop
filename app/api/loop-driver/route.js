import { cookies } from 'next/headers'
import { LOOP_DRIVER_COOKIE } from '@/lib/loopDriver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/loop-driver  body: { code } — unlock The Loop driver surface with
// the shared access code. DELETE — log out. Mirrors /api/loop-admin.
export async function POST(req) {
  let body = {}
  try { body = await req.json() } catch {}
  const code = process.env.LOOP_DRIVER_CODE
  if (!code) return Response.json({ error: 'Loop driver code not configured.' }, { status: 500 })
  if (String(body?.code || '').trim() !== code) {
    return Response.json({ error: 'Wrong code.' }, { status: 401 })
  }
  const jar = await cookies()
  jar.set(LOOP_DRIVER_COOKIE, code, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  })
  return Response.json({ ok: true })
}

export async function DELETE() {
  const jar = await cookies()
  jar.delete(LOOP_DRIVER_COOKIE)
  return Response.json({ ok: true })
}
