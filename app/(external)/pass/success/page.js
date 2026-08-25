export const metadata = { title: 'You’re on the Loop — Loop Pass' }

export default function PassSuccessPage() {
  const INK = '#f5f5f7'
  const INK_DIM = '#b8b8bf'
  const GOLD = '#d4a333'
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
      <div
        aria-hidden
        style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
          border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: GOLD, fontSize: 30,
        }}
      >
        ✓
      </div>
      <h1 style={{ color: INK, fontSize: 30, margin: 0 }}>You’re on the Loop</h1>
      <p style={{ color: INK_DIM, fontSize: 16, marginTop: 12, lineHeight: 1.6 }}>
        Your Loop Pass is active. We’ll text your pickup details before each weekend loop —
        just hop on, no checkout needed.
      </p>
      <a
        href="/book"
        style={{
          display: 'inline-block', marginTop: 28, padding: '14px 24px', borderRadius: 12,
          background: GOLD, color: '#0a0a0b', fontWeight: 700, textDecoration: 'none',
        }}
      >
        See this weekend’s loop
      </a>
    </main>
  )
}
