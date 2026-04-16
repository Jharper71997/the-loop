'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core'
import { supabase } from '@/lib/supabase'
import { personalize } from '@/lib/personalize'
import {
  buildDefaultSchedule,
  currentStopIndex,
  formatStopTime,
  nowInTZ,
  todayInTZ,
} from '@/lib/schedule'

const DAY_TABS = [
  { key: 'friday', label: 'Friday', weekday: 5 },
  { key: 'saturday', label: 'Saturday', weekday: 6 },
]

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [now, setNow] = useState(() => nowInTZ())
  const [today] = useState(() => todayInTZ())
  const [activeDay, setActiveDay] = useState(() => initialDay())
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [scheduleDraft, setScheduleDraft] = useState([])
  const [stopMessage, setStopMessage] = useState({})
  const [sending, setSending] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [dragging, setDragging] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  )

  useEffect(() => {
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
    setGroups(data || [])
  }

  async function generateScheduleFor(group) {
    const schedule = buildDefaultSchedule(group.pickup_time || '19:30', 'Angry Ginger')
    if (!schedule) return alert('Set a pickup time on this group first.')
    await supabase.from('groups').update({ schedule }).eq('id', group.id)
    fetchGroups()
  }

  function startEditSchedule(group) {
    setEditingSchedule(group.id)
    setScheduleDraft(group.schedule || buildDefaultSchedule(group.pickup_time || '19:30', 'Stop 1') || [])
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
    await supabase
      .from('group_members')
      .update({ current_stop_index: stopIdx })
      .eq('id', memberId)
  }

  function onDragEnd(event) {
    setDragging(null)
    const memberId = event.active?.id
    const dest = event.over?.id
    if (!memberId || !dest) return
    const [, idxStr] = String(dest).split(':')
    if (idxStr === undefined) return
    const idx = idxStr === 'auto' ? null : Number(idxStr)
    if (idx !== null && Number.isNaN(idx)) return
    moveRider(memberId, idx)
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
    return groups
      .filter(g => {
        if (!g.event_date) return false
        if (g.event_date < today) return false
        const d = new Date(`${g.event_date}T12:00:00-05:00`).getDay()
        return d === target
      })
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
  }, [groups, activeDay, today])

  const counts = useMemo(() => {
    const out = {}
    for (const day of DAY_TABS) {
      out[day.key] = groups
        .filter(g => {
          if (!g.event_date || g.event_date < today) return false
          return new Date(`${g.event_date}T12:00:00-05:00`).getDay() === day.weekday
        })
        .reduce((sum, g) => sum + (g.group_members?.length || 0), 0)
    }
    return out
  }, [groups, today])

  const dragRiderName = useMemo(() => {
    if (!dragging) return null
    for (const g of groups) {
      for (const m of g.group_members || []) {
        if (m.id === dragging) return `${m.contacts?.first_name || ''} ${m.contacts?.last_name || ''}`.trim()
      }
    }
    return null
  }, [dragging, groups])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={e => setDragging(e.active?.id)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
    <main>
      <h1>Loops</h1>
      <p className="muted" style={{ marginBottom: '14px' }}>
        Upcoming pickups by night · {now} · Drag a rider between stops to reassign.
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
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="chip">{members.length} rider{members.length === 1 ? '' : 's'}</span>
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
                        {scheduleDraft.map((stop, i) => (
                          <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                            <input
                              style={{ flex: 2, marginBottom: 0, fontSize: '13px' }}
                              value={stop.name}
                              onChange={e => {
                                const next = [...scheduleDraft]
                                next[i] = { ...next[i], name: e.target.value }
                                setScheduleDraft(next)
                              }}
                            />
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
                        ))}
                        <button className="btn-primary" onClick={() => saveSchedule(group)}>Save Schedule</button>
                      </div>
                    )}

                    {schedule.map((stop, i) => {
                      const atStop = membersByStop.get(i) || []
                      const key = `${group.id}:${i}`
                      const isActive = i === currentIdx
                      return (
                        <StopDropZone key={i} id={`${group.id}:${i}`} isActive={isActive} hasRiders={atStop.length > 0}>
                          <div className="row">
                            <div>
                              <p style={{ fontWeight: 600, color: isActive ? '#d4a333' : '#e8e8ea', fontSize: '14px' }}>
                                {stop.name}
                              </p>
                              <p className="tiny">{formatStopTime(stop.start_time)}</p>
                            </div>
                            <span className="chip">{atStop.length}</span>
                          </div>

                          {atStop.length === 0 && (
                            <p className="tiny" style={{ marginTop: '6px' }}>
                              Drop a rider here
                            </p>
                          )}

                          {atStop.map(m => (
                            <DraggableRider key={m.id} member={m} />
                          ))}

                          {atStop.length > 0 && (
                            <div style={{ marginTop: '10px' }}>
                              <textarea
                                rows={2}
                                placeholder={`Hey {first_name}, we're at ${stop.name}...`}
                                value={stopMessage[key] || ''}
                                onChange={e => setStopMessage({ ...stopMessage, [key]: e.target.value })}
                              />
                              <button
                                className="btn-primary"
                                onClick={() => sendStopSMS(group, i, atStop)}
                                disabled={sending[key]}
                              >
                                {sending[key] ? 'Sending…' : `Text ${atStop.length} at ${stop.name}`}
                              </button>
                            </div>
                          )}
                        </StopDropZone>
                      )
                    })}

                    <div style={{ marginTop: '10px' }}>
                      <AutoDropZone id={`${group.id}:auto`} />
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
    <DragOverlay>
      {dragRiderName ? (
        <div style={{
          background: '#1c1c22',
          color: '#e8e8ea',
          border: '1px solid #d4a333',
          borderRadius: '10px',
          padding: '8px 12px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          {dragRiderName}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}

function DraggableRider({ member }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: member.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        padding: '8px 0',
        borderTop: '1px solid #1a1a1f',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        cursor: 'grab',
        touchAction: 'none',
        opacity: isDragging ? 0.35 : 1,
      }}
    >
      <span style={{ minWidth: 0, flex: 1, color: '#e8e8ea' }}>
        {member.contacts?.first_name} {member.contacts?.last_name}
        {member.current_stop_index != null && (
          <span className="chip chip-gold" style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px' }}>
            override
          </span>
        )}
      </span>
      <span className="muted" style={{ fontSize: '11px' }}>⋮⋮</span>
    </div>
  )
}

function AutoDropZone({ id }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '8px 12px',
        border: isOver ? '1px dashed #d4a333' : '1px dashed #2a2a2f',
        borderRadius: '8px',
        textAlign: 'center',
        color: '#6f6f76',
        fontSize: '11px',
        background: isOver ? 'rgba(212, 163, 51, 0.08)' : 'transparent',
      }}
    >
      Drop here to clear override (auto-follow group)
    </div>
  )
}

function StopDropZone({ id, isActive, hasRiders, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        marginTop: '12px',
        paddingTop: '12px',
        paddingBottom: hasRiders ? '0' : '6px',
        borderTop: '1px solid #1e1e23',
        borderRadius: '6px',
        background: isOver ? 'rgba(212, 163, 51, 0.08)' : 'transparent',
        outline: isOver ? '1px dashed #d4a333' : 'none',
        transition: 'background 0.12s',
      }}
    >
      {children}
    </div>
  )
}

function initialDay() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Indiana/Indianapolis',
      weekday: 'short',
    }).format(new Date())
    if (parts === 'Sat') return 'saturday'
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
