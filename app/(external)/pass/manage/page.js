import Link from 'next/link'
import { LEGAL } from '@/lib/legal'
import { GOLD, GOLD_HI, INK, INK_DIM, LINE, ON_GOLD } from '@/lib/marketingTheme'

export const metadata = {
  title: 'Manage your Loop Pass',
  description: 'Cancel or update your Jville Brew Loop Pass.',
  robots: { index: false, follow: true },
}

// Cancelling has to be at least as easy as joining. The self-serve path is
// Stripe's hosted customer portal: the rider enters the email they paid with,
// Stripe emails them a one-time code, and they cancel or change their card
// there. No login of ours, nothing to build or secure.
//
// SETUP (Jacob, one time): Stripe Dashboard, Settings, Billing, Customer portal.
// Turn on "Cancel subscriptions" (at end of billing period) and "Update payment
// methods", activate the login link, and put that link in Vercel as
// STRIPE_BILLING_PORTAL_LOGIN_URL (https://billing.stripe.com/p/login/...).
// Until then this page falls back to the contact options below.
export const dynamic = 'force-dynamic'

export default function ManagePassPage() {
  const portal = process.env.STRIPE_BILLING_PORTAL_LOGIN_URL || ''
  const sms = `sms:${LEGAL.phone}?&body=${encodeURIComponent('Please cancel my Loop Pass.')}`
  const mail = `mailto:${LEGAL.email}?subject=${encodeURIComponent('Cancel my Loop Pass')}&body=${encodeURIComponent('Please cancel my Loop Pass.\n\nName:\nPhone on the pass:\n')}`

  return (
    <main className="site-main" style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px 80px' }}>
      <h1 style={{ color: INK, fontSize: 34, margin: 0, letterSpacing: '-0.02em' }}>Manage your Loop Pass</h1>
      <p style={{ color: INK_DIM, fontSize: 16, lineHeight: 1.6, marginTop: 12 }}>
        Cancel anytime. Cancelling stops all future charges, and your pass keeps working until the end of the period you already paid for.
      </p>

      {portal ? (
        <section style={card}>
          <h2 style={h2}>Cancel or change your card</h2>
          <p style={p}>Enter the email you paid with. Stripe, our payment processor, emails you a code, and you can cancel in two taps.</p>
          <a href={portal} style={cta}>Cancel or manage my pass</a>
        </section>
      ) : null}

      <section style={card}>
        <h2 style={h2}>{portal ? 'Or just tell us' : 'Cancel by text or email'}</h2>
        <p style={p}>
          Send us a text or an email from the phone or address on your pass and we will cancel it within one business day and reply to confirm.
          You will not be charged for any renewal that falls after your request.
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <a href={sms} style={portal ? ghost : cta}>Text {LEGAL.phoneDisplay} to cancel</a>
          <a href={mail} style={ghost}>Email {LEGAL.email}</a>
        </div>
      </section>

      <p style={{ ...p, marginTop: 22 }}>
        Details are in the <Link href="/terms#loop-pass" style={{ color: GOLD_HI }}>Terms</Link> and <Link href="/refunds#loop-pass" style={{ color: GOLD_HI }}>Refund Policy</Link>.
      </p>
    </main>
  )
}

const card = { marginTop: 22, padding: '20px 22px', borderRadius: 16, border: `1px solid ${LINE}`, background: 'rgba(255,255,255,0.03)' }
const h2 = { color: INK, fontSize: 19, margin: 0 }
const p = { color: INK_DIM, fontSize: 15, lineHeight: 1.6, margin: '8px 0 0' }
const cta = {
  display: 'block', textAlign: 'center', marginTop: 14, padding: '14px 20px', borderRadius: 12,
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: ON_GOLD, fontWeight: 800, textDecoration: 'none',
}
const ghost = {
  display: 'block', textAlign: 'center', padding: '13px 20px', borderRadius: 12,
  border: `1.5px solid ${GOLD}`, color: INK, fontWeight: 700, textDecoration: 'none',
}
