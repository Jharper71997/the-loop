import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'
import { denyIfNotCron } from '@/lib/cronAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Every 15 min: scoop up unnotified rows from notifications, batch them into
// one email to Jacob, then mark them notified_at = now() so they don't fire
// again. No-op when there's nothing to alert on.

const ALERT_TO = process.env.ALERT_EMAIL || 'jacob@jvillebrewloop.com'
const BATCH_LIMIT = 50

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const supabase = supabaseAdmin()

  const { data: rows, error } = await supabase
    .from('notifications')
    .select('id, kind, severity, subject, body, context, created_at')
    .is('notified_at', null)
    .order('created_at', { ascending: false })
    .limit(BATCH_LIMIT)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!rows || rows.length === 0) {
    return Response.json({ ok: true, sent: 0, message: 'nothing_to_alert' })
  }

  const html = renderHtml(rows)
  const text = renderText(rows)
  const subject = rows.length === 1
    ? `[Brew Loop] ${rows[0].subject || rows[0].kind}`
    : `[Brew Loop] ${rows.length} new alerts`

  let sendResult = null
  try {
    sendResult = await sendEmail({ to: ALERT_TO, subject, html, text })
  } catch (err) {
    return Response.json({ error: `email_send: ${err.message}` }, { status: 500 })
  }

  // Mark notified — even if email's id is missing, we don't want to re-spam.
  const ids = rows.map(r => r.id)
  await supabase
    .from('notifications')
    .update({ notified_at: new Date().toISOString() })
    .in('id', ids)

  return Response.json({ ok: true, sent: rows.length, email_id: sendResult?.id })
}

function renderHtml(rows) {
  const items = rows.map(r => `
    <div style="margin:0 0 18px;padding:14px;background:#15151a;border:1px solid #2a2a31;border-radius:8px;">
      <div style="margin:0 0 6px;color:#d4a333;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">${escape(r.kind)} · ${escape(r.severity)} · ${escape(formatTime(r.created_at))}</div>
      <div style="margin:0 0 6px;color:#f5f5f7;font-size:15px;font-weight:600;">${escape(r.subject || '(no subject)')}</div>
      ${r.body ? `<pre style="margin:0;color:#bbb;font-size:12px;white-space:pre-wrap;font-family:ui-monospace,monospace;">${escape(r.body)}</pre>` : ''}
      ${r.context ? `<details style="margin:8px 0 0;color:#888;font-size:11px;"><summary style="cursor:pointer;">Context</summary><pre style="margin:6px 0 0;font-family:ui-monospace,monospace;">${escape(JSON.stringify(r.context, null, 2))}</pre></details>` : ''}
    </div>
  `).join('')
  return `<!doctype html><html><body style="margin:0;background:#0a0a0b;color:#f5f5f7;font-family:-apple-system,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 18px;color:#d4a333;font-size:18px;">Brew Loop alerts (${rows.length})</h1>
      ${items}
      <p style="margin:24px 0 0;color:#666;font-size:11px;">Open the admin notifications page to mark resolved.</p>
    </div>
  </body></html>`
}

function renderText(rows) {
  return rows.map(r => `[${r.severity}] ${r.kind} @ ${formatTime(r.created_at)}\n${r.subject || ''}\n${r.body || ''}\n`).join('\n---\n')
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Indiana/Indianapolis',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}
