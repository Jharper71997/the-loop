// Minimal layout for the embeddable widget — no nav, no footer, transparent
// background so the host site's color shows through. Nothing here should
// reach back into the broader app shell.

export const metadata = {
  title: 'Brew Loop tickets',
  robots: { index: false, follow: false },
}

export default function WidgetLayout({ children }) {
  return (
    <div
      style={{
        background: 'transparent',
        color: '#f5f5f7',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        padding: 0,
        margin: 0,
        minHeight: '100%',
      }}
    >
      {children}
    </div>
  )
}
