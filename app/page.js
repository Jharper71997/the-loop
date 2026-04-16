'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [assignedGroup, setAssignedGroup] = useState('')

  useEffect(() => {
    fetchContacts()
    fetchGroups()
  }, [])

  async function fetchContacts() {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .order('last_name')
    setContacts(data || [])
  }

  async function fetchGroups() {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .order('pickup_time')
    setGroups(data || [])
  }

  async function assignToGroup() {
    if (!assignedGroup || !selected) return
    await supabase.from('group_members').insert([{
      group_id: assignedGroup,
      contact_id: selected.id
    }])
    alert('Rider assigned to group!')
  }

  const filtered = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) {
    return (
      <main>
        <button
          onClick={() => setSelected(null)}
          style={{ color: '#f0c040', background: 'none', marginBottom: '16px', fontSize: '15px' }}
        >
          ← Back
        </button>

        <div className="card">
          <p className="rider-name">{selected.first_name} {selected.last_name}</p>
          <p className="rider-phone">📞 {selected.phone}</p>
          <p className="rider-phone">✉️ {selected.email}</p>
        </div>

        <div className="card">
          <h3>Assign to Group</h3>
          <select
            value={assignedGroup}
            onChange={e => setAssignedGroup(e.target.value)}
          >
            <option value="">Select a group...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} — {g.pickup_time}</option>
            ))}
          </select>
          <button className="btn-green" onClick={assignToGroup}>
            Assign Rider
          </button>
        </div>

        <div className="card">
          <h3>Send SMS</h3>
          <textarea
            rows={3}
            placeholder="Type your message..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <button className="btn-primary">Send Text</button>
        </div>
      </main>
    )
  }

  return (
    <main>
      <h1>Riders</h1>
      <input
        placeholder="Search by name or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {filtered.map(c => (
        <div
          key={c.id}
          className="card"
          onClick={() => setSelected(c)}
          style={{ cursor: 'pointer' }}
        >
          <p className="rider-name">{c.first_name} {c.last_name}</p>
          <p className="rider-phone">{c.phone}</p>
        </div>
      ))}
      {filtered.length === 0 && (
        <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>No riders found.</p>
      )}
    </main>
  )
}