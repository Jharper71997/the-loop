const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_FAINT = '#6f6f76'
const LINE = 'rgba(255,255,255,0.08)'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      style={{
        borderTop: `1px solid ${LINE}`,
        marginTop: 80,
        padding: '40px 20px 32px',
        background: 'linear-gradient(180deg, transparent, rgba(212,163,51,0.02))',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gap: 32,
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            marginBottom: 32,
          }}
        >
          <div>
            <div style={{ color: INK, fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
              Jville Brew Loop
            </div>
            <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Jacksonville&apos;s weekend bar-hopping shuttle. Book a seat, track live, ride safe.
            </p>
          </div>

          <FooterCol title="Ride">
            <FooterLink href="/events">Upcoming events</FooterLink>
            <FooterLink href="/my-tickets">My tickets</FooterLink>
            <FooterLink href="/track">Track shuttle</FooterLink>
            <FooterLink href="/waiver">Sign waiver</FooterLink>
          </FooterCol>

          <FooterCol title="About">
            <FooterLink href="/about">About the Loop</FooterLink>
            <FooterLink href="/about#faq">FAQ</FooterLink>
            <FooterLink href="/bars">Partner bars</FooterLink>
            <FooterLink href="mailto:hello@jvillebrewloop.com">Contact</FooterLink>
          </FooterCol>

          <FooterCol title="Partners">
            <FooterLink href="mailto:richard@jvillebrewloop.com">Become a sponsor</FooterLink>
            <FooterLink href="mailto:hello@jvillebrewloop.com">Host a pickup</FooterLink>
            <FooterLink href="mailto:hello@jvillebrewloop.com">Private group (5+)</FooterLink>
          </FooterCol>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 20,
            borderTop: `1px solid ${LINE}`,
          }}
        >
          <span style={{ color: INK_FAINT, fontSize: 12 }}>
            &copy; {year} Jville Brew Loop. Must be 21+. Drink responsibly.
          </span>
          <span style={{ color: INK_FAINT, fontSize: 12 }}>
            Staff?{' '}
            <a href="/admin" style={{ color: GOLD, textDecoration: 'none' }}>
              Ops console
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }) {
  return (
    <div>
      <div
        style={{
          color: GOLD,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function FooterLink({ href, children }) {
  return (
    <a
      href={href}
      style={{
        color: INK_DIM,
        fontSize: 14,
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  )
}
