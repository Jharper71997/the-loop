import Link from 'next/link'
import { formatCents } from '@/lib/leadershipScoreboard'
import DataTable from './DataTable'
import StatusBadge from './StatusBadge'
import MarkPaidButton from './MarkPaidButton'

// Shared roster table for sponsors + bars (they were ~95% identical). Each page
// computes its own normalized rows so the money math (amount_committed*100 vs
// monthly_fee_cents; active = committed|paid vs active) stays in the page; this
// component never branches on entity type.
//
// Each row: {
//   key, name, href, newPaymentHref, subtitle?,
//   status, statusBg, statusFg,
//   monthlyCents, paidThisMonth, owed, isActive,
//   lastPayment: { amount_cents, paid_at } | null,
//   paidMethodLabel: string | null,   // green "✓ Cash" badge when paid this month
//   stripeSub: boolean,               // purple "Stripe sub" badge
//   markPaidAction: (bound server action) | null,
// }
export default function PaymentRosterTable({ entityLabel, rows, empty }) {
  const columns = [
    {
      key: 'name', header: entityLabel, primary: true,
      render: r => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Link href={r.href} style={{ fontWeight: 600, color: '#e8e8ea', textDecoration: 'none' }}>{r.name}</Link>
            {r.paidMethodLabel && (
              <StatusBadge label={`✓ ${r.paidMethodLabel}`} tone="green" bordered title={`Paid this month via ${r.paidMethodLabel}`} />
            )}
            {!r.paidMethodLabel && r.stripeSub && (
              <StatusBadge label="Stripe sub" tone="purple" bordered title="Active Stripe subscription · auto-charges on anniversary" />
            )}
          </div>
          {r.subtitle && <div style={{ fontSize: 11, color: '#9c9ca3', marginTop: 2 }}>{r.subtitle}</div>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: r => <StatusBadge label={r.status} bg={r.statusBg} fg={r.statusFg} />,
    },
    {
      key: 'monthly', header: 'Monthly', align: 'right', mono: true,
      render: r => (r.monthlyCents > 0 ? formatCents(r.monthlyCents) : '—'),
    },
    {
      key: 'thisMonth', header: 'This Month',
      render: r => <ThisMonthCell paid={r.paidThisMonth} owed={r.owed} active={r.isActive} fee={r.monthlyCents} />,
    },
    {
      key: 'lastPayment', header: 'Last Payment',
      render: r => r.lastPayment ? (
        <span style={{ color: '#9c9ca3' }}>
          {formatCents(r.lastPayment.amount_cents)} · {new Date(r.lastPayment.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      ) : <span style={{ color: '#9c9ca3' }}>—</span>,
    },
    {
      key: 'actions', header: 'Actions', align: 'right',
      render: r => (
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {r.markPaidAction && <MarkPaidButton action={r.markPaidAction} />}
          <Link href={r.newPaymentHref} style={{ color: '#d4a333', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>+ Payment</Link>
        </div>
      ),
    },
  ]

  return <DataTable columns={columns} rows={rows} rowKey={r => r.key} empty={empty} />
}

function ThisMonthCell({ paid, owed, active, fee }) {
  if (!active || !fee) {
    return <span style={{ color: '#6f6f76', fontSize: 11 }}>—</span>
  }
  if (owed === 0 && paid > 0) {
    return <span style={{ color: '#3fb27f', fontSize: 11, letterSpacing: '0.04em' }}>✓ Paid {formatCents(paid)}</span>
  }
  if (owed > 0 && paid > 0) {
    return <span style={{ color: '#d4a333', fontSize: 11, letterSpacing: '0.04em' }}>Partial · {formatCents(paid)} of {formatCents(fee)}</span>
  }
  return <span style={{ color: '#c44a3a', fontSize: 11, letterSpacing: '0.04em' }}>Owes {formatCents(owed)}</span>
}
