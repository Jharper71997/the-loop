// Shared shell for the standalone (loop) products — Marines "The Loop" and
// Surf City Loop. Deliberately NOT inside the (external) Brew Loop layout: no
// Brew Loop top bar / tab bar. Dark base + gold accent (the gold design system
// comes from .loop-shell in globals.css). Per-business branding + header +
// staff nav live in the nested layouts: marines/layout.js and
// surfcity/layout.js. This parent only provides the shell + the accent line.

const BG = '#0a0a0b'
const INK = '#e8e8ea'
const GOLD = '#d4a333'
const GOLD_DEEP = '#8a6a22'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
}

export default function LoopLayout({ children }) {
  return (
    <div className="loop-shell" style={{ minHeight: '100dvh', background: BG, color: INK, WebkitFontSmoothing: 'antialiased',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* the accent line */}
      <div aria-hidden style={{ height: 4, background: `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD})` }} />
      {children}
    </div>
  )
}
