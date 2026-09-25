import Link from 'next/link'

export const metadata = { title: 'You’re on the Loop — Loop Pass' }

// The pass makes a seat free; it does not book one. Members still book each
// weekend on /book with the phone or email on the pass, so this page spells out
// the same three steps as the welcome text and email (sendPassWelcome,
// passWelcomeHtml). Keep all three saying the same thing.
const STEPS = [
  {
    title: 'Book your seat each weekend',
    body: 'Pick your night on our booking page. Use the same phone number or email you just signed up with so we know it’s you.',
  },
  {
    title: 'Your seat shows $0',
    body: 'Your pass covers it. No payment needed, just confirm the booking.',
  },
  {
    title: 'Show your ticket when you board',
    body: 'We text and email your ticket. Show it to the driver at pickup.',
  },
]

export default function PassSuccessPage() {
  const INK = '#f5f5f7'
  const INK_DIM = '#b8b8bf'
  const GOLD = '#d4a333'
  const LINE = '#2a2a31'
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '64px 20px' }}>
      <div style={{ textAlign: 'center' }}>
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
          Your Loop Pass is active. Here’s how to ride. We also just texted and emailed you these steps.
        </p>
      </div>

      <ol style={{ listStyle: 'none', padding: 0, margin: '32px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {STEPS.map((s, i) => (
          <li key={s.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span
              aria-hidden
              style={{
                flex: '0 0 auto', width: 30, height: 30, borderRadius: '50%',
                border: `1.5px solid ${GOLD}`, color: GOLD, fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {i + 1}
            </span>
            <div>
              <p style={{ color: INK, fontSize: 16, fontWeight: 700, margin: 0 }}>{s.title}</p>
              <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, margin: '4px 0 0' }}>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div style={{ textAlign: 'center' }}>
        <a
          href="/book"
          style={{
            display: 'inline-block', marginTop: 28, padding: '14px 24px', borderRadius: 12,
            background: GOLD, color: '#0a0a0b', fontWeight: 700, textDecoration: 'none',
          }}
        >
          Book this weekend
        </a>
      </div>

      <div style={{ marginTop: 32, padding: '14px 16px', border: `1px solid ${LINE}`, borderRadius: 12, color: INK_DIM, fontSize: 14, lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 6px' }}>Your pass covers one seat: yours. Friends riding with you pay the normal ticket price.</p>
        <p style={{ margin: '0 0 6px' }}>Book on our site, not Ticket Tailor. That’s where your pass applies.</p>
        <p style={{ margin: 0 }}>
          Renews monthly until you cancel. Stripe emails your receipt. To cancel anytime, go to{' '}
          <Link href="/pass/manage" style={{ color: GOLD, textDecoration: 'underline' }}>Manage your Loop Pass</Link>.
        </p>
      </div>
    </main>
  )
}
