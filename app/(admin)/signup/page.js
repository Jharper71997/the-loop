'use client'

import Link from 'next/link'

// Self-serve signup is intentionally CLOSED. A public signup form let anyone
// create an account, and "has an account" used to be all the ops console
// checked — so a rider could reach the admin side. Staff accounts are now
// provisioned by Jacob in Supabase and gated by the staff email allowlist
// (lib/roles.js → isStaff). This page is just a pointer to request access.
export default function Signup() {
  return (
    <main style={{ maxWidth: '400px', margin: '80px auto', padding: '0 16px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '32px', color: '#d4a333' }}>The Loop</h1>
      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>Staff access only</h3>
        <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16, color: '#c8c8cc' }}>
          Accounts for the ops console are set up by Jacob. If you're a driver or
          door staff and need access, ask Jacob to add your email, then sign in.
        </p>
        <Link
          href="/login"
          className="btn-primary"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
        >
          Go to sign in
        </Link>
      </div>
    </main>
  )
}
