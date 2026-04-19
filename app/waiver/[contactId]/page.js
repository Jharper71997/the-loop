import WaiverForm from './WaiverForm'

export const metadata = { title: 'Sign waiver — Jville Brew Loop' }
export const dynamic = 'force-dynamic'

export default async function WaiverPage({ params }) {
  const { contactId } = await params
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      <header style={{
        padding: '12px 16px',
        borderBottom: '2px solid #d4a333',
        textAlign: 'center',
      }}>
        <span style={{ color: '#d4a333', fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Jville Brew Loop
        </span>
      </header>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        <WaiverForm contactId={contactId} />
      </div>
    </main>
  )
}
