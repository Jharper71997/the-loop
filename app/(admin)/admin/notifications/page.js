import { supabaseAdmin } from '@/lib/supabaseAdmin'
import NotificationsClient from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = supabaseAdmin()

  const { data: rows } = await supabase
    .from('notifications')
    .select('id, kind, severity, subject, body, context, created_at, notified_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <main>
      <h1 style={{ margin: 0 }}>Alerts</h1>
      <p className="muted" style={{ margin: '6px 0 14px' }}>
        Last 200 system alerts. SMS / email failures, webhook errors, and
        post-payment fan-out problems land here.
      </p>
      <NotificationsClient initial={rows || []} />
    </main>
  )
}
