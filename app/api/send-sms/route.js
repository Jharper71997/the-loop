import { sendSms } from '@/lib/sms'
import { denyIfNotAdmin } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Manual SMS route used by the broadcast composers (Loops/Groups, Contacts,
// per-rider Text button). Open to any provisioned admin-tier role (leadership,
// security, drivers) so the people actually running the night can text riders
// without first being added to the leadership allowlist. Anonymous traffic is
// still rejected.
export async function POST(req) {
  const denied = await denyIfNotAdmin()
  if (denied) return denied

  const { to, message } = await req.json()
  try {
    await sendSms(to, message)
    return Response.json({ success: true })
  } catch (error) {
    // Log the SimpleTexting failure body so Vercel runtime logs surface the
    // real reason on the next outage; the UI only sees `send_failed`.
    console.error('[send-sms] failed:', error?.message || error)
    return Response.json({
      success: false,
      error: 'send_failed',
      detail: String(error?.message || error || '').slice(0, 300),
    }, { status: 500 })
  }
}
