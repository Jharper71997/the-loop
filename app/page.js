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
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

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

  async function saveEdit() {
    await supabase
      .from('contacts')
      .update(editForm)
      .eq('id', selected.id)
    setSelected({ ...selected, ...editForm })
    setEditing(false)
    fetchContacts()
  }

  async function deleteContact() {
    if (!confirm('Delete this rider?')) return
    await supabase.from('group_members').delete().eq('contact_id', selected.id)
    await supabase.from('contacts').delete().eq('id', selected.id)
    setSelected(null)
    fetchContacts()
  }

  const filtered = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) {
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
              <h3 style={{ marginBottom: '12px' }}>Edit Rider</h3>
              <input
                placeholder="First name"
                value={editForm.first_name || ''}
                onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
              />
              <input
                placeholder="Last name"
                value={editForm.last_name || ''}
                onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
              />
              <input
                placeholder="Phone"
                value={editForm.phone || ''}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <input
                placeholder="Email"
                value={editForm.email || ''}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              />
              <button className="btn-primary" onClick={saveEdit}>Save Changes</button>
              <button
                onClick={() => setEditing(false)}
                style={{ background: 'none', color: '#888', marginTop: '8px', width: '100%' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <p className="rider-name">{selected.first_name} {selected.last_name}</p>
              <p className="rider-phone">📞 {selected.phone}</p>
              <p className="rider-phone">✉️ {selected.email}</p>
              <button
                onClick={() => { setEditing(true); setEditForm(selected) }}
                style={{ background: 'none', color: '#f0c040', marginTop: '12px', fontSize: '14px' }}
              >
                Edit Rider
              </button>
              <button
                onClick={deleteContact}
                style={{ background: 'none', color: '#ff4444', marginTop: '4px', fontSize: '14px' }}
              >
                Delete Rider
              </button>
            </>
          )}
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
          <button className="btn-primary" onClick={async () => {
            if (!message || !selected?.phone) return
            const res = await fetch('/api/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: selected.phone, message })
            })
            const data = await res.json()
            if (data.success) {
              alert('Text sent!')
              setMessage('')
            } else {
              alert('Error: ' + data.error)
            }
          }}>Send Text</button>
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