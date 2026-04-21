import { sendSms } from '@/lib/sms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  const { to, message } = await req.json()
  try {
    await sendSms(to, message)
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
