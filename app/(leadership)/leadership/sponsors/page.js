import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { serverNow } from '@/lib/serverNow'
import StripeSyncButton from '../../_components/StripeSyncButton'
import OutstandingBanner from '../../_components/OutstandingBanner'
import PaymentRosterTable from '../../_components/PaymentRosterTable'

async function markSponsorPaid(sponsorId) {
  'use server'
  const supabase = supabaseAdmin()
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('amount_committed, status, amount_paid')
    .eq('id', sponsorId)
    .maybeSingle()
  if (!sponsor) return
  const amount = Number(sponsor.amount_committed || 0)
  if (amount <= 0) return  // in-kind partner; no payment to record
  const { data: lastPayment } = await supabase
    .from('sponsor_payments')
    .select('method')
    .eq('sponsor_id', sponsorId)
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const method = lastPayment?.method || 'cash'
  const today = new Date()
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  await supabase.from('sponsor_payments').insert({
    sponsor_id: sponsorId,
    amount_cents: Math.round(amount * 100),
    paid_for_period: period,
    method,
    notes: 'Marked paid via one-click button',
  })
  await supabase
    .from('sponsors')
    .update({
      amount_paid: Number(sponsor.amount_paid || 0) + amount,
      status: sponsor.status === 'prospect' || sponsor.status === 'committed' ? 'paid' : sponsor.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sponsorId)
  revalidatePath('/leadership')
  revalidatePath('/leadership/sponsors')
  redirect('/leadership/sponsors')
}

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect:  { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  committed: { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  paid:      { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  inactive:  { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
}

const METHOD_LABELS = { stripe: 'Stripe', check: 'Check', cash: 'Cash', venmo: 'Venmo', cashapp: 'Cash App', other: 'Other' }
function methodBadge(method) {
  return METHOD_LABELS[method] || (method || '').replace(/^\w/, c => c.toUpperCase())
}

function currentMonthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    monthStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  }
}

export default async function SponsorsPage() {
  const supabase = supabaseAdmin()
  const { startISO, endISO, monthStr } = currentMonthBounds()

  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('id, name, contact, tier, amount_committed, amount_paid, status')
    .order('status')
    .order('name')

  const { data: payments } = await supabase
    .from('sponsor_payments')
    .select('sponsor_id, paid_at, paid_for_period, amount_cents, method')
    .order('paid_at', { ascending: false })
    .limit(500)

  const lastPaidBy = new Map()
  const paidThisMonth = new Map()
  const stripeActive = new Set()
  const paidMethodThisMonth = new Map()  // sponsor_id → method label of most recent this-month payment
  const stripeCutoff = (await serverNow()) - 45 * 24 * 60 * 60 * 1000
  for (const p of (payments || [])) {
    if (!lastPaidBy.has(p.sponsor_id)) lastPaidBy.set(p.sponsor_id, p)
    if (p.method === 'stripe' && new Date(p.paid_at).getTime() >= stripeCutoff) {
      stripeActive.add(p.sponsor_id)
    }
    const inMonth = p.paid_for_period
      ? p.paid_for_period.startsWith(monthStr)
      : (p.paid_at >= startISO && p.paid_at < endISO)
    if (inMonth) {
      paidThisMonth.set(p.sponsor_id, (paidThisMonth.get(p.sponsor_id) || 0) + p.amount_cents)
      if (!paidMethodThisMonth.has(p.sponsor_id)) {
        paidMethodThisMonth.set(p.sponsor_id, p.method)
      }
    }
  }

  // Outstanding totals — monthly expected = amount_committed for active
  // sponsors (committed/paid). Per Asana memory: amount_committed is the
  // monthly fee.
  let totalExpected = 0
  let totalPaid = 0
  let totalOwed = 0
  let countOwed = 0
  for (const s of sponsors || []) {
    if (s.status !== 'committed' && s.status !== 'paid') continue
    const monthlyCents = Math.round(Number(s.amount_committed || 0) * 100)
    if (!monthlyCents) continue
    totalExpected += monthlyCents
    const paid = paidThisMonth.get(s.id) || 0
    totalPaid += paid
    const owed = Math.max(0, monthlyCents - paid)
    if (owed > 0) {
      totalOwed += owed
      countOwed += 1
    }
  }

  // Normalized rows for the shared roster table.
  const rows = (sponsors || []).map(s => {
    const sc = STATUS_COLORS[s.status] || STATUS_COLORS.prospect
    const monthlyCents = Math.round(Number(s.amount_committed || 0) * 100)
    const paid = paidThisMonth.get(s.id) || 0
    const isActive = s.status === 'committed' || s.status === 'paid'
    const owed = isActive && monthlyCents ? Math.max(0, monthlyCents - paid) : 0
    const paidMethod = paidMethodThisMonth.has(s.id) ? methodBadge(paidMethodThisMonth.get(s.id)) : null
    return {
      key: s.id,
      name: s.name,
      href: `/leadership/sponsors/${s.id}`,
      newPaymentHref: `/leadership/sponsors/${s.id}/payments/new`,
      subtitle: s.tier || null,
      status: s.status,
      statusBg: sc.bg,
      statusFg: sc.fg,
      monthlyCents,
      paidThisMonth: paid,
      owed,
      isActive,
      lastPayment: lastPaidBy.get(s.id) || null,
      paidMethodLabel: paidMethod,
      stripeSub: stripeActive.has(s.id),
      markPaidAction: !paidMethod && monthlyCents > 0 ? markSponsorPaid.bind(null, s.id) : null,
    }
  })

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership/income" style={backLink}>← Income</Link>

        <div style={headerRow}>
          <h1 style={h1Style}>Sponsors</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StripeSyncButton />
            <Link href="/leadership/sponsors/new" style={addBtn}>+ Add sponsor</Link>
          </div>
        </div>

        <OutstandingBanner
          entityLabel="Sponsors"
          period={new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          expected={totalExpected}
          paid={totalPaid}
          owed={totalOwed}
          countOwed={countOwed}
        />

        <PaymentRosterTable
          entityLabel="Sponsor"
          rows={rows}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>No sponsors yet. Add via Asana Lead Mgmt; sponsor records get inserted as they convert.</div>}
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
const addBtn = {
  background: '#d4a333', color: '#0a0a0b',
  fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6, textDecoration: 'none',
}
