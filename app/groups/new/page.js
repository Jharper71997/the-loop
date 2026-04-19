import EventForm from '../EventForm'

export const metadata = { title: 'New Loop — The Loop' }

export default function NewLoopPage() {
  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', minHeight: '100vh', color: '#fff' }}>
      <a href="/groups" style={{ color: '#d4a333', fontSize: 13, textDecoration: 'none' }}>← All Loops</a>
      <h1 style={{ fontSize: 26, color: '#d4a333', margin: '8px 0 16px' }}>Create Loop</h1>
      <p style={{ color: '#9c9ca3', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        This creates the Loop (dispatch view), the on-sale event, and 5 default bar-stop ticket types.
      </p>
      <EventForm mode="create" />
    </main>
  )
}
