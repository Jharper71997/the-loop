export const metadata = { title: 'Booked — Jville Brew Loop' }

export default function BookingSuccess() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        maxWidth: 480,
        background: '#15151a',
        border: '1px solid #d4a333',
        borderRadius: 14,
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36 }}>🍺</div>
        <h1 style={{ color: '#d4a333', fontSize: 24, margin: '12px 0 6px' }}>You're on the Loop.</h1>
        <p style={{ color: '#bbb', fontSize: 14, margin: '0 0 18px', lineHeight: 1.5 }}>
          A confirmation text is on its way with your pickup time and the live shuttle tracker link.
          See you out there.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a href="/track" style={btn('primary')}>Track the Shuttle</a>
          <a href="/book" style={btn('ghost')}>Book another</a>
        </div>
      </div>
    </main>
  )
}

function btn(variant) {
  return {
    display: 'inline-block',
    padding: '10px 16px',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    textDecoration: 'none',
    background: variant === 'primary' ? '#d4a333' : 'transparent',
    color: variant === 'primary' ? '#0a0a0b' : '#d4a333',
    border: variant === 'primary' ? 0 : '1px solid #d4a333',
  }
}
