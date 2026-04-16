'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [message, setMessage] = useState('')
  const [assignedGroup, setAssignedGroup] = useState('')

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
      .sort((a, b) => {
        const aLast = a.past[0]?.event_date || ''
        const bLast = b.past[0]?.event_date || ''
        if (aLast && bLast) return bLast.localeCompare(aLast)
        if (aLast) return -1
        if (bLast) return 1
        return (a.last_name || '').localeCompare(b.last_name || '')
      })
  }, [contacts, groups, members, search, today])

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
          <h3>Assign to Group</h3>
          <select value={assignedGroup} onChange={e => setAssignedGroup(e.target.value)}>
            <option value="">Select a group...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}{g.pickup_time ? ` — ${g.pickup_time}` : ''}</option>
            ))}
          </select>
          <button className="btn-green" onClick={assignToGroup}>Assign</button>
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

  return (
    <main>
      <h1>Contacts</h1>
      <input
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div style={{ color: '#888', fontSize: '13px', margin: '4px 0 16px' }}>
        {enriched.length} contact{enriched.length === 1 ? '' : 's'}
      </div>

      {enriched.map(c => (
        <div
          key={c.id}
          className="card"
          onClick={() => setSelected(c)}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="rider-name">{c.first_name} {c.last_name}</p>
              <p className="rider-phone">{c.phone}</p>
            </div>
            <span style={{ color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
              {c.past.length} ride{c.past.length === 1 ? '' : 's'}
            </span>
          </div>
          {(c.past.length > 0 || c.upcoming.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {c.upcoming.slice(0, 2).map(g => (
                <span key={g.id} style={{ ...rideChipStyle, background: '#1a2a1a', color: '#4aa84a', borderColor: '#2a3f2a', fontSize: '11px' }}>
                  ↗ {formatEventDate(g.event_date) || g.name}
                </span>
              ))}
              {c.past.slice(0, 4).map(g => (
                <span key={g.id} style={{ ...rideChipStyle, fontSize: '11px' }}>
                  {formatEventDate(g.event_date)}
                </span>
              ))}
              {c.past.length > 4 && (
                <span style={{ color: '#666', fontSize: '11px', alignSelf: 'center' }}>
                  +{c.past.length - 4} more
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      {enriched.length === 0 && (
        <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
          {search ? 'No contacts match that search.' : 'No contacts yet.'}
        </p>
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
