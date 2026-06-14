import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '../../_components/StatCard'
import StatusBadge from '../../_components/StatusBadge'
import DataTable from '../../_components/DataTable'
import { PASS_PLANS } from '@/lib/loopPass'

export const metadata = { title: 'Loop Pass — The Loop' }
export const dynamic = 'force-dynamic'

const STATUS_TONE = { active: 'green', past_due: 'gold', canceled: 'grey' }

function planLabel(plan) {
  return PASS_PLANS[plan]?.label || (plan || '').replace(/^\w/, c => c.toUpperCase())
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return '—' }
}

export default async function PassesPage() {
  const supabase = supabaseAdmin()

  const { data: passes } = await supabase
    .from('loop_passes')
    .select('id, plan, status, current_period_end, created_at, contacts ( first_name, last_name, phone, email )')
    .order('created_at', { ascending: false })

  const all = passes || []
  const active = all.filter(p => p.status === 'active')
  const pastDue = all.filter(p => p.status === 'past_due')
  const monthlyActive = active.filter(p => p.plan === 'monthly').length
  const seasonActive = active.filter(p => p.plan === 'season').length

  const rows = all.map(p => {
    const c = p.contacts || {}
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || '(unknown rider)'
    return {
      key: p.id,
      name,
      contact: c.phone || c.email || '—',
      plan: p.plan,
      status: p.status,
      renews: p.current_period_end,
      started: p.created_at,
    }
  })

  const columns = [
    { key: 'name', header: 'Rider', primary: true },
    { key: 'contact', header: 'Contact', hideOnMobile: true },
    { key: 'plan', header: 'Plan', render: r => planLabel(r.plan) },
    { key: 'status', header: 'Status', render: r => <StatusBadge label={r.status.replace('_', ' ')} tone={STATUS_TONE[r.status] || 'grey'} /> },
    { key: 'renews', header: 'Renews', mono: true, render: r => fmtDate(r.renews) },
    { key: 'started', header: 'Started', mono: true, hideOnMobile: true, render: r => fmtDate(r.started) },
  ]

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership" style={backLink}>← Scoreboard</Link>

        <div style={headerRow}>
          <h1 style={h1Style}>Loop Pass</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 22 }}>
          <StatCard label="Active passes" value={active.length} tone="ok" />
          <StatCard label="Monthly" value={monthlyActive} />
          <StatCard label="Season" value={seasonActive} />
          <StatCard label="Past due" value={pastDue.length} tone={pastDue.length ? 'err' : 'dim'} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => r.key}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>
            No Loop Passes sold yet. Riders subscribe at <span style={{ color: '#d4a333' }}>/pass</span>.
          </div>}
        />
      </div>
    </main>
  )
}

const mainStyle = {
  minHeight: '100vh',
  background: '#0a0a0b',
  color: '#e8e8ea',
  padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
  paddingLeft: 'max(16px, env(safe-area-inset-left))',
  paddingRight: 'max(16px, env(safe-area-inset-right))',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}
const backLink = {
  color: '#9c9ca3', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
  textDecoration: 'none', display: 'inline-block', marginBottom: 18,
}
const headerRow = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
  gap: 12, flexWrap: 'wrap', marginBottom: 18,
}
const h1Style = {
  color: '#e8e8ea', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0,
}
