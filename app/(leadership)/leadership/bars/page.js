import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { serverNow } from '@/lib/serverNow'
import StripeSyncButton from '../../_components/StripeSyncButton'
import OutstandingBanner from '../../_components/OutstandingBanner'
import PaymentRosterTable from '../../_components/PaymentRosterTable'

async function markBarPaid(barSlug) {
  'use server'
  const supabase = supabaseAdmin()
  const { data: bar } = await supabase
    .from('bars')
    .select('monthly_fee_cents, payment_method, status, started_at')
    .eq('slug', barSlug)
    .maybeSingle()
  if (!bar || !bar.monthly_fee_cents) return
  const today = new Date()
  const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  await supabase.from('bar_payments').insert({
    bar_slug: barSlug,
    amount_cents: bar.monthly_fee_cents,
    paid_for_period: period,
    method: bar.payment_method || 'cash',
    notes: 'Marked paid via one-click button',
  })
  if (bar.status === 'prospect') {
    await supabase
      .from('bars')
      .update({
        status: 'active',
        started_at: bar.started_at || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('slug', barSlug)
  }
  revalidatePath('/leadership')
  revalidatePath('/leadership/bars')
  redirect('/leadership/bars')
}

export const dynamic = 'force-dynamic'

const STATUS_COLORS = {
  prospect:  { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  active:    { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  paused:    { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
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

export default async function BarsPage() {
  const supabase = supabaseAdmin()
  const { startISO, endISO, monthStr } = currentMonthBounds()

  const { data: bars } = await supabase
    .from('bars')
    .select('slug, name, status, monthly_fee_cents, payment_method, contact_name')
    .order('status')
    .order('name')

  // All payments (last 12 months for the "last paid" column)
  const { data: payments } = await supabase
    .from('bar_payments')
    .select('bar_slug, paid_at, paid_for_period, amount_cents, method')
    .order('paid_at', { ascending: false })
    .limit(500)

  const lastPaidBy = new Map()
  const paidThisMonth = new Map()  // bar_slug → cents paid this month
  const paidMethodThisMonth = new Map()
  const stripeActive = new Set()
  const stripeCutoff = (await serverNow()) - 45 * 24 * 60 * 60 * 1000

  for (const p of (payments || [])) {
    if (!lastPaidBy.has(p.bar_slug)) lastPaidBy.set(p.bar_slug, p)
    if (p.method === 'stripe' && new Date(p.paid_at).getTime() >= stripeCutoff) {
      stripeActive.add(p.bar_slug)
    }
    const period = p.paid_for_period
    const inMonth = period
      ? period.startsWith(monthStr)
      : (p.paid_at >= startISO && p.paid_at < endISO)
    if (inMonth) {
      paidThisMonth.set(p.bar_slug, (paidThisMonth.get(p.bar_slug) || 0) + p.amount_cents)
      if (!paidMethodThisMonth.has(p.bar_slug)) {
        paidMethodThisMonth.set(p.bar_slug, p.method)
      }
    }
  }

  // Outstanding totals (active bars only)
  let totalExpected = 0
  let totalPaid = 0
  let totalOwed = 0
  let countOwed = 0
  for (const b of bars || []) {
    if (b.status !== 'active' || !b.monthly_fee_cents) continue
    totalExpected += b.monthly_fee_cents
    const paid = paidThisMonth.get(b.slug) || 0
    totalPaid += paid
    const owed = Math.max(0, b.monthly_fee_cents - paid)
    if (owed > 0) {
      totalOwed += owed
      countOwed += 1
    }
  }

  // Normalized rows for the shared roster table.
  const rows = (bars || []).map(b => {
    const sc = STATUS_COLORS[b.status] || STATUS_COLORS.prospect
    const monthlyCents = b.monthly_fee_cents || 0
    const paid = paidThisMonth.get(b.slug) || 0
    const isActive = b.status === 'active'
    const owed = isActive && monthlyCents ? Math.max(0, monthlyCents - paid) : 0
    const paidMethod = paidMethodThisMonth.has(b.slug) ? methodBadge(paidMethodThisMonth.get(b.slug)) : null
    return {
      key: b.slug,
      name: b.name,
      href: `/leadership/bars/${b.slug}`,
      newPaymentHref: `/leadership/bars/${b.slug}/payments/new`,
      subtitle: b.contact_name || null,
      status: b.status,
      statusBg: sc.bg,
      statusFg: sc.fg,
      monthlyCents,
      paidThisMonth: paid,
      owed,
      isActive,
      lastPayment: lastPaidBy.get(b.slug) || null,
      paidMethodLabel: paidMethod,
      stripeSub: stripeActive.has(b.slug),
      markPaidAction: !paidMethod && isActive && monthlyCents > 0 ? markBarPaid.bind(null, b.slug) : null,
    }
  })

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/leadership/income" style={backLink}>← Income</Link>

        <div style={headerRow}>
          <h1 style={h1Style}>Bars</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StripeSyncButton />
            <Link href="/leadership/bars/new" style={addBtn}>+ Add bar</Link>
          </div>
        </div>

        <OutstandingBanner
          entityLabel="Bars"
          period={new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          expected={totalExpected}
          paid={totalPaid}
          owed={totalOwed}
          countOwed={countOwed}
        />

        <PaymentRosterTable
          entityLabel="Bar"
          rows={rows}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '20px 0' }}>No bars yet.</div>}
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
