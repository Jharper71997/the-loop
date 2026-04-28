'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'
const RED = '#e07a7a'
const GREEN = '#6fbf7f'

export default function RosterView({ items, ticketTypes }) {
  const router = useRouter()
  const [showVoided, setShowVoided] = useState(false)
  const [voidingId, setVoidingId] = useState(null)

  const ttById = new Map(ticketTypes.map(t => [t.id, t]))
  const sorted = [...items].sort((a, b) => {
    const aDate = a.created_at || ''
    const bDate = b.created_at || ''
    return aDate.localeCompare(bDate)
  })
  const visible = showVoided ? sorted : sorted.filter(i => !i.voided_at)
  const activeCount = sorted.filter(i => !i.voided_at).length
  const voidedCount = sorted.length - activeCount

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

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, color: INK, margin: 0, fontWeight: 700 }}>
          Roster · {activeCount} active{voidedCount > 0 ? ` · ${voidedCount} voided` : ''}
        </h1>
        {voidedCount > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: INK_DIM, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={showVoided}
              onChange={e => setShowVoided(e.target.checked)}
            />
            Show voided
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          color: INK_DIM,
          fontSize: 14,
        }}>
          No riders on this Loop yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <HeaderRow />
          {visible.map(item => {
            const tt = item.ticket_type_id ? ttById.get(item.ticket_type_id) : null
            const c = item.contact || null
            const isVoided = !!item.voided_at
            const isPaid = item.order?.status === 'paid'
            const checkedIn = !!item.checked_in_at
            const waiverOK = !!c?.has_signed_waiver
            return (
              <div key={item.id} style={{
                ...rowStyle,
                opacity: isVoided ? 0.55 : 1,
                background: isVoided ? '#0e0e12' : SURFACE,
              }}>
                <span style={{ color: INK, textDecoration: isVoided ? 'line-through' : 'none' }}>
                  {riderName(item) || '(unnamed)'}
                </span>
                <span style={{ color: INK_DIM }}>
                  {(c?.phone || item.rider_phone) ? (
                    <a href={`tel:${c?.phone || item.rider_phone}`} style={{ color: ACCENT, textDecoration: 'none' }}>
                      {c?.phone || item.rider_phone}
                    </a>
                  ) : '—'}
                </span>
                <span style={{ color: INK_DIM, fontSize: 12 }}>
                  {tt?.name || '—'}
                </span>
                <span>
                  {isPaid ? <Pill color={GREEN} bg="rgba(111,191,127,0.12)" label="Paid" /> : <Pill color={ACCENT} bg="rgba(212,163,51,0.12)" label="Pending" />}
                </span>
                <span>
                  {waiverOK
                    ? <Pill color={GREEN} bg="rgba(111,191,127,0.12)" label="Waiver" />
                    : <Pill color={ACCENT} bg="rgba(212,163,51,0.12)" label="No waiver" />}
                </span>
                <span>
                  {checkedIn
                    ? <Pill color={GREEN} bg="rgba(111,191,127,0.12)" label="Checked in" />
                    : <Pill color={INK_DIM} bg="rgba(255,255,255,0.04)" label="Not in" />}
                </span>
                <span style={{ textAlign: 'right' }}>
                  {isVoided ? (
                    <span style={{ fontSize: 11, color: INK_DIM, fontStyle: 'italic' }}>
                      Voided{item.void_reason ? ` · ${item.void_reason}` : ''}
                      {item.voided_by ? ` · ${item.voided_by}` : ''}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => voidItem(item)}
                      disabled={voidingId === item.id}
                      style={{
                        background: 'transparent',
                        color: RED,
                        border: '1px solid #5c2a2a',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: voidingId === item.id ? 'wait' : 'pointer',
                      }}
                    >
                      {voidingId === item.id ? 'Voiding…' : 'Void'}
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HeaderRow() {
  return (
    <div style={{
      ...rowStyle,
      background: 'transparent',
      borderColor: 'transparent',
      color: INK_DIM,
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      fontWeight: 700,
      padding: '6px 10px',
    }}>
      <span>Rider</span>
      <span>Phone</span>
      <span>Ticket</span>
      <span>Paid</span>
      <span>Waiver</span>
      <span>Check-in</span>
      <span style={{ textAlign: 'right' }}>Action</span>
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

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(120px, 1.2fr) minmax(110px, 1fr) minmax(100px, 1fr) 80px 90px 100px minmax(80px, 1fr)',
  gap: 10,
  alignItems: 'center',
  padding: '10px',
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  fontSize: 13,
}
