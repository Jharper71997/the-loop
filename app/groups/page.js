'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { personalize } from '@/lib/personalize'
import {
  buildDefaultSchedule,
  currentStopIndex,
  formatStopTime,
  nowInTZ,
  todayInTZ,
} from '@/lib/schedule'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [now, setNow] = useState(() => nowInTZ())
  const [today] = useState(() => todayInTZ())
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [scheduleDraft, setScheduleDraft] = useState([])
  const [stopMessage, setStopMessage] = useState({})
  const [sending, setSending] = useState({})
  const [movingRider, setMovingRider] = useState(null)

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
    await supabase
      .from('group_members')
      .update({ current_stop_index: stopIdx })
      .eq('id', memberId)
    setMovingRider(null)
    fetchGroups()
  }

  async function sendStopSMS(group, stopIdx, riders) {
    const key = `${group.id}:${stopIdx}`
    const template = stopMessage[key]
    if (!template) return alert('Type a message first')
    const withPhones = riders.filter(r => r.contacts?.phone)
    if (!withPhones.length) return alert('No riders with phones at this stop.')
    if (!confirm(`Send to ${withPhones.length} rider${withPhones.length === 1 ? '' : 's'} at this stop?`)) return

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

  const upcoming = useMemo(
    () => groups.filter(g => !g.event_date || g.event_date >= today),
    [groups, today]
  )

  return (
    <main>
      <h1>Tonight&apos;s Loops</h1>
      <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
        Clock: {now} · {today}
      </p>

      {upcoming.length === 0 && (
        <p style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
          No upcoming loops. New ones appear here when someone buys a ticket.
        </p>
      )}

      {upcoming.map(group => {
        const schedule = Array.isArray(group.schedule) ? group.schedule : []
        const currentIdx = currentStopIndex(schedule, now, group.event_date, today)
        const members = group.group_members || []
        const membersByStop = new Map()
        for (const m of members) {
          const effectiveIdx = m.current_stop_index ?? currentIdx
          const bucket = effectiveIdx >= 0 && effectiveIdx < schedule.length ? effectiveIdx : 'not_started'
          if (!membersByStop.has(bucket)) membersByStop.set(bucket, [])
          membersByStop.get(bucket).push(m)
        }
        const isEditing = editingSchedule === group.id

        return (
          <div key={group.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <p style={{ fontWeight: 600, color: '#f0c040', fontSize: '15px' }}>{group.name}</p>
                <p style={{ color: '#888', fontSize: '13px' }}>
                  {group.event_date || 'No date'} · Pickup {group.pickup_time || 'TBD'}
                </p>
              </div>
              <span style={{ color: '#888', fontSize: '13px' }}>
                {members.length} rider{members.length === 1 ? '' : 's'}
              </span>
            </div>

            {schedule.length === 0 ? (
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() => generateScheduleFor(group)}
                  style={{ background: '#1a1a1a', color: '#f0c040', border: '1px solid #2a2a2a', fontSize: '13px', width: '100%' }}
                >
                  Generate 5-stop schedule from pickup time
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
                          minWidth: '80px',
                          textAlign: 'center',
                          padding: '8px 6px',
                          borderRadius: '8px',
                          background: active ? '#f0c040' : past ? '#1a2216' : '#1a1a1a',
                          color: active ? '#0d0d0d' : past ? '#4aa84a' : '#888',
                          border: active ? '1px solid #f0c040' : '1px solid #2a2a2a',
                          fontSize: '11px',
                          fontWeight: active ? 700 : 500,
                        }}
                      >
                        <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>{formatStopTime(stop.start_time)}</div>
                        <div style={{ marginTop: '2px' }}>{stop.name}</div>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={() => isEditing ? setEditingSchedule(null) : startEditSchedule(group)}
                  style={{ background: 'none', color: '#888', fontSize: '12px', padding: '4px 0', marginBottom: '8px' }}
                >
                  {isEditing ? 'Cancel edit' : '✎ Edit schedule'}
                </button>

                {isEditing && (
                  <div style={{ border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
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
                    <div
                      key={i}
                      style={{
                        marginTop: '10px',
                        borderTop: '1px solid #2a2a2a',
                        paddingTop: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <p style={{ fontWeight: 600, color: isActive ? '#f0c040' : '#f0f0f0', fontSize: '14px' }}>
                            {isActive && '🟢 '}{stop.name}
                          </p>
                          <p style={{ color: '#666', fontSize: '12px' }}>{formatStopTime(stop.start_time)}</p>
                        </div>
                        <span style={{ color: '#666', fontSize: '12px' }}>
                          {atStop.length} here
                        </span>
                      </div>

                      {atStop.map(m => (
                        <div
                          key={m.id}
                          style={{
                            padding: '6px 0',
                            borderBottom: '1px solid #222',
                            fontSize: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ fontWeight: 500 }}>
                              {m.contacts?.first_name} {m.contacts?.last_name}
                            </span>
                            {m.current_stop_index != null && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', color: '#f0c040', border: '1px solid #3a3220', padding: '1px 5px', borderRadius: '8px' }}>
                                override
                              </span>
                            )}
                          </span>
                          {movingRider === m.id ? (
                            <select
                              autoFocus
                              onBlur={() => setMovingRider(null)}
                              onChange={e => moveRider(m.id, e.target.value === '' ? null : Number(e.target.value))}
                              style={{ width: 'auto', marginBottom: 0, fontSize: '12px', padding: '4px 6px' }}
                            >
                              <option value="">— auto (follow group) —</option>
                              {schedule.map((s, si) => (
                                <option key={si} value={si}>{s.name} ({formatStopTime(s.start_time)})</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setMovingRider(m.id)}
                              style={{ background: 'none', color: '#888', fontSize: '12px', padding: '2px 6px' }}
                            >
                              Move →
                            </button>
                          )}
                        </div>
                      ))}

                      {atStop.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
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
                    </div>
                  )
                })}

                {membersByStop.get('not_started')?.length > 0 && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid #2a2a2a', paddingTop: '10px' }}>
                    <p style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>
                      Not started yet ({membersByStop.get('not_started').length})
                    </p>
                    {membersByStop.get('not_started').map(m => (
                      <div key={m.id} style={{ padding: '4px 0', fontSize: '13px', color: '#aaa' }}>
                        {m.contacts?.first_name} {m.contacts?.last_name}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </main>
  )
}
