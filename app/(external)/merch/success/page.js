import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { fmtPrice } from '../../_components/merch/MerchBody'
import ClearCart from './ClearCart'
import { GOLD, GOLD_HI, INK, INK_DIM, LINE, MAX_W_NARROW, softCard, primaryCta, ghostCta } from '@/lib/marketingTheme'

export const metadata = {
  title: 'Order confirmed',
  alternates: { canonical: '/merch/success' },
  robots: { index: false },
}
export const dynamic = 'force-dynamic'

export default async function MerchSuccess({ searchParams }) {
  const sp = await searchParams
  const sessionId = sp?.session_id || null

  let order = null
  let items = []
  if (sessionId) {
    try {
      const sb = supabaseAdmin()
      const { data } = await sb
        .from('merch_orders')
        .select('id, status, total_cents, subtotal_cents, shipping_cents, buyer_name, shipping_address')
        .eq('stripe_checkout_session_id', sessionId)
        .maybeSingle()
      order = data || null
      if (order) {
        const { data: its } = await sb
          .from('merch_order_items')
          .select('name, unit_price_cents, quantity')
          .eq('merch_order_id', order.id)
        items = its || []
      }
    } catch { /* show the generic thanks below */ }
  }

  return (
    <main className="site-main" style={{ minHeight: '60vh' }}>
      <ClearCart />
      <div style={{ maxWidth: MAX_W_NARROW, margin: '0 auto', padding: 'clamp(36px, 6vw, 64px) 16px clamp(48px, 7vw, 76px)', textAlign: 'center' }}>
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', border: `2px solid ${GOLD}`, color: GOLD, background: 'radial-gradient(60% 60% at 50% 40%, rgba(212,163,51,0.2), transparent 70%)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
        <h1 style={{ color: INK, fontSize: 'clamp(26px, 4.5vw, 36px)', fontWeight: 800, letterSpacing: '-0.015em', margin: '18px 0 0' }}>
          Order confirmed
        </h1>
        <p style={{ color: INK_DIM, fontSize: 15.5, lineHeight: 1.55, margin: '12px auto 0', maxWidth: 460 }}>
          Thanks for repping the Loop{order?.buyer_name ? `, ${order.buyer_name.split(' ')[0]}` : ''}. We emailed your receipt. If you chose shipping, it&rsquo;s on the way; if you&rsquo;re grabbing it on the shuttle, we&rsquo;ll have it ready.
        </p>

        {items.length > 0 && (
          <div style={{ ...softCard, padding: '20px 22px', margin: '26px auto 0', textAlign: 'left', maxWidth: 460 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: i < items.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                <span style={{ color: INK, fontSize: 14.5 }}>{it.name} <span style={{ color: INK_DIM }}>× {it.quantity}</span></span>
                <span style={{ color: INK, fontSize: 14.5, fontWeight: 700 }}>{fmtPrice(it.unit_price_cents * it.quantity)}</span>
              </div>
            ))}
            {order?.total_cents != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 }}>
                <span style={{ color: GOLD_HI, fontWeight: 800 }}>Total</span>
                <span style={{ color: GOLD_HI, fontWeight: 800 }}>{fmtPrice(order.total_cents)}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/merch" style={ghostCta}>Keep shopping</Link>
          <Link href="/events" style={primaryCta}>Book a loop</Link>
        </div>
      </div>
    </main>
  )
}
