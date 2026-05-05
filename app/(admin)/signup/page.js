'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function SignupInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null) // null | 'verify' | 'signed_in'

  async function handleSignup(e) {
    e?.preventDefault?.()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    // Supabase returns a session immediately if email confirmation is OFF in
    // the project settings. Otherwise, the user has to click a verify link
    // before they can sign in. Show whichever state we're in.
    if (data?.session) {
      setDone('signed_in')
      window.location.replace('/')
    } else {
      setDone('verify')
    }
  }

  if (done === 'verify') {
    return (
      <main style={{ maxWidth: '400px', margin: '80px auto', padding: '0 16px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '32px', color: '#d4a333' }}>The Loop</h1>
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Check your email</h3>
          <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
            We sent a verification link to <strong>{email}</strong>. Click it to confirm
            your account, then sign in with your password.
          </p>
          <Link href="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Go to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: '400px', margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '32px', color: '#d4a333' }}>The Loop</h1>
      <form className="card" onSubmit={handleSignup}>
        <h3 style={{ marginBottom: '4px' }}>Create your account</h3>
        <p style={{ fontSize: 13, color: '#9c9ca3', marginBottom: 16 }}>
          For Brew Loop drivers and door staff. Use the email Jacob has on file for you.
        </p>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (8+ characters)"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
        />
        {error && <p style={{ color: '#e07a7a', fontSize: '13px', marginBottom: '8px' }}>{error}</p>}
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p style={{ fontSize: 13, color: '#9c9ca3', marginTop: 16, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#d4a333' }}>Sign in</Link>
        </p>
      </form>
    </main>
  )
}

export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  )
}
