import { sendSms } from '@/lib/sms'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Internal-only test/manual SMS route. Leadership-only because each call
// costs money; we don't want any logged-in staff (or a CSRF'd staff session)
// burning SimpleTexting credits.
export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const { to, message } = await req.json()
  try {
    await sendSms(to, message)
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ success: false, error: 'send_failed' }, { status: 500 })
  }
}
