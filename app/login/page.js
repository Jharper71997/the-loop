'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('Trying...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Error: ' + error.message)
    } else {
      window.location.replace('/')
    }
  }

  return (
    <main style={{ maxWidth: '400px', margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '32px' }}>The Loop</h1>
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Staff Login</h3>
        {error && <p style={{ color: 'yellow', marginBottom: '10px', fontSize: '14px' }}>{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button className="btn-primary" onClick={handleLogin}>
          Login
        </button>
      </div>
    </main>
  )
}