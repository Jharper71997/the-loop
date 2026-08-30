'use client'

import { useEffect, useState } from 'react'
import FeedbackForm from './FeedbackForm'

// Client half of the open /feedback link. Its only job is minting the key the
// responses are stored under, because there is no ticket to key them on.
//
// The key is parked in localStorage with a timestamp and reused for SESSION_MS,
// so a rider who closes the tab and comes back an hour later edits the answers
// they already gave instead of starting a second row. Past that window it mints
// a fresh one: the same link gets texted out every weekend, and a rider's
// second Loop has to count as a second response, not an overwrite of the first.
//
// Nothing renders until the key exists — localStorage is not available during
// the server render, and a form that POSTs with no key just errors.

const STORAGE_KEY = 'brewloop.feedback.open'
const SESSION_MS = 12 * 60 * 60 * 1000

function mintUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Safari before 15.4 and any non-secure context. Same shape, weaker entropy —
  // this is a survey key, not a credential.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function OpenFeedback(props) {
  const [publicToken, setPublicToken] = useState(null)

  useEffect(() => {
    let token = null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const saved = raw ? JSON.parse(raw) : null
      if (saved?.token && Date.now() - (saved.at || 0) < SESSION_MS) token = saved.token
    } catch {
      // Private mode, or a wiped profile. Fall through and mint a throwaway.
    }
    if (!token) token = mintUuid()
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, at: Date.now() }))
    } catch {}
    setPublicToken(token)
  }, [])

  if (!publicToken) {
    return <div style={{ minHeight: 220 }} aria-hidden="true" />
  }

  return <FeedbackForm {...props} publicToken={publicToken} />
}
