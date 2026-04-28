'use client'

import { useEffect, useState } from 'react'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const BG_PANEL = 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'

export default function LeaderboardClient() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/leaderboard', { cache: 'no-store' })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          setData(json)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Load failed')
      }
    }

    load()
    const iv = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  if (error && !data) {
    return (
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ color: INK_DIM, textAlign: 'center' }}>{error}</div>
      </main>
    )
  }

  if (!data) {
    return (
      <main style={{ maxWidth: 520, margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ color: INK_DIM, textAlign: 'center' }}>Loading…</div>
      </main>
    )
  }

  const standings = data.standings || []
  const leader = standings[0]
  const runnerUp = standings[1]

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{
          color: GOLD, fontSize: 11, letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 10,
        }}>
          Bartender Contest · {data.month}
        </div>
        <h1 style={{ color: INK, fontSize: 26, margin: '0 0 6px' }}>
          Leaderboard
        </h1>
        <div style={{ color: INK_DIM, fontSize: 13 }}>
          {data.days_remaining} day{data.days_remaining === 1 ? '' : 's'} left this month
        </div>
      </div>

      <div style={{
        display: 'grid',
        gap: 10,
        gridTemplateColumns: '1fr 1fr',
        marginBottom: 22,
      }}>
        <PrizeChip label="1st place" amount="$250" name={leader?.qualifies ? leader.name : 'TBD'} />
        <PrizeChip label="2nd place" amount="$50" name={runnerUp?.qualifies ? runnerUp.name : 'TBD'} />
      </div>

      <div style={{
        background: BG_PANEL,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {standings.length === 0 ? (
          <div style={{ color: INK_DIM, padding: 32, textAlign: 'center', fontSize: 14 }}>
            No bartenders signed up yet.
          </div>
        ) : (
          standings.map((row, idx) => (
            <Row key={row.slug} row={row} rank={idx + 1} />
          ))
        )}
      </div>

      <div style={{ color: INK_DIM, fontSize: 11, textAlign: 'center', marginTop: 16 }}>
        10 sales minimum to qualify · resets the 1st of each month
      </div>
    </main>
  )
}

function PrizeChip({ label, amount, name }) {
  return (
    <div style={{
      background: BG_PANEL,
      border: `1px solid ${GOLD}`,
      borderRadius: 12,
      padding: 14,
      textAlign: 'center',
      boxShadow: '0 0 24px rgba(212,163,51,0.12)',
    }}>
      <div style={{
        color: GOLD, fontSize: 9, letterSpacing: '0.2em',
        textTransform: 'uppercase', fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{
        color: GOLD, fontSize: 22, fontWeight: 700,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        margin: '4px 0',
      }}>
        {amount}
      </div>
      <div style={{ color: INK, fontSize: 13, fontWeight: 600 }}>
        {name}
      </div>
    </div>
  )
}

function Row({ row, rank }) {
  const isPodium = rank <= 2 && row.qualifies
  const ticketsToQualify = Math.max(0, 10 - row.tickets)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: isPodium ? 'rgba(212,163,51,0.06)' : 'transparent',
    }}>
      <div style={{
        width: 28,
        textAlign: 'center',
        color: isPodium ? GOLD : INK_DIM,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 14,
        fontWeight: 700,
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: INK, fontSize: 15, fontWeight: 600 }}>
          {row.name}
        </div>
        <div style={{ color: INK_DIM, fontSize: 12 }}>
          {row.bar}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          color: isPodium ? GOLD : INK,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 18,
          fontWeight: 700,
        }}>
          {row.tickets}
        </div>
        <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.1em' }}>
          {row.qualifies ? 'TICKETS' : `${ticketsToQualify} TO QUALIFY`}
        </div>
      </div>
    </div>
  )
}
