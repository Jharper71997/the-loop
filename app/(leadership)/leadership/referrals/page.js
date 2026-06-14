import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '../../_components/StatCard'
import DataTable from '../../_components/DataTable'

export const metadata = { title: 'Rider Referrals — The Loop' }
export const dynamic = 'force-dynamic'

export default async function ReferralsPage() {
  const supabase = supabaseAdmin()

  // Count confirmed (paid) bookings per referrer, then resolve names. Two simple
  // queries dodge the two-FK ambiguity between orders.contact_id and
  // orders.referrer_contact_id when embedding contacts.
  const { data: orders } = await supabase
    .from('orders')
    .select('referrer_contact_id, party_size, total_cents')
    .eq('status', 'paid')
    .not('referrer_contact_id', 'is', null)
    .limit(10000)

  const counts = new Map() // contactId -> { referrals, riders }
  for (const o of orders || []) {
    const c = counts.get(o.referrer_contact_id) || { referrals: 0, riders: 0 }
    c.referrals += 1
    c.riders += o.party_size || 1
    counts.set(o.referrer_contact_id, c)
  }

  const ids = [...counts.keys()]
  let contactsById = new Map()
  if (ids.length) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, referral_code')
      .in('id', ids)
    contactsById = new Map((contacts || []).map(c => [c.id, c]))
  }

  const rows = ids
    .map(id => {
      const c = contactsById.get(id) || {}
      const stat = counts.get(id)
      return {
        key: id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || '(unknown rider)',
        contact: c.phone || '—',
        code: c.referral_code || '—',
        referrals: stat.referrals,
        riders: stat.riders,
      }
    })
    .sort((a, b) => b.referrals - a.referrals)

  const totalReferralBookings = rows.reduce((s, r) => s + r.referrals, 0)
  const totalRiders = rows.reduce((s, r) => s + r.riders, 0)

  const columns = [
    { key: 'rank', header: '#', mono: true, render: (r) => rows.indexOf(r) + 1 },
    { key: 'name', header: 'Rider', primary: true },
    { key: 'contact', header: 'Phone', hideOnMobile: true, mono: true },
    { key: 'code', header: 'Code', mono: true, hideOnMobile: true },
    { key: 'referrals', header: 'Bookings', mono: true, align: 'right' },
    { key: 'riders', header: 'Riders sent', mono: true, align: 'right' },
  ]

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership/leaderboard" style={backLink}>← Leaderboard</Link>

        <div style={headerRow}>
          <h1 style={h1Style}>Rider referrals</h1>
        </div>

        <p style={{ color: '#9c9ca3', fontSize: 13, margin: '0 0 18px', maxWidth: 640, fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }}>
          Standings only — riders earn a spot here, not a discount. Every rider gets a
          personal link (<span style={{ color: '#d4a333' }}>/invite/&lt;code&gt;</span>) on their My Tickets page.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 22 }}>
          <StatCard label="Referrers" value={rows.length} tone="gold" />
          <StatCard label="Referred bookings" value={totalReferralBookings} tone="ok" />
          <StatCard label="Riders sent" value={totalRiders} />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={r => r.key}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>
            No rider referrals yet. They start counting once a friend books off a rider&apos;s invite link.
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
