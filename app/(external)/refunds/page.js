import Link from 'next/link'
import LegalPage, { H2, P, UL } from '../_components/legal/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata = {
  title: 'Refund Policy',
  description: 'Refunds for Jville Brew Loop tickets, the Loop Pass membership, private parties and merch.',
  alternates: { canonical: '/refunds' },
}

// The 24-hour ticket rule matches what the booking confirmation email has told
// riders since launch (lib/emailTemplates.js). Change both together.
export default function RefundsPage() {
  return (
    <LegalPage
      current="/refunds"
      title="Refund Policy"
      intro="Plain rules for getting your money back. To ask for a refund, reply to your confirmation email, text or call us, or use the contact form. Refunds go back to the card you paid with."
    >
      <H2 id="tickets">Seat tickets</H2>
      <UL>
        <li><strong>More than 24 hours before your pickup time:</strong> full refund, no questions.</li>
        <li><strong>Within 24 hours of your pickup time:</strong> tickets are not refundable, because we have already planned the shuttle and the seat around you.</li>
        <li><strong>If we cancel a loop</strong> (for example weather, a mechanical problem, or a safety call), you get a full refund for that night.</li>
        <li><strong>If the night runs late or the route changes,</strong> the ticket still stands. If a delay means we cannot pick you up at all, contact us and we will refund that seat.</li>
        <li><strong>No refund</strong> if you miss the shuttle, cannot show a valid ID, or are refused boarding or removed for conduct under our <Link href="/terms#conduct">Terms</Link>.</li>
      </UL>
      <P>Refunds are processed through Stripe and usually show on your statement within 5 to 10 business days, depending on your bank.</P>

      <H2 id="loop-pass">Loop Pass membership</H2>
      <UL>
        <li>You can cancel any time on the <Link href="/pass/manage">Manage your Loop Pass</Link> page, or by emailing or texting us. Cancelling stops all future charges.</li>
        <li>Your pass stays active until the end of the billing period you already paid for. We do not give partial refunds for unused time in a period.</li>
        <li>If you were charged a renewal you did not expect, contact us within 7 days of the charge and, if you have not ridden on the pass since that charge, we will refund it.</li>
      </UL>

      <H2 id="charters">Private parties and charters</H2>
      <P>Private bookings follow the deposit and cancellation terms in your quote or booking link. If your quote does not include them, these apply: [CHARTER CANCELLATION TERMS]. If we have to cancel your booking, you get a full refund.</P>

      <H2 id="merch">Merch</H2>
      <UL>
        <li>If an item arrives damaged, defective or wrong, contact us within 30 days and we will replace it or refund it, including shipping.</li>
        <li>Other returns and exchanges: [MERCH RETURN WINDOW AND CONDITIONS].</li>
      </UL>

      <H2 id="disputes">Before you dispute a charge</H2>
      <P>Please contact us first at <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> or {LEGAL.phoneDisplay}. We answer, and it is faster than a bank dispute for everyone.</P>
    </LegalPage>
  )
}
