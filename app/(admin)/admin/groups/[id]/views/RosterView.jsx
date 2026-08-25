'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DataTable from '@/app/(leadership)/_components/DataTable'
import ShowMore from '@/app/(leadership)/_components/ShowMore'

const ACCENT = '#d4a333'
const ACCENT_TXT = '#8a5f0a'
const INK = '#17130f'
const INK_DIM = '#6e6154'
const RED = '#d8543f'
const RED_TXT = '#b3311f'
const GREEN = '#2fa36b'
const GREEN_TXT = '#0f7a4e'

export default function RosterView({ items, ticketTypes }) {
  const router = useRouter()
  const [voidingId, setVoidingId] = useState(null)

  const ttById = new Map(ticketTypes.map(t => [t.id, t]))
  const sorted = [...items].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  const activeRows = sorted.filter(i => !i.voided_at)
  const voidedRows = sorted.filter(i => i.voided_at)
  const activeCount = activeRows.length
  const voidedCount = voidedRows.length

  async function voidItem(item) {
    if (voidingId) return
    const reason = window.prompt(`Void ${riderName(item)}'s ticket?\n\nOptional reason:`, '')
    if (reason === null) return
    const wantRefund = item.order?.stripe_payment_intent_id
      ? confirm('Also issue a Stripe refund for this seat? Click Cancel to void without refunding.')
      : false
    setVoidingId(item.id)
    try {
      const res = await fetch(`/api/order-items/${item.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || null, refund: wantRefund }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(json.error || `Failed (${res.status})`)
      } else {
        router.refresh()
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setVoidingId(null)
    }
  }

  const columns = [
    {
      key: 'rider', header: 'Rider', primary: true,
      render: it => (
        <span style={{ color: INK, textDecoration: it.voided_at ? 'line-through' : 'none' }}>
          {riderName(it) || '(unnamed)'}
        </span>
      ),
    },
    {
      key: 'phone', header: 'Phone',
      render: it => {
        const ph = it.contact?.phone || it.rider_phone
        return ph
          ? <a href={`tel:${ph}`} style={{ color: ACCENT_TXT, textDecoration: 'none' }}>{ph}</a>
          : <span style={{ color: INK_DIM }}>—</span>
      },
    },
    {
      key: 'ticket', header: 'Ticket',
      render: it => <span style={{ color: INK_DIM, fontSize: 12 }}>{(it.ticket_type_id && ttById.get(it.ticket_type_id)?.name) || '—'}</span>,
    },
    {
      key: 'paid', header: 'Paid',
      render: it => it.order?.status === 'paid'
        ? <Pill color={GREEN_TXT} bg="#0f7a4e" label="Paid" />
        : <Pill color={ACCENT_TXT} bg="#8a5f0a" label="Pending" />,
    },
    {
      key: 'waiver', header: 'Waiver',
      render: it => it.contact?.has_signed_waiver
        ? <Pill color={GREEN_TXT} bg="#0f7a4e" label="Waiver" />
        : <Pill color={ACCENT_TXT} bg="#8a5f0a" label="No waiver" />,
    },
    {
      key: 'checkin', header: 'Check-in',
      render: it => it.checked_in_at
        ? <Pill color={GREEN_TXT} bg="#0f7a4e" label="Checked in" />
        : <Pill color={INK_DIM} bg="#17130f" label="Not in" />,
    },
    {
      key: 'action', header: 'Action', align: 'right',
      render: it => it.voided_at ? (
        <span style={{ fontSize: 11, color: INK_DIM, fontStyle: 'italic' }}>
          Voided{it.void_reason ? ` · ${it.void_reason}` : ''}{it.voided_by ? ` · ${it.voided_by}` : ''}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => voidItem(it)}
          disabled={voidingId === it.id}
          style={{
            background: 'transparent',
            color: RED_TXT,
            border: '1px solid #f7cfc6',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: voidingId === it.id ? 'wait' : 'pointer',
          }}
        >
          {voidingId === it.id ? 'Voiding…' : 'Void'}
        </button>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, color: INK, margin: 0, fontWeight: 700 }}>
        Roster · {activeCount} active{voidedCount > 0 ? ` · ${voidedCount} voided` : ''}
      </h1>

      <DataTable
        columns={columns}
        rows={activeRows}
        rowKey={it => it.id}
        empty={(
          <div style={{
            background: '#fdfaf3', border: '1px solid #e8ddc8', borderRadius: 12,
            padding: 24, textAlign: 'center', color: INK_DIM, fontSize: 14,
          }}>
            No riders on this Loop yet.
          </div>
        )}
      />

      {voidedCount > 0 && (
        <ShowMore label="voided riders" count={voidedCount}>
          <DataTable columns={columns} rows={voidedRows} rowKey={it => it.id} />
        </ShowMore>
      )}
    </div>
  )
}

function Pill({ color, bg, label }) {
  return (
    <span style={{
      fontSize: 10,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 999,
      background: bg,
      border: `1px solid ${color}40`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function riderName(item) {
  return [item.rider_first_name, item.rider_last_name].filter(Boolean).join(' ').trim()
    || [item.contact?.first_name, item.contact?.last_name].filter(Boolean).join(' ').trim()
}
