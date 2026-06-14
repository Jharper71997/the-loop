'use client'

import { useEffect, useState } from 'react'
import { formatEventDate, rideChipStyle } from './util'

// The contact detail panel, extracted from the 836-line contacts/page.js.
// Self-contained: owns its own edit/orders/SMS state so the parent's hooks
// stay above its early return. The parent remounts it per contact via
// `key={contact.id}`, so internal state resets cleanly on contact switch.
//
// Props:
//   contact   — enriched contact (identity fields + past/upcoming rides)
//   groups    — all groups (for the assign-to-loop dropdown)
//   today     — operational date (Indy TZ) string
//   onBack    — clear selection / return to list
//   onRefresh — reload the parent's contact + member lists
export default function ContactDetail({ contact, groups, today, onBack, onRefresh }) {
  const [current, setCurrent] = useState(contact)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'ok' | { error }
  const [message, setMessage] = useState('')
  const [assignedGroup, setAssignedGroup] = useState('')
  const [orders, setOrders] = useState([])
  const [voidingId, setVoidingId] = useState(null)

  useEffect(() => {
    loadOrders(contact.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadOrders(contactId) {
    if (!contactId) { setOrders([]); return }
    // Server endpoint uses the service-role client to bypass RLS on
    // orders/order_items; the browser anon client can't read them.
    try {
      const res = await fetch(`/api/admin/contact-orders?contact_id=${encodeURIComponent(contactId)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[contacts] loadOrders failed', json.error || res.status)
        setOrders([])
        return
      }
      setOrders(json.orders || [])
    } catch (err) {
      console.error('[contacts] loadOrders threw', err)
      setOrders([])
    }
  }

  async function voidOrderItem(item, order) {
    if (voidingId) return
    const reason = window.prompt('Optional reason for voiding this ticket:', '')
    if (reason === null) return
    const wantRefund = order?.stripe_payment_intent_id
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
        await loadOrders(current.id)
        onRefresh?.()
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setVoidingId(null)
    }
  }

  async function saveEdit() {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/admin/contacts/${encodeURIComponent(current.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        setSaveStatus({ error: json.error || `HTTP ${res.status}` })
        return
      }
      setCurrent(json.contact || { ...current, ...editForm })
      setEditing(false)
      setSaveStatus('ok')
      onRefresh?.()
      setTimeout(() => setSaveStatus(null), 2500)
    } catch (err) {
      setSaveStatus({ error: err?.message || 'network error' })
    }
  }

  async function deleteContact() {
    if (!confirm('Delete this contact?')) return
    try {
      const res = await fetch(`/api/admin/contacts/${encodeURIComponent(current.id)}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        alert(json.error || `Delete failed (${res.status})`)
        return
      }
      onBack?.()
      onRefresh?.()
    } catch (err) {
      alert(err?.message || 'network error')
    }
  }

  async function assignToGroup() {
    if (!assignedGroup) return
    try {
      const res = await fetch(`/api/admin/contacts/${encodeURIComponent(current.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: assignedGroup }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        alert(json.error || `Assign failed (${res.status})`)
        return
      }
      alert(json.already ? 'Already on this Loop.' : 'Added to Loop!')
      setAssignedGroup('')
      onRefresh?.()
    } catch (err) {
      alert(err?.message || 'network error')
    }
  }

  const upcomingGroups = groups
    .filter(g => g.event_date && (!g.closed_out_at || g.event_date >= today))
    .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))

  return (
    <main>
      <button
        onClick={onBack}
        style={{ color: '#f0c040', background: 'none', marginBottom: '16px', fontSize: '15px' }}
      >
        ← Back
      </button>

      <div className="card">
        {editing ? (
          <>
            <h3 style={{ marginBottom: '12px' }}>Edit Contact</h3>
            <input placeholder="First name" value={editForm.first_name || ''} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
            <input placeholder="Last name" value={editForm.last_name || ''} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
            <input placeholder="Phone" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            <input placeholder="Email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <button className="btn-primary" onClick={saveEdit} disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving…' : 'Save Changes'}
            </button>
            {saveStatus && saveStatus !== 'saving' && (
              <p style={{ marginTop: 8, fontSize: 12, color: saveStatus === 'ok' ? '#6fbf7f' : '#e07a7a' }}>
                {saveStatus === 'ok' ? '✓ Saved' : `Save failed: ${saveStatus.error}`}
              </p>
            )}
            <button onClick={() => setEditing(false)} style={{ background: 'none', color: '#888', marginTop: '8px', width: '100%' }}>Cancel</button>
          </>
        ) : (
          <>
            <p className="rider-name">{current.first_name} {current.last_name}</p>
            <p className="rider-phone">📞 {current.phone}</p>
            <p className="rider-phone">✉️ {current.email}</p>
            <button onClick={() => { setEditing(true); setEditForm(current) }} style={{ background: 'none', color: '#f0c040', marginTop: '12px', fontSize: '14px' }}>Edit</button>
            <button onClick={deleteContact} style={{ background: 'none', color: '#ff4444', marginTop: '4px', fontSize: '14px' }}>Delete</button>
          </>
        )}
      </div>

      <div className="card">
        <h3>Ride History ({contact.past?.length || 0})</h3>
        {(!contact.past || contact.past.length === 0) ? (
          <p style={{ color: '#888', fontSize: '13px' }}>No past rides recorded.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {contact.past.map(g => (
              <span key={g.id} style={rideChipStyle}>{formatEventDate(g.event_date)}</span>
            ))}
          </div>
        )}
        {contact.upcoming?.length > 0 && (
          <>
            <h3 style={{ marginTop: '14px' }}>Upcoming ({contact.upcoming.length})</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {contact.upcoming.map(g => (
                <span key={g.id} style={{ ...rideChipStyle, background: '#1a2a1a', color: '#4aa84a', borderColor: '#2a3f2a' }}>
                  {formatEventDate(g.event_date) || g.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>Assign to Upcoming Loop</h3>
        {upcomingGroups.length === 0 ? (
          <p style={{ color: '#888', fontSize: '13px' }}>No upcoming loops scheduled.</p>
        ) : (
          <>
            <select value={assignedGroup} onChange={e => setAssignedGroup(e.target.value)}>
              <option value="">Select a loop...</option>
              {upcomingGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {formatEventDate(g.event_date)}{g.pickup_time ? ` · ${g.pickup_time}` : ''} — {g.name}
                </option>
              ))}
            </select>
            <button className="btn-green" onClick={assignToGroup}>Assign</button>
          </>
        )}
      </div>

      <div className="card">
        <h3>Tickets purchased ({orders.length})</h3>
        {orders.length === 0 ? (
          <p style={{ color: '#888', fontSize: '13px' }}>No orders found.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {orders.map(o => {
              const liveItems = (o.order_items || []).filter(i => !i.voided_at)
              const evDate = o.event?.event_date ? formatEventDate(o.event.event_date) : null
              return (
                <div key={o.id} style={{ padding: 12, background: '#0f0f12', border: '1px solid #1e1e23', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ea' }}>
                        {evDate || o.event?.name || 'Loop'}
                        {o.event?.pickup_time ? ` · ${o.event.pickup_time}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#9c9ca3', marginTop: 2 }}>
                        {liveItems.length} of {o.order_items?.length || 0} active
                        {o.total_cents != null && ` · $${(o.total_cents / 100).toFixed(2)}`}
                        {' · '}
                        <span style={{
                          color: o.status === 'paid' ? '#6fbf7f'
                                : o.status === 'voided' ? '#9c9ca3'
                                : o.status === 'refunded' ? '#e07a7a' : '#f0c24a',
                        }}>{o.status}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                    {(o.order_items || []).map(item => {
                      const isVoided = !!item.voided_at
                      return (
                        <div key={item.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 8px', background: isVoided ? '#1a1a1f' : '#16161a',
                          borderRadius: 6, fontSize: 12,
                        }}>
                          <span style={{ color: isVoided ? '#666' : '#c8c8cc', textDecoration: isVoided ? 'line-through' : 'none' }}>
                            {item.rider_first_name || 'Guest'} {item.rider_last_name || ''}
                            {' · '}
                            ${((item.unit_price_cents || 0) / 100).toFixed(2)}
                            {isVoided && (
                              <span style={{ marginLeft: 8, color: '#888', fontStyle: 'italic' }}>
                                Voided{item.void_reason ? ` · ${item.void_reason}` : ''}{item.voided_by ? ` · ${item.voided_by}` : ''}
                              </span>
                            )}
                          </span>
                          {!isVoided && (
                            <button
                              type="button"
                              onClick={() => voidOrderItem(item, o)}
                              disabled={voidingId === item.id}
                              style={{
                                background: 'transparent', color: '#e07a7a', border: '1px solid #3a1f1f',
                                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                cursor: voidingId === item.id ? 'wait' : 'pointer',
                              }}
                            >
                              {voidingId === item.id ? 'Voiding…' : 'Void'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Send SMS</h3>
        <textarea rows={3} placeholder="Type your message..." value={message} onChange={e => setMessage(e.target.value)} />
        <button className="btn-primary" onClick={async () => {
          if (!message || !current?.phone) return
          const res = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: current.phone, message }),
          })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data.success) {
            alert('Text sent!'); setMessage('')
          } else {
            alert(`Error: ${data.error || `http_${res.status}`}${data.detail ? ` — ${data.detail}` : ''}`)
          }
        }}>Send Text</button>
      </div>
    </main>
  )
}
