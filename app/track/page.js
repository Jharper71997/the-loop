// White-labeled embed of the Zen Shuttle live map (powered by ZenduBUS,
// hosted by Zenduit). We can't restyle the inside of a cross-origin iframe,
// but we wrap it in Brew Loop chrome so the page reads as ours.

const ZENDU_MAP_URL = 'https://zenbus.zenduit.com/map/jville_brew_loop/6998b2d1d9a9a1bab8a072dc'

export const metadata = {
  title: 'Live Shuttle — Jville Brew Loop',
  description: 'Track the Brew Loop shuttle live between bars.',
}

export default function TrackPage() {
  return (
    <main style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0b',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      <header style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: '#0a0a0b',
        borderBottom: '2px solid #d4a333',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{
            color: '#d4a333',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Jville Brew Loop
          </span>
          <span style={{ color: '#bbb', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Live Shuttle Tracker
          </span>
        </div>
        <a
          href="https://jvillebrewloop.com"
          style={{
            color: '#d4a333',
            fontSize: 12,
            textDecoration: 'none',
            border: '1px solid #d4a333',
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          jvillebrewloop.com
        </a>
      </header>

      <div style={{ flex: '1 1 auto', position: 'relative', background: '#0a0a0b' }}>
        <iframe
          src={ZENDU_MAP_URL}
          title="Live Shuttle Map"
          allow="geolocation"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 0,
            display: 'block',
          }}
        />
      </div>
    </main>
  )
}
