'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import SmsButton from '../../_components/SmsButton'
import BroadcastModal from './_components/BroadcastModal'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [loopFilter, setLoopFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [message, setMessage] = useState('')
  const [assignedGroup, setAssignedGroup] = useState('')
  const [checkedIds, setCheckedIds] = useState(() => new Set())
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [voidingId, setVoidingId] = useState(null)
  const [datePicked, setDatePicked] = useState('')

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
        await loadOrders(selected?.id)
        await refresh()
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setVoidingId(null)
    }
  }

  useEffect(() => {
    if (selected?.id) loadOrders(selected.id)
    else setOrders([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [c, g, m] = await Promise.all([
      supabase.from('contacts').select('*').order('last_name'),
      supabase.from('groups').select('*'),
      supabase.from('group_members').select('id, group_id, contact_id'),
    ])
    setContacts(c.data || [])
    setGroups(g.data || [])
    setMembers(m.data || [])
  }

  async function saveEdit() {
    await supabase.from('contacts').update(editForm).eq('id', selected.id)
    setSelected({ ...selected, ...editForm })
    setEditing(false)
    refresh()
  }

  async function deleteContact() {
    if (!confirm('Delete this contact?')) return
    await supabase.from('group_members').delete().eq('contact_id', selected.id)
    await supabase.from('contacts').delete().eq('id', selected.id)
    setSelected(null)
    refresh()
  }

  async function assignToGroup() {
    if (!assignedGroup || !selected) return
    await supabase.from('group_members').insert([{
      group_id: assignedGroup,
      contact_id: selected.id,
    }])
    alert('Added to group!')
    setAssignedGroup('')
    refresh()
  }

  const today = new Date().toISOString().slice(0, 10)

  const enriched = useMemo(() => {
    const groupById = new Map(groups.map(g => [g.id, g]))
    const ridesByContact = new Map()

    for (const m of members) {
      const group = groupById.get(m.group_id)
      if (!group) continue
      if (!ridesByContact.has(m.contact_id)) ridesByContact.set(m.contact_id, [])
      ridesByContact.get(m.contact_id).push(group)
    }

    const q = search.trim().toLowerCase()
    const matches = (c) =>
      !q || `${c.first_name || ''} ${c.last_name || ''} ${c.phone || ''} ${c.email || ''}`
        .toLowerCase().includes(q)

    return contacts
      .filter(matches)
      .map(c => {
        const rides = (ridesByContact.get(c.id) || [])
          .slice()
          .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
        const past = rides.filter(r => r.event_date && r.event_date < today)
        const upcoming = rides.filter(r => !r.event_date || r.event_date >= today)
        return { ...c, rides, past, upcoming }
      })
      .filter(c => !loopFilter || c.rides.some(r => r.id === loopFilter))
      .sort((a, b) => {
        const aLast = a.past[0]?.event_date || ''
        const bLast = b.past[0]?.event_date || ''
        if (aLast && bLast) return bLast.localeCompare(aLast)
        if (aLast) return -1
        if (bLast) return 1
        return (a.last_name || '').localeCompare(b.last_name || '')
      })
  }, [contacts, groups, members, search, today, loopFilter])

  const loopOptions = useMemo(() => {
    return groups
      .filter(g => g.event_date)
      .slice()
      .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
  }, [groups])

  // These useMemos must run on every render — including when `selected` is set
  // and we early-return below — or React throws "rendered fewer hooks than
  // expected" and crashes the contact detail page.
  const broadcastTargets = useMemo(
    () => contacts.filter(c => checkedIds.has(c.id)),
    [contacts, checkedIds]
  )
  const tonightLoop = useMemo(() => {
    return loopOptions.find(g => g.event_date === today) || null
  }, [loopOptions, today])

  if (selected) {
    const detail = enriched.find(c => c.id === selected.id) || selected
    return (
      <main>
        <button
          onClick={() => { setSelected(null); setEditing(false) }}
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
              <button className="btn-primary" onClick={saveEdit}>Save Changes</button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', color: '#888', marginTop: '8px', width: '100%' }}>Cancel</button>
            </>
          ) : (
            <>
              <p className="rider-name">{selected.first_name} {selected.last_name}</p>
              <p className="rider-phone">📞 {selected.phone}</p>
              <p className="rider-phone">✉️ {selected.email}</p>
              <button onClick={() => { setEditing(true); setEditForm(selected) }} style={{ background: 'none', color: '#f0c040', marginTop: '12px', fontSize: '14px' }}>Edit</button>
              <button onClick={deleteContact} style={{ background: 'none', color: '#ff4444', marginTop: '4px', fontSize: '14px' }}>Delete</button>
            </>
          )}
        </div>

        <div className="card">
          <h3>Ride History ({detail.past?.length || 0})</h3>
          {(!detail.past || detail.past.length === 0) ? (
            <p style={{ color: '#888', fontSize: '13px' }}>No past rides recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {detail.past.map(g => (
                <span key={g.id} style={rideChipStyle}>
                  {formatEventDate(g.event_date)}
                </span>
              ))}
            </div>
          )}
          {detail.upcoming?.length > 0 && (
            <>
              <h3 style={{ marginTop: '14px' }}>Upcoming ({detail.upcoming.length})</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {detail.upcoming.map(g => (
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
          {(() => {
            const upcomingGroups = groups
              .filter(g => g.event_date && g.event_date >= today)
              .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
            if (upcomingGroups.length === 0) {
              return <p style={{ color: '#888', fontSize: '13px' }}>No upcoming loops scheduled.</p>
            }
            return (
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
            )
          })()}
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
                  <div key={o.id} style={{
                    padding: 12,
                    background: '#0f0f12',
                    border: '1px solid #1e1e23',
                    borderRadius: 10,
                  }}>
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
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 8px',
                            background: isVoided ? '#1a1a1f' : '#16161a',
                            borderRadius: 6,
                            fontSize: 12,
                          }}>
                            <span style={{
                              color: isVoided ? '#666' : '#c8c8cc',
                              textDecoration: isVoided ? 'line-through' : 'none',
                            }}>
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
                                  background: 'transparent',
                                  color: '#e07a7a',
                                  border: '1px solid #3a1f1f',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
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
            if (!message || !selected?.phone) return
            const res = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: selected.phone, message }),
            })
            const data = await res.json()
            if (data.success) { alert('Text sent!'); setMessage('') } else { alert('Error: ' + data.error) }
          }}>Send Text</button>
        </div>
      </main>
    )
  }

  const checkedCount = checkedIds.size

  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const visibleIds = enriched.map(c => c.id)
    const allChecked = visibleIds.every(id => checkedIds.has(id))
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (allChecked) visibleIds.forEach(id => next.delete(id))
      else visibleIds.forEach(id => next.add(id))
      return next
    })
  }

  const allVisibleChecked = enriched.length > 0 && enriched.every(c => checkedIds.has(c.id))

  const activeLoop = loopOptions.find(g => g.id === loopFilter) || null

  const dateMatchedLoop = datePicked ? loopOptions.find(g => g.event_date === datePicked) : null
  const dateMissedLookup = datePicked && !dateMatchedLoop

  function handleDatePick(iso) {
    setDatePicked(iso)
    setCheckedIds(new Set())
    const match = iso ? loopOptions.find(g => g.event_date === iso) : null
    setLoopFilter(match ? match.id : '')
  }

  return (
    <main style={{ paddingBottom: checkedCount > 0 ? 96 : undefined }}>
      <h1>Contacts</h1>

      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        <FilterChip
          active={!loopFilter}
          onClick={() => { setLoopFilter(''); setCheckedIds(new Set()) }}
          label="All contacts"
        />
        {tonightLoop && (
          <FilterChip
            active={loopFilter === tonightLoop.id}
            onClick={() => { setLoopFilter(tonightLoop.id); setCheckedIds(new Set()) }}
            label="Tonight's Loop"
          />
        )}
        {loopOptions.slice(0, 6).map(g => {
          if (tonightLoop && g.id === tonightLoop.id) return null
          return (
            <FilterChip
              key={g.id}
              active={loopFilter === g.id}
              onClick={() => { setLoopFilter(g.id); setCheckedIds(new Set()) }}
              label={formatEventDate(g.event_date) || g.name || 'Loop'}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 8px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#9c9ca3', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Pick a date:
          <input
            type="date"
            value={datePicked}
            onChange={e => handleDatePick(e.target.value)}
            style={{
              background: datePicked ? '#2a2316' : '#121215',
              color: datePicked ? '#f0c040' : '#c8c8cc',
              border: `1px solid ${datePicked ? '#3a3220' : '#2a2a31'}`,
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 13,
              colorScheme: 'dark',
              margin: 0,
            }}
          />
        </label>
        {datePicked && (
          <button
            onClick={() => handleDatePick('')}
            style={{
              background: 'none',
              color: '#9c9ca3',
              border: '1px solid #2a2a31',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Clear date
          </button>
        )}
      </div>

      {loopOptions.length > 6 && (
        <select
          value={loopFilter}
          onChange={e => { setLoopFilter(e.target.value); setCheckedIds(new Set()); setDatePicked('') }}
          style={{
            width: '100%',
            background: loopFilter ? '#2a2316' : '#121215',
            color: loopFilter ? '#f0c040' : '#c8c8cc',
            border: `1px solid ${loopFilter ? '#3a3220' : '#1e1e23'}`,
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 14,
            margin: '0 0 8px',
          }}
        >
          <option value="">— Pick any Loop —</option>
          {loopOptions.map(g => (
            <option key={g.id} value={g.id}>
              {formatEventDate(g.event_date)}{g.pickup_time ? ` · ${g.pickup_time}` : ''}{g.name ? ` — ${g.name}` : ''}
            </option>
          ))}
        </select>
      )}

      {dateMissedLookup && (
        <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 8px' }}>
          No Loop on {formatEventDate(datePicked)}.
        </p>
      )}
      {activeLoop && (
        <p style={{ color: '#f0c040', fontSize: 12, margin: '0 0 8px' }}>
          Showing riders from {formatEventDate(activeLoop.event_date) || activeLoop.name}
        </p>
      )}
      <input
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 16px', gap: 12 }}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          {enriched.length} contact{enriched.length === 1 ? '' : 's'}
          {checkedCount > 0 && <span style={{ color: '#f0c24a' }}> · {checkedCount} selected</span>}
        </span>
        {enriched.length > 0 && (
          <button
            onClick={toggleAllVisible}
            style={{
              background: 'none',
              color: '#9c9ca3',
              border: '1px solid #2a2a31',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {allVisibleChecked ? 'Clear' : 'Select all visible'}
          </button>
        )}
      </div>

      <div style={{ background: '#121215', borderRadius: '12px', border: '1px solid #1e1e23', overflow: 'hidden' }}>
        {enriched.map((c, idx) => {
          const rides = c.past.length
          const hasUpcoming = c.upcoming.length > 0
          const checked = checkedIds.has(c.id)
          return (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              style={{
                padding: '12px 14px',
                borderTop: idx === 0 ? 'none' : '1px solid #1a1a1f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                background: checked ? 'rgba(212,163,51,0.06)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <label
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: 4,
                  margin: -4,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCheck(c.id)}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: '#d4a333',
                    cursor: 'pointer',
                    margin: 0,
                  }}
                />
              </label>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: '#e8e8ea' }}>
                  {c.first_name} {c.last_name}
                </p>
                <p style={{ fontSize: '12px', color: '#6f6f76', marginTop: '2px' }}>
                  {c.phone}
                  {c.past[0]?.event_date && (
                    <span style={{ color: '#55555c' }}> · last {formatEventDate(c.past[0].event_date)}</span>
                  )}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {hasUpcoming && <span className="chip chip-green">Booked</span>}
                {rides > 0 && <span className="chip chip-gold">{rides}</span>}
                <span onClick={e => e.stopPropagation()}>
                  <SmsButton contact={c} />
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {enriched.length === 0 && (
        <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
          {search ? 'No contacts match that search.' : 'No contacts yet.'}
        </p>
      )}

      {checkedCount > 0 && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'max(20px, calc(20px + env(safe-area-inset-bottom)))',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'linear-gradient(180deg, #1a1a22, #121216)',
            border: '1px solid #2a2a31',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,163,51,0.15)',
            borderRadius: 14,
            padding: '10px 12px 10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ color: '#e8e8ea', fontSize: 13 }}>
            <span style={{ color: '#f0c24a', fontWeight: 700 }}>{checkedCount}</span> selected
          </div>
          <button
            onClick={() => setCheckedIds(new Set())}
            style={{ background: 'none', color: '#9c9ca3', border: 0, fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}
          >
            Clear
          </button>
          <button
            onClick={() => setBroadcastOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 0,
              background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
              color: '#0a0a0b',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Message {checkedCount}
          </button>
        </div>
      )}

      {broadcastOpen && (
        <BroadcastModal
          contacts={broadcastTargets}
          onClose={() => {
            setBroadcastOpen(false)
          }}
        />
      )}
    </main>
  )
}

const rideChipStyle = {
  background: '#2a2316',
  color: '#f0c040',
  border: '1px solid #3a3220',
  fontSize: '12px',
  fontWeight: 500,
  padding: '3px 8px',
  borderRadius: '10px',
  whiteSpace: 'nowrap',
}

function formatEventDate(iso) {
  if (!iso) return null
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${active ? '#d4a333' : '#2a2a31'}`,
        background: active ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : 'transparent',
        color: active ? '#0a0a0b' : '#c8c8cc',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: active ? '0 0 16px rgba(212,163,51,0.35)' : 'none',
      }}
    >
      {label}
    </button>
  )
}
