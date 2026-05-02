'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { personalize } from '@/lib/personalize'
import {
  buildDefaultSchedule,
  currentStopIndex,
  formatStopTime,
  nowInTZ,
  operationalDateInTZ,
} from '@/lib/schedule'
import { PARTNER_BAR_NAMES } from '@/lib/bars'

const DAY_TABS = [
  { key: 'friday', label: 'Friday', weekday: 5 },
  { key: 'saturday', label: 'Saturday', weekday: 6 },
]

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [groupHasEvent, setGroupHasEvent] = useState({})
  const [ticketsByGroup, setTicketsByGroup] = useState({})
  const [ticketsByContact, setTicketsByContact] = useState({})
  const [now, setNow] = useState(() => nowInTZ())
  const [today] = useState(() => operationalDateInTZ())
  const [activeDay, setActiveDay] = useState(() => initialDay())
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [scheduleDraft, setScheduleDraft] = useState([])
  const [stopMessage, setStopMessage] = useState({})
  const [sending, setSending] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [openStop, setOpenStop] = useState(null)
  const [pickerMember, setPickerMember] = useState(null)

  useEffect(() => {
    // Auto bulk-sync was overwriting custom schedule edits when there were
    // duplicate groups in the DB — disabled. Per-event sync still runs when
    // a ticket type is added/edited from /api/events PUT.
    fetchGroups()
    const t = setInterval(() => setNow(nowInTZ()), 60000)
    return () => clearInterval(t)
  }, [])

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
      .order('event_date')
    const groupRows = data || []
    setGroups(groupRows)

    const groupIds = groupRows.map(g => g.id)
    if (!groupIds.length) {
      setTicketsByGroup({})
      setTicketsByContact({})
      return
    }

    // Build lookup tables: event_id → group_id, tt_event_id → group_id.
    // Then pull all recent paid orders once and attribute by either path.
    const { data: events } = await supabase
      .from('events')
      .select('id, group_id')
      .in('group_id', groupIds)
    const eventToGroup = new Map((events || []).map(e => [e.id, e.group_id]))
    // Track which groups have a paired event so the list view can dedupe
    // dates that ended up with both an old orphan group and a new
    // group-with-event from a re-create.
    const hasEvent = {}
    for (const e of events || []) hasEvent[e.group_id] = true
    setGroupHasEvent(hasEvent)
    const ttToGroup = new Map(
      groupRows.filter(g => g.tt_event_id).map(g => [String(g.tt_event_id), g.id])
    )

    // Pull paid orders from the last 90 days — broad enough for any visible
    // Loop's purchases. Filter client-side so we don't depend on a specific
    // PostgREST JSON-path .in() syntax that's harder to verify.
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
    const { data: paidOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, contact_id, party_size, event_id, metadata, paid_at')
      .eq('status', 'paid')
      .gte('paid_at', since)
    if (ordersErr) console.error('[Loops] orders fetch failed', ordersErr)

    const groupTotals = {}
    const contactTotals = {}
    for (const o of paidOrders || []) {
      let gid = eventToGroup.get(o.event_id) || null
      if (!gid && o.metadata?.tt_event_id) {
        gid = ttToGroup.get(String(o.metadata.tt_event_id)) || null
      }
      if (!gid) continue
      const size = Number(o.party_size) || 1
      groupTotals[gid] = (groupTotals[gid] || 0) + size
      if (o.contact_id) {
        contactTotals[o.contact_id] = (contactTotals[o.contact_id] || 0) + size
      }
    }

    setTicketsByGroup(groupTotals)
    setTicketsByContact(contactTotals)
  }

  async function generateScheduleFor(group) {
    // Default rotation order for the bar picker — Jacob can rearrange in the
    // editor afterward. Pulls 5 bars from PARTNER_BAR_NAMES so the schedule
    // never starts with generic "Stop 2/3/4/5" labels.
    const bars = PARTNER_BAR_NAMES.slice(0, 5)
    const schedule = buildDefaultSchedule(group.pickup_time || '19:30', { bars })
    if (!schedule) return alert('Set a pickup time on this group first.')
    await supabase.from('groups').update({ schedule }).eq('id', group.id)
    fetchGroups()
  }

  function startEditSchedule(group) {
    setEditingSchedule(group.id)
    const seeded = group.schedule || buildDefaultSchedule(group.pickup_time || '19:30', {
      bars: PARTNER_BAR_NAMES.slice(0, 5),
    }) || []
    setScheduleDraft(seeded)
  }

  async function saveSchedule(group) {
    await supabase.from('groups').update({ schedule: scheduleDraft }).eq('id', group.id)
    setEditingSchedule(null)
    fetchGroups()
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
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }))
      )
    )
    setSending(s => ({ ...s, [key]: false }))
    const failed = results.filter(r => !r.success).length
    alert(failed === 0 ? `Sent to ${withPhones.length}!` : `Sent ${withPhones.length - failed} of ${withPhones.length}. ${failed} failed.`)
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

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Loops</h1>
        <a href="/admin/groups/new" style={{
          background: '#d4a333', color: '#0a0a0b', padding: '10px 16px', borderRadius: 8,
          fontWeight: 700, fontSize: 13, textDecoration: 'none',
          minHeight: 44, display: 'inline-flex', alignItems: 'center',
        }}>+ New Loop</a>
      </div>
      <p className="muted" style={{ marginBottom: '14px' }}>
        Upcoming pickups by night · {now}
      </p>

      <div style={{
        display: 'flex',
        gap: '6px',
        background: '#121215',
        border: '1px solid #1e1e23',
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
                color: active ? '#0a0a0b' : '#c8c8cc',
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
        const isEditing = editingSchedule === group.id
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
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#e8e8ea' }}>
                  {formatEventDate(group.event_date)}
                  {isTonight && <span className="chip chip-gold" style={{ marginLeft: '8px' }}>LIVE</span>}
                </p>
                <p className="muted" style={{ fontSize: '12px' }}>
                  Pickup {group.pickup_time || 'TBD'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <a
                  href={`/admin/groups/${group.id}#summary`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    color: '#c8c8cc', fontSize: '12px', textDecoration: 'none',
                    padding: '6px 10px', border: '1px solid #2a2a31', borderRadius: '6px',
                    minHeight: 32, display: 'inline-flex', alignItems: 'center',
                    fontWeight: 600,
                  }}
                >
                  Summary
                </a>
                <a
                  href={`/admin/groups/${group.id}#tickets`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    color: '#c8c8cc', fontSize: '12px', textDecoration: 'none',
                    padding: '6px 10px', border: '1px solid #2a2a31', borderRadius: '6px',
                    minHeight: 32, display: 'inline-flex', alignItems: 'center',
                    fontWeight: 600,
                  }}
                >
                  Tickets
                </a>
                <a
                  href={`/admin/groups/${group.id}#edit`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    color: '#d4a333', fontSize: '12px', textDecoration: 'none',
                    padding: '6px 10px', border: '1px solid #d4a333', borderRadius: '6px',
                    minHeight: 32, display: 'inline-flex', alignItems: 'center',
                    fontWeight: 600,
                  }}
                >
                  Settings
                </a>
                {hasGap ? (
                  // Tickets sold > named contacts on roster — usually TT orders
                  // shipped without buyer details. Surface both numbers + a
                  // warning tint so the admin knows to chase the missing info.
                  <span
                    className="chip"
                    title={`${tickets} ticket${tickets === 1 ? '' : 's'} sold, ${members.length} rider${members.length === 1 ? '' : 's'} with contact info — ${tickets - members.length} missing`}
                    style={{
                      background: 'rgba(212,163,51,0.12)',
                      borderColor: 'rgba(212,163,51,0.5)',
                      color: '#f0c24a',
                      fontWeight: 700,
                    }}
                  >
                    {members.length}/{tickets} riders
                  </span>
                ) : (
                  <span className="chip">{members.length} rider{members.length === 1 ? '' : 's'}</span>
                )}
                <span className="muted" style={{ fontSize: '14px' }}>{isExpanded ? '▾' : '▸'}</span>
              </div>
            </div>

            {isExpanded && (
              <>
                {schedule.length === 0 ? (
                  <div style={{ marginTop: '12px' }}>
                    <button className="btn-subtle" style={{ width: '100%' }} onClick={() => generateScheduleFor(group)}>
                      Generate 5-stop schedule
                    </button>
                  </div>
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
                              background: active ? '#d4a333' : past ? '#152218' : '#16161a',
                              color: active ? '#0a0a0b' : past ? '#6fbf7f' : '#8a8a90',
                              border: active ? '1px solid #d4a333' : '1px solid #1e1e23',
                              fontSize: '11px',
                              fontWeight: active ? 700 : 500,
                            }}
                          >
                            <div className="tiny" style={{ color: active ? '#0a0a0b' : undefined }}>{formatStopTime(stop.start_time)}</div>
                            <div style={{ marginTop: '2px', color: active ? '#0a0a0b' : past ? '#6fbf7f' : '#c8c8cc' }}>{stop.name}</div>
                          </div>
                        )
                      })}
                    </div>
                    <button
                      className="btn-link"
                      onClick={() => isEditing ? setEditingSchedule(null) : startEditSchedule(group)}
                    >
                      {isEditing ? 'Cancel edit' : 'Edit schedule'}
                    </button>

                    {isEditing && (
                      <div style={{ border: '1px solid #1e1e23', borderRadius: '8px', padding: '10px', margin: '8px 0 12px' }}>
                        {scheduleDraft.map((stop, i) => {
                          const isCustom = stop.name && !PARTNER_BAR_NAMES.includes(stop.name)
                          return (
                            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                              <select
                                style={{ flex: 2, marginBottom: 0, fontSize: '13px' }}
                                value={isCustom ? '__custom__' : (stop.name || '')}
                                onChange={e => {
                                  const next = [...scheduleDraft]
                                  next[i] = { ...next[i], name: e.target.value === '__custom__' ? '' : e.target.value }
                                  setScheduleDraft(next)
                                }}
                              >
                                <option value="">Pick a bar…</option>
                                {PARTNER_BAR_NAMES.map(bar => (
                                  <option key={bar} value={bar}>{bar}</option>
                                ))}
                                <option value="__custom__">Other (type below)</option>
                              </select>
                              <input
                                style={{ flex: 1, marginBottom: 0, fontSize: '13px' }}
                                placeholder="HH:MM"
                                value={stop.start_time}
                                onChange={e => {
                                  const next = [...scheduleDraft]
                                  next[i] = { ...next[i], start_time: e.target.value }
                                  setScheduleDraft(next)
                                }}
                              />
                            </div>
                          )
                        })}
                        <button className="btn-primary" onClick={() => saveSchedule(group)}>Save Schedule</button>
                      </div>
                    )}

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
                              border: '1px solid #f87171',
                              background: '#1a0f0f',
                            }}
                          >
                            <div
                              onClick={() => setOpenStop(isOpen ? null : key)}
                              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                            >
                              <div>
                                <p style={{ fontWeight: 700, color: '#f87171', fontSize: '14px' }}>Unassigned</p>
                                <p className="tiny" style={{ color: '#f87171' }}>No stop yet — tap a rider to assign</p>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="chip" style={{ background: '#3a1a1a', color: '#f87171', borderColor: '#f87171' }}>{unassigned.length}</span>
                                <span className="muted" style={{ fontSize: '12px' }}>{isOpen ? '▾' : '▸'}</span>
                              </div>
                            </div>
                            {isOpen && (
                              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #3a1a1a' }}>
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
                                <p style={{ fontWeight: 600, color: isActive ? '#d4a333' : '#e8e8ea', fontSize: '14px' }}>
                                  {stop.name}
                                </p>
                                <p className="tiny">{formatStopTime(stop.start_time)}</p>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="chip">{atStop.length}</span>
                                <span className="muted" style={{ fontSize: '12px' }}>{isOpen ? '▾' : '▸'}</span>
                              </div>
                            </div>

                            {isOpen && (
                              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #1a1a1f' }}>
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

                                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #1a1a1f' }}>
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
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1e1e23' }}>
                        <h3 style={{ marginBottom: '6px' }}>Riders ({members.length})</h3>
                        {members.map(m => (
                          <div key={m.id} style={{ padding: '6px 0', fontSize: '13px', color: '#c8c8cc', borderTop: '1px solid #1a1a1f' }}>
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
          borderTop: '1px solid #1a1a1f',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: '#e8e8ea' }}>
          {member.contacts?.first_name} {member.contacts?.last_name}
          {tickets > 1 && (
            <span style={{
              marginLeft: 8,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(212,163,51,0.15)',
              color: '#d4a333',
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
            color: '#0a0a0b',
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
          background: '#16161a',
          border: '1px solid #24242a',
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
                  background: selected ? '#d4a333' : '#1c1c22',
                  color: selected ? '#0a0a0b' : '#e8e8ea',
                  border: selected ? '1px solid #d4a333' : '1px solid #2a2a2f',
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
              background: '#1c1c22',
              color: '#8a8a90',
              border: '1px solid #2a2a2f',
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
        border: isActive ? '1px solid #d4a333' : '1px solid #1e1e23',
        background: '#121215',
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
