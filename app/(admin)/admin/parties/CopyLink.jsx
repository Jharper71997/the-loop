'use client'

// The party link, one tap from the clipboard.
//
// This is the only interactive thing on the parties desk, and it earns the
// client bundle: the link is a long token that is going straight into a text
// message, and hand-selecting it out of a table cell on a phone is exactly
// where a wrong character gets sent and the organizer hits a 404.

import { useState } from 'react'

export default function CopyLink({ url, label = 'Copy link' }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API needs a secure context and can be refused outright.
      // Falling back to a selection keeps the link reachable instead of the
      // button silently doing nothing.
      window.prompt('Copy this link', url)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button type="button" onClick={copy} title={url} style={{
      background: copied ? 'rgba(63,178,127,0.15)' : '#fff',
      border: `1px solid ${copied ? '#0f7a4e' : '#e8ddc8'}`,
      color: copied ? '#0f7a4e' : '#3b322a',
      fontSize: 12,
      fontWeight: 700,
      padding: '5px 10px',
      borderRadius: 6,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      fontFamily: 'inherit',
    }}>
      {copied ? 'Copied' : label}
    </button>
  )
}
