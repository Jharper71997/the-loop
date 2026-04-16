'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [newGroup, setNewGroup] = useState({ name: '', pickup_time: '' })

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

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Groups</h1>

      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">New Group</h2>
        <input
          className="w-full border rounded p-2 mb-2"
          placeholder="Group name (e.g. 7pm Riders)"
          value={newGroup.name}
          onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
        />
        <input
          className="w-full border rounded p-2 mb-2"
          placeholder="Pickup time (e.g. 7:00 PM)"
          value={newGroup.pickup_time}
          onChange={e => setNewGroup({ ...newGroup, pickup_time: e.target.value })}
        />
        <button
          onClick={createGroup}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Create Group
        </button>
      </div>

      <ul className="space-y-4">
        {groups.map(g => (
          <li key={g.id} className="border rounded p-4">
            <p className="font-semibold text-lg">{g.name}</p>
            <p className="text-sm text-gray-500 mb-3">{g.pickup_time}</p>
            <ul className="space-y-1">
              {g.group_members?.map(m => (
                <li key={m.id} className="text-sm border-t pt-1">
                  {m.contacts?.first_name} {m.contacts?.last_name} — {m.contacts?.phone}
                </li>
              ))}
              {g.group_members?.length === 0 && (
                <p className="text-gray-400 text-sm">No riders yet.</p>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  )
}