'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useBusiness } from '../../_components/BusinessProvider'
import { adminBase } from '@/lib/adminBase'
import { personalize } from '@/lib/personalize'
import {
  currentStopIndex,
  formatStopTime,
  nowInTZ,
  operationalDateInTZ,
} from '@/lib/schedule'

// Operational view of upcoming Loops. Day-of users (security, drivers,
// staff, leadership) see who's riding which stop and can move riders +
// broadcast SMS. ALL editing of loops/schedules/tickets lives at
// /leadership/loops — this page is read + rider-management only.

const DAY_TABS = [
  { key: 'friday', label: 'Friday', weekday: 5 },
  { key: 'saturday', label: 'Saturday', weekday: 6 },
]

export default function Groups() {
  const { business } = useBusiness()
  const base = adminBase(business)
  const [groups, setGroups] = useState([])
  const [groupHasEvent, setGroupHasEvent] = useState({})
  const [ticketsByGroup, setTicketsByGroup] = useState({})
  const [ticketsByContact, setTicketsByContact] = useState({})
  const [now, setNow] = useState(() => nowInTZ())
  const [today] = useState(() => operationalDateInTZ())
  const [activeDay, setActiveDay] = useState(() => initialDay())
  const [stopMessage, setStopMessage] = useState({})
  const [sending, setSending] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [openStop, setOpenStop] = useState(null)
  const [pickerMember, setPickerMember] = useState(null)

  useEffect(() => {
    fetchGroups()
    const t = setInterval(() => setNow(nowInTZ()), 60000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business])

  async function fetchGroups() {
    const { data } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          id,
          current_stop_index,
          contacts ( id, first_name, last_name, phone )
        )
      `)
      .eq('kind', business)   // active console's business (Brew /admin, Surf /surf, Marines /loop)
      .order('event_date')
    const groupRows = data || []
    setGroups(groupRows)

    // Ticket aggregates come from a service-key route: this page uses the anon
    // key and RLS hides `orders`, so a direct party_size query returns nothing
    // and counts fall back to contact rows (a 4-ticket group buy → "1 rider").
    // seatsByContact already credits unnamed group-buy seats to the buyer.
    try {
      const res = await fetch(`/api/admin/loop-tickets?business=${business}`)
      const j = res.ok ? await res.json() : {}
      setGroupHasEvent(j.groupHasEvent || {})
      setTicketsByGroup(j.ticketsByGroup || {})
      setTicketsByContact(j.seatsByContact || {})
      if (!res.ok) console.error('[Loops] ticket aggregates fetch failed', res.status)
    } catch (e) {
      console.error('[Loops] ticket aggregates fetch error', e)
    }
  }

  async function moveRider(memberId, stopIdx) {
    setGroups(prev => prev.map(g => ({
      ...g,
      group_members: (g.group_members || []).map(m =>
        m.id === memberId ? { ...m, current_stop_index: stopIdx } : m
      ),
    })))
    setPickerMember(null)
    await supabase
      .from('group_members')
      .update({ current_stop_index: stopIdx })
      .eq('id', memberId)
  }

  async function sendStopSMS(group, stopIdx, riders) {
    const key = `${group.id}:${stopIdx}`
    const template = stopMessage[key]
    if (!template) return alert('Type a message first')
    const withPhones = riders.filter(r => r.contacts?.phone)
    if (!withPhones.length) return alert('No riders with phones at this stop.')
    if (!confirm(`Send to ${withPhones.length} rider${withPhones.length === 1 ? '' : 's'}?`)) return

    setSending(s => ({ ...s, [key]: true }))
    const results = await Promise.all(
      withPhones.map(m =>
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: m.contacts.phone, message: personalize(template, m.contacts) }),
        })
          .then(async res => {
            const json = await res.json().catch(() => ({}))
            if (json.unreachable) return { success: false, unreachable: true }
            if (!res.ok || !json.success) {
              return { success: false, error: json.error || `http_${res.status}`, detail: json.detail }
            }
            return { success: true }
          })
          .catch(e => ({ success: false, error: 'network', detail: e.message }))
      )
    )
    setSending(s => ({ ...s, [key]: false }))
    // Unreachable numbers are counted apart from real failures — a rider whose
    // number the carrier rejects isn't an outage, and shouldn't read like one
    // mid-route.
    const unreachable = results.filter(r => r.unreachable).length
    const failed = results.filter(r => !r.success && !r.unreachable).length
    const sent = withPhones.length - failed - unreachable

    if (failed === 0 && unreachable === 0) {
      alert(`Sent to ${withPhones.length}!`)
      setStopMessage(m => ({ ...m, [key]: '' }))
      return
    }

    let msg = `Sent ${sent} of ${withPhones.length}.`
    if (unreachable) msg += ` ${unreachable} unreachable (bad number) — reach them another way.`
    if (failed) {
      const first = results.find(r => !r.success && !r.unreachable)
      msg += ` ${failed} failed (${first?.detail || first?.error || 'unknown'}).`
    }
    alert(msg)
    // Nothing actually broke, so clear the box rather than make them retype it.
    if (failed === 0) setStopMessage(m => ({ ...m, [key]: '' }))
  }

  const filtered = useMemo(() => {
    const target = DAY_TABS.find(d => d.key === activeDay)?.weekday
    const matching = groups.filter(g => {
      if (!g.event_date) return false
      if (g.event_date < today) return false
      const d = new Date(`${g.event_date}T12:00:00-05:00`).getDay()
      return d === target
    })
    // Dedupe by event_date — if the date has a group with a paired event,
    // hide the orphan group rows for that same date so admin doesn't click
    // into the wrong one.
    const datesWithEvent = new Set()
    for (const g of matching) if (groupHasEvent[g.id]) datesWithEvent.add(g.event_date)
    const deduped = matching.filter(g => groupHasEvent[g.id] || !datesWithEvent.has(g.event_date))
    return deduped.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
  }, [groups, activeDay, today, groupHasEvent])

  const counts = useMemo(() => {
    const out = {}
    for (const day of DAY_TABS) {
      out[day.key] = groups
        .filter(g => {
          if (!g.event_date || g.event_date < today) return false
          return new Date(`${g.event_date}T12:00:00-05:00`).getDay() === day.weekday
        })
        .reduce((sum, g) => sum + (ticketsByGroup[g.id] || g.group_members?.length || 0), 0)
    }
    return out
  }, [groups, today, ticketsByGroup])

  // Seats at a stop: a group buy is one contact row but N riders, so sum
  // per-contact seats (Kolby's 4) rather than counting rows (which read as 1).
  const seatsAt = (list) =>
    (list || []).reduce((sum, m) => sum + (ticketsByContact[m.contacts?.id] || 1), 0)

  return (
    <main>
      <div style={{ marginBottom: '4px' }}>
        <h1 style={{ margin: 0 }}>Loops</h1>
      </div>
      <p className="muted" style={{ marginBottom: '14px' }}>
        Upcoming pickups by night · {now}
      </p>

      <div style={{
        display: 'flex',
        gap: '6px',
        background: '#ffffff',
        border: '1px solid #e8ddc8',
        borderRadius: '10px',
        padding: '4px',
        marginBottom: '16px',
      }}>
        {DAY_TABS.map(day => {
          const active = activeDay === day.key
          return (
            <button
              key={day.key}
              onClick={() => setActiveDay(day.key)}
              style={{
                flex: 1,
                background: active ? '#d4a333' : 'transparent',
                color: active ? '#231903' : '#3b322a',
                padding: '8px 12px',
                fontWeight: active ? 600 : 500,
                fontSize: '14px',
              }}
            >
              {day.label}
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                opacity: 0.7,
              }}>
                {counts[day.key] || 0}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: '40px' }}>
          No upcoming {DAY_TABS.find(d => d.key === activeDay)?.label} loops yet.
        </p>
      )}

      {filtered.map(group => {
        const schedule = Array.isArray(group.schedule) ? group.schedule : []
        const isTonight = group.event_date === today
        const currentIdx = isTonight ? currentStopIndex(schedule, now, group.event_date, today) : -1
        const members = group.group_members || []
        const membersByStop = new Map()
        for (const m of members) {
          const effectiveIdx = m.current_stop_index ?? currentIdx
          const bucket = effectiveIdx >= 0 && effectiveIdx < schedule.length ? effectiveIdx : 'not_started'
          if (!membersByStop.has(bucket)) membersByStop.set(bucket, [])
          membersByStop.get(bucket).push(m)
        }
        const isExpanded = expanded === group.id
        const tickets = ticketsByGroup[group.id] || 0
        const hasGap = tickets > 0 && tickets !== members.length

        return (
          <div key={group.id} className="card">
            <div
              onClick={() => setExpanded(isExpanded ? null : group.id)}
              style={{ cursor: 'pointer' }}
              className="row"
            >
              <div>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#17130f' }}>
                  {formatEventDate(group.event_date)}
                  {isTonight && <span className="chip chip-gold" style={{ marginLeft: '8px' }}>LIVE</span>}
                </p>
                <p className="muted" style={{ fontSize: '12px' }}>
                  Pickup {group.pickup_time || 'TBD'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <a
                  href={`${base}/groups/${group.id}#summary`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    color: '#3b322a', fontSize: '12px', textDecoration: 'none',
                    padding: '6px 10px', border: '1px solid #e8ddc8', borderRadius: '6px',
                    minHeight: 32, display: 'inline-flex', alignItems: 'center',
                    fontWeight: 600,
                  }}
                >
                  Summary
                </a>
                {hasGap ? (
                  // Group buys: more tickets than named rider rows (e.g. a party
                  // of 4 bought under one name). Show the true ticket headcount;
                  // tint + tooltip note how many have individual rider details.
                  <span
                    className="chip"
                    title={`${tickets} ticket${tickets === 1 ? '' : 's'} sold · ${members.length} with rider details${tickets > members.length ? ` · ${tickets - members.length} on group buys without names` : ''}`}
                    style={{
                      background: 'rgba(212,163,51,0.12)',
                      borderColor: 'rgba(212,163,51,0.5)',
                      color: '#8a5f0a',
                      fontWeight: 700,
                    }}
                  >
                    {tickets} rider{tickets === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="chip">{(tickets || members.length)} rider{(tickets || members.length) === 1 ? '' : 's'}</span>
                )}
                <span className="muted" style={{ fontSize: '14px' }}>{isExpanded ? '▾' : '▸'}</span>
              </div>
            </div>

            {isExpanded && (
              <>
                {schedule.length === 0 ? (
                  <p className="muted" style={{ marginTop: '12px', textAlign: 'center', fontSize: 13 }}>
                    No schedule yet. Set one in{' '}
                    {business === 'surf'
                      ? <a href={`${base}/builder`} style={{ color: '#8a5f0a' }}>the route builder</a>
                      : <a href={`/leadership/loops/${group.id}#edit`} style={{ color: '#8a5f0a' }}>Leadership → Loops</a>}.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '4px', margin: '12px 0 4px', overflowX: 'auto' }}>
                      {schedule.map((stop, i) => {
                        const active = i === currentIdx
                        const past = currentIdx > i
                        return (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              minWidth: '72px',
                              textAlign: 'center',
                              padding: '8px 6px',
                              borderRadius: '8px',
                              background: active ? '#d4a333' : past ? '#e4f6ec' : '#fdfaf3',
                              color: active ? '#231903' : past ? '#0f7a4e' : '#6e6154',
                              border: active ? '1px solid #d4a333' : '1px solid #e8ddc8',
                              fontSize: '11px',
                              fontWeight: active ? 700 : 500,
                            }}
                          >
                            <div className="tiny" style={{ color: active ? '#231903' : undefined }}>{formatStopTime(stop.start_time)}</div>
                            <div style={{ marginTop: '2px', color: active ? '#231903' : past ? '#0f7a4e' : '#3b322a' }}>{stop.name}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      {(() => {
                        const unassigned = membersByStop.get('not_started') || []
                        if (!unassigned.length) return null
                        const key = `${group.id}:unassigned`
                        const isOpen = openStop === key
                        return (
                          <div
                            style={{
                              padding: '12px 14px',
                              marginBottom: '6px',
                              borderRadius: '10px',
                              border: '1px solid #d8543f',
                              background: '#fdeae6',
                            }}
                          >
                            <div
                              onClick={() => setOpenStop(isOpen ? null : key)}
                              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                            >
                              <div>
                                <p style={{ fontWeight: 700, color: '#b3311f', fontSize: '14px' }}>Unassigned</p>
                                <p className="tiny" style={{ color: '#b3311f' }}>No stop yet — tap a rider to assign</p>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="chip" style={{ background: '#fdeae6', color: '#b3311f', borderColor: '#d8543f' }}>{seatsAt(unassigned)}</span>
                                <span className="muted" style={{ fontSize: '12px' }}>{isOpen ? '▾' : '▸'}</span>
                              </div>
                            </div>
                            {isOpen && (
                              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #fdeae6' }}>
                                {unassigned.map(m => (
                                  <RiderRow
                                    key={m.id}
                                    member={m}
                                    schedule={schedule}
                                    pickerOpen={pickerMember === m.id}
                                    onOpenPicker={() => setPickerMember(pickerMember === m.id ? null : m.id)}
                                    onMove={moveRider}
                                    tickets={ticketsByContact[m.contacts?.id] || 1}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                      {schedule.map((stop, i) => {
                        const atStop = membersByStop.get(i) || []
                        const key = `${group.id}:${i}`
                        const isActive = i === currentIdx
                        const isOpen = openStop === key
                        return (
                          <StopCard key={i} isActive={isActive}>
                            <div
                              onClick={() => setOpenStop(isOpen ? null : key)}
                              style={{
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <div>
                                <p style={{ fontWeight: 600, color: isActive ? '#8a5f0a' : '#17130f', fontSize: '14px' }}>
                                  {stop.name}
                                </p>
                                <p className="tiny">{formatStopTime(stop.start_time)}</p>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="chip">{seatsAt(atStop)}</span>
                                <span className="muted" style={{ fontSize: '12px' }}>{isOpen ? '▾' : '▸'}</span>
                              </div>
                            </div>

                            {isOpen && (
                              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f3ecdd' }}>
                                {atStop.length === 0 ? (
                                  <p className="muted" style={{ fontSize: '13px', padding: '8px 0' }}>
                                    No one starting at this stop.
                                  </p>
                                ) : (
                                  <>
                                    <p className="tiny" style={{ marginBottom: '4px' }}>Tap a rider to move them to another stop</p>
                                    {atStop.map(m => (
                                      <RiderRow
                                        key={m.id}
                                        member={m}
                                        schedule={schedule}
                                        pickerOpen={pickerMember === m.id}
                                        onOpenPicker={() => setPickerMember(pickerMember === m.id ? null : m.id)}
                                        onMove={moveRider}
                                        tickets={ticketsByContact[m.contacts?.id] || 1}
                                      />
                                    ))}
                                  </>
                                )}

                                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f3ecdd' }}>
                                  <h3 style={{ marginBottom: '6px' }}>Text this group</h3>
                                  <p className="tiny" style={{ marginBottom: '6px' }}>
                                    Use <code>{'{first_name}'}</code> to personalize.
                                  </p>
                                  <textarea
                                    rows={2}
                                    placeholder={`Hey {first_name}, we're at ${stop.name}...`}
                                    value={stopMessage[key] || ''}
                                    onChange={e => setStopMessage({ ...stopMessage, [key]: e.target.value })}
                                  />
                                  <button
                                    className="btn-primary"
                                    onClick={() => sendStopSMS(group, i, atStop)}
                                    disabled={sending[key] || atStop.length === 0}
                                  >
                                    {sending[key] ? 'Sending…' : `Send to ${atStop.length} at ${stop.name}`}
                                  </button>
                                </div>
                              </div>
                            )}
                          </StopCard>
                        )
                      })}
                    </div>

                    {!isTonight && members.length > 0 && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e8ddc8' }}>
                        <h3 style={{ marginBottom: '6px' }}>Riders ({members.length})</h3>
                        {members.map(m => (
                          <div key={m.id} style={{ padding: '6px 0', fontSize: '13px', color: '#3b322a', borderTop: '1px solid #f3ecdd' }}>
                            {m.contacts?.first_name} {m.contacts?.last_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
    </main>
  )
}

function RiderRow({ member, schedule, pickerOpen, onOpenPicker, onMove, tickets = 1 }) {
  const moved = member.current_stop_index != null
  return (
    <>
      <div
        onClick={onOpenPicker}
        style={{
          padding: '10px 0',
          borderTop: '1px solid #f3ecdd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: '#17130f' }}>
          {member.contacts?.first_name} {member.contacts?.last_name}
          {tickets > 1 && (
            <span style={{
              marginLeft: 8,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(212,163,51,0.15)',
              color: '#8a5f0a',
              border: '1px solid rgba(212,163,51,0.4)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}>{tickets} tix</span>
          )}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {moved && <span className="chip chip-gold" style={{ fontSize: '10px', padding: '1px 6px' }}>moved</span>}
          <span style={{
            background: '#d4a333',
            color: '#231903',
            fontSize: '12px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '999px',
          }}>
            {pickerOpen ? 'Close' : 'Move'}
          </span>
        </div>
      </div>
      {pickerOpen && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          padding: '10px',
          background: '#fdfaf3',
          border: '1px solid #f3ecdd',
          borderRadius: '10px',
          margin: '6px 0',
        }}>
          {schedule.map((s, si) => {
            const selected = si === member.current_stop_index
            return (
              <button
                key={si}
                onClick={() => onMove(member.id, si)}
                style={{
                  background: selected ? '#d4a333' : '#f3ecdd',
                  color: selected ? '#231903' : '#17130f',
                  border: selected ? '1px solid #d4a333' : '1px solid #e8ddc8',
                  padding: '10px 8px',
                  fontSize: '13px',
                  fontWeight: selected ? 600 : 500,
                  textAlign: 'left',
                }}
              >
                {s.name}
              </button>
            )
          })}
          <button
            onClick={() => onMove(member.id, null)}
            style={{
              gridColumn: '1 / -1',
              background: '#f3ecdd',
              color: '#6e6154',
              border: '1px solid #e8ddc8',
              padding: '8px',
              fontSize: '12px',
            }}
          >
            Clear (follow group)
          </button>
        </div>
      )}
    </>
  )
}

function StopCard({ isActive, children }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        marginBottom: '6px',
        borderRadius: '10px',
        border: isActive ? '1px solid #d4a333' : '1px solid #e8ddc8',
        background: '#ffffff',
      }}
    >
      {children}
    </div>
  )
}

function initialDay() {
  try {
    const iso = operationalDateInTZ()
    const weekday = new Date(`${iso}T12:00:00-05:00`).getDay()
    if (weekday === 6) return 'saturday'
  } catch {}
  return 'friday'
}

function formatEventDate(iso) {
  if (!iso) return 'No date'
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}
