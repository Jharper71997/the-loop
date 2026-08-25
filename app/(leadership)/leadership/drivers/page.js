import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import DataTable from '../../_components/DataTable'
import StatusBadge from '../../_components/StatusBadge'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

const STATUS_COLORS = {
  prospect: { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  active:   { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  paused:   { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  inactive: { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
}

export default async function DriversPage() {
  const supabase = supabaseAdmin()
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, phone, email, status, role, started_at, notes')
    .order('status')
    .order('name')

  const columns = [
    {
      key: 'name', header: 'Name', primary: true,
      render: d => (
        <div>
          <Link href={`/leadership/drivers/${d.id}`} style={{ fontWeight: 600, color: '#e8e8ea', textDecoration: 'none' }}>{d.name}</Link>
          {d.notes && <div style={{ fontSize: 12, color: '#9c9ca3', marginTop: 2 }}>{d.notes}</div>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: d => {
        const sc = STATUS_COLORS[d.status] || STATUS_COLORS.prospect
        return <StatusBadge label={d.status} bg={sc.bg} fg={sc.fg} />
      },
    },
    { key: 'role', header: 'Role', render: d => <span style={{ textTransform: 'capitalize', color: '#9c9ca3' }}>{d.role}</span> },
    { key: 'phone', header: 'Phone', mono: true, render: d => <span style={{ color: '#9c9ca3' }}>{d.phone || '—'}</span> },
    { key: 'email', header: 'Email', hideOnMobile: true, render: d => <span style={{ color: '#9c9ca3', fontSize: 13 }}>{d.email || '—'}</span> },
    {
      key: 'started', header: 'Started', hideOnMobile: true,
      render: d => <span style={{ color: '#9c9ca3', fontSize: 13 }}>{d.started_at ? new Date(d.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>,
    },
  ]

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership" style={{
          color: '#9c9ca3', fontSize: 13, fontWeight: 500, textDecoration: 'none',
          display: 'inline-block', marginBottom: 16,
        }}>
          ← Scoreboard
        </Link>

        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 22,
        }}>
          <h1 style={{
            color: '#e8e8ea', fontFamily: FONT_BODY, fontSize: 24, fontWeight: 700,
            letterSpacing: '-0.01em', margin: 0,
          }}>
            Drivers
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/leadership/drivers/route-log" style={{
              background: 'transparent', color: '#e8e8ea', fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
              padding: '8px 14px', borderRadius: 6, textDecoration: 'none', border: '1px solid #2a2a31',
            }}>
              Route log →
            </Link>
            <Link href="/leadership/drivers/new" style={{
              background: '#d4a333', color: '#0a0a0b', fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
              padding: '8px 14px', borderRadius: 6, textDecoration: 'none',
            }}>
              + Add driver
            </Link>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={drivers || []}
          rowKey={d => d.id}
          empty={<div style={{ color: '#9c9ca3', fontSize: 14, padding: '20px 0' }}>No drivers yet. <Link href="/leadership/drivers/new" style={{ color: '#d4a333' }}>Add the first one →</Link></div>}
        />
      </div>
    </main>
  )
}
