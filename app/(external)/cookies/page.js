import Link from 'next/link'
import LegalPage, { H2, P } from '../_components/legal/LegalPage'
import CookieSettingsButton from '../_components/legal/CookieSettingsButton'

export const metadata = {
  title: 'Cookie Policy',
  description: 'The cookies and browser storage the Jville Brew Loop site uses, and how to control them.',
  alternates: { canonical: '/cookies' },
}

// Keep this table in step with the code. Every entry below was found by
// grepping for cookies.set / localStorage / sessionStorage on 2026-09-25.
const ROWS = [
  { name: 'bl_rref (cookie)', kind: 'Functional', purpose: 'Remembers the rider who invited you through their referral link, so they get leaderboard credit when you book. No discount is attached.', lasts: '30 days' },
  { name: 'Supabase login cookies', kind: 'Necessary', purpose: 'Keep staff signed in to the staff console. Riders never get these; you do not need an account to book or ride.', lasts: 'Until sign out or expiry' },
  { name: 'Campaign tags (session storage)', kind: 'Functional', purpose: 'Holds the QR, bartender or campaign tag from the link you arrived on until you check out, so the right partner gets credit.', lasts: 'Until you close the tab' },
  { name: 'My Tickets phone (local storage)', kind: 'Functional', purpose: 'Remembers the phone number you used to look up your tickets on this device. Tap "Look up another" on that page to clear it.', lasts: 'Until you clear it' },
  { name: 'Merch cart (local storage)', kind: 'Necessary', purpose: 'Keeps the items in your cart.', lasts: 'Until checkout or you clear it' },
  { name: 'Survey session (local storage)', kind: 'Functional', purpose: 'Lets you finish the ride survey you started without starting over.', lasts: '12 hours' },
  { name: 'Prompt dismissals (session storage)', kind: 'Functional', purpose: 'Remembers that you closed the notifications prompt.', lasts: 'Until you close the tab' },
  { name: 'bl_cookie_consent (local storage)', kind: 'Necessary', purpose: 'Remembers your choice in the cookie banner.', lasts: 'Until you clear it' },
]

export default function CookiesPage() {
  return (
    <LegalPage
      current="/cookies"
      title="Cookie Policy"
      intro="Cookies and browser storage are small pieces of data a site saves on your device. Here is everything this site saves, and why."
    >
      <H2 id="today">What we use today</H2>
      <P>We do not use advertising cookies, tracking pixels or third-party analytics. What we do save is listed below. All of it is set by this site (first party) and none of it is sold or shared for advertising.</P>

      <div role="region" aria-label="Cookies and storage used by this site" tabIndex={0} style={{ overflowX: 'auto', margin: '6px 0 18px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, lineHeight: 1.5, minWidth: 560 }}>
          <thead>
            <tr>
              {['Name', 'Type', 'What it does', 'How long'].map(h => (
                <th key={h} scope="col" style={{ textAlign: 'left', color: '#f5f5f7', padding: '10px 10px 10px 0', borderBottom: '1px solid rgba(255,255,255,0.14)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.name}>
                <th scope="row" style={{ textAlign: 'left', color: '#f5f5f7', padding: '10px 10px 10px 0', verticalAlign: 'top', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>{r.name}</th>
                <td style={td}>{r.kind}</td>
                <td style={td}>{r.purpose}</td>
                <td style={td}>{r.lasts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="third-party">Third-party requests</H2>
      <P>Two outside services load content into our pages: Google Fonts (fonts) and OpenStreetMap (map tiles on the live tracker). Your browser contacts them directly, which shares your IP address and browser details with them. Neither sets advertising cookies through our site. Stripe sets its own cookies on its payment page to prevent fraud; see Stripe&rsquo;s privacy policy.</P>

      <H2 id="analytics">Analytics and your choice</H2>
      <P>If we add website analytics in the future, it will not load until you choose &ldquo;Allow analytics&rdquo; in the cookie banner. &ldquo;No thanks&rdquo; is always one tap and is treated exactly the same as never answering. You can change your mind at any time:</P>
      <CookieSettingsButton />

      <H2 id="control">Controlling storage in your browser</H2>
      <P>You can delete cookies and site data in your browser settings at any time. Doing so will clear your cart and your saved My Tickets number but will not cancel anything you bought. More on how we handle data is in our <Link href="/privacy">Privacy Policy</Link>.</P>
    </LegalPage>
  )
}

const td = { color: '#b8b8bf', padding: '10px 10px 10px 0', verticalAlign: 'top', borderBottom: '1px solid rgba(255,255,255,0.08)' }
