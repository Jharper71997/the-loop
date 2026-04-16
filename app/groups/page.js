'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { personalize } from '@/lib/personalize'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [newGroup, setNewGroup] = useState({ name: '', pickup_time: '' })
  const [groupMessage, setGroupMessage] = useState({})
  const [sending, setSending] = useState({})
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupEdit, setGroupEdit] = useState({})

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    const { data } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          id,
          contacts (
            id, first_name, last_name, phone
          )
        )
      `)
      .order('pickup_time')
    setGroups(data || [])
  }

  async function createGroup() {
    if (!newGroup.name) return
    await supabase.from('groups').insert([newGroup])
    setNewGroup({ name: '', pickup_time: '' })
    fetchGroups()
  }

  async function saveGroupEdit(id) {
    await supabase
      .from('groups')
      .update({ name: groupEdit.name, pickup_time: groupEdit.pickup_time })
      .eq('id', id)
    setEditingGroup(null)
    fetchGroups()
  }

  async function deleteGroup(id) {
    if (!confirm('Delete this group?')) return
    await supabase.from('group_members').delete().eq('group_id', id)
    await supabase.from('groups').delete().eq('id', id)
    fetchGroups()
  }

  async function removeMember(memberId) {
    if (!confirm('Remove this rider from the group?')) return
    await supabase.from('group_members').delete().eq('id', memberId)
    fetchGroups()
  }

  async function sendGroupSMS(group) {
    const template = groupMessage[group.id]
    if (!template) return alert('Type a message first')

    const riders = (group.group_members || [])
      .map(m => m.contacts)
      .filter(r => r && r.phone)

    if (riders.length === 0) return alert('No riders with phone numbers in this group')

    const count = riders.length
    if (!confirm(`Send a personalized text to ${count} rider${count === 1 ? '' : 's'}?\n\nEach person gets their own text from your number.`)) return

    setSending({ ...sending, [group.id]: true })

    const results = await Promise.all(
      riders.map(rider =>
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: rider.phone, message: personalize(template, rider) })
        }).then(r => r.json()).catch(e => ({ success: false, error: e.message }))
      )
    )

    setSending({ ...sending, [group.id]: false })
    const failed = results.filter(r => !r.success).length
    if (failed === 0) {
      alert(`Sent to ${count} rider${count === 1 ? '' : 's'}!`)
      setGroupMessage({ ...groupMessage, [group.id]: '' })
    } else {
      alert(`Sent to ${count - failed} of ${count}. ${failed} failed.`)
    }
  }

  return (
    <main>
      <h1>Groups</h1>

      <div className="card">
        <h3>New Group</h3>
        <input
          placeholder="Group name (e.g. 7pm Riders)"
          value={newGroup.name}
          onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
        />
        <input
          placeholder="Pickup time (e.g. 7:00 PM)"
          value={newGroup.pickup_time}
          onChange={e => setNewGroup({ ...newGroup, pickup_time: e.target.value })}
        />
        <button className="btn-primary" onClick={createGroup}>
          Create Group
        </button>
      </div>

      {groups.map(g => (
        <div key={g.id} className="card">
          {editingGroup === g.id ? (
            <>
              <input
                value={groupEdit.name || ''}
                onChange={e => setGroupEdit({ ...groupEdit, name: e.target.value })}
                placeholder="Group name"
              />
              <input
                value={groupEdit.pickup_time || ''}
                onChange={e => setGroupEdit({ ...groupEdit, pickup_time: e.target.value })}
                placeholder="Pickup time"
              />
              <button className="btn-primary" onClick={() => saveGroupEdit(g.id)}>Save</button>
              <button
                onClick={() => setEditingGroup(null)}
                style={{ background: 'none', color: '#888', marginTop: '8px', width: '100%' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <p className="rider-name">{g.name}</p>
              <p className="rider-phone">{g.pickup_time}</p>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <button
                  onClick={() => { setEditingGroup(g.id); setGroupEdit(g) }}
                  style={{ background: 'none', color: '#f0c040', fontSize: '14px' }}
                >
                  Edit Group
                </button>
                <button
                  onClick={() => deleteGroup(g.id)}
                  style={{ background: 'none', color: '#ff4444', fontSize: '14px' }}
                >
                  Delete Group
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: '12px', borderTop: '1px solid #2a2a2a', paddingTop: '12px' }}>
            {g.group_members?.length === 0 && (
              <p style={{ color: '#aaa', fontSize: '14px' }}>No riders yet.</p>
            )}
            {g.group_members?.map(m => (
              <div key={m.id} style={{ fontSize: '14px', padding: '6px 0', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <span style={{ fontWeight: '500' }}>{m.contacts?.first_name} {m.contacts?.last_name}</span>
                  <span style={{ color: '#888', marginLeft: '8px' }}>{m.contacts?.phone}</span>
                </span>
                <button
                  onClick={() => removeMember(m.id)}
                  style={{ background: 'none', color: '#ff4444', fontSize: '12px' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '12px', borderTop: '1px solid #2a2a2a', paddingTop: '12px' }}>
            <h3>Text This Group</h3>
            <p style={{ color: '#888', fontSize: '12px', marginBottom: '6px' }}>
              Each rider gets their own text. Use <code>{'{first_name}'}</code> to personalize.
            </p>
            <textarea
              rows={2}
              placeholder="Hey {first_name}, your pickup is in 10 min..."
              value={groupMessage[g.id] || ''}
              onChange={e => setGroupMessage({ ...groupMessage, [g.id]: e.target.value })}
            />
            <button
              className="btn-primary"
              onClick={() => sendGroupSMS(g)}
              disabled={sending[g.id]}
            >
              {sending[g.id] ? 'Sending...' : `Send to ${g.group_members?.length || 0} Riders`}
            </button>
          </div>
        </div>
      ))}
    </main>
  )
}