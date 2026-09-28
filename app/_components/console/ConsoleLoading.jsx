import T from './theme'

// Shown the instant a console nav link is tapped, while the server page is
// still running its queries. Without it the old page just sits there until the
// new one is fully rendered, which reads as "the admin takes forever".
//
// Next only shows a segment's OWN loading.js on navigation (a parent's boundary
// is already revealed, so React keeps the old UI instead). That is why every
// server page folder under /admin and /leadership has a one-line loading.js
// re-exporting this, rather than one at the top.
export default function ConsoleLoading() {
  const bar = (w, h = 14) => (
    <div className="cs-skel" style={{ width: w, height: h, borderRadius: 6, background: T.SUNK }} />
  )
  return (
    <div aria-busy="true" aria-label="Loading" style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        @keyframes cs-skel-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
        .cs-skel { animation: cs-skel-pulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cs-skel { animation: none; } }
      `}</style>
      {bar('38%', 26)}
      <div style={{ height: 10 }} />
      {bar('22%')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 22 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: T.CARD, border: `1px solid ${T.LINE}`, borderRadius: 12, padding: 16 }}>
            {bar('50%', 12)}
            <div style={{ height: 10 }} />
            {bar('70%', 22)}
          </div>
        ))}
      </div>
      <div style={{ background: T.CARD, border: `1px solid ${T.LINE}`, borderRadius: 12, padding: 16, marginTop: 16, display: 'grid', gap: 12 }}>
        {['92%', '84%', '88%', '76%', '81%'].map((w, i) => <div key={i}>{bar(w)}</div>)}
      </div>
    </div>
  )
}
