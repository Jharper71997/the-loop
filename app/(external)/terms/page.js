import Link from 'next/link'
import LegalPage, { H2, P, UL } from '../_components/legal/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms for booking and riding the Jville Brew Loop shuttle, the Loop Pass membership, and our text messages.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of Service"
      intro={`These terms are the agreement between you and ${LEGAL.entity} when you use ${LEGAL.site}, buy a seat or a Loop Pass, or ride the shuttle. By booking or riding, you agree to them. Please also read our Refund Policy and Privacy Policy, which are part of these terms.`}
    >
      <H2 id="service">1. What the Loop is</H2>
      <P>Jville Brew Loop runs a shared shuttle between partner bars in Jacksonville, North Carolina on scheduled nights. The shuttle follows a posted route and returns riders to the stop where they were first picked up. It is not a ride home: getting to your first stop and leaving your original pickup stop at the end of the night is up to you.</P>
      <P>Pickup times, stops and the route are our plan for the night, not a guarantee. Traffic, weather, road closures, bar hours and safety calls can change them. We will do our best to keep you updated by text (if you opted in), email and the live tracker.</P>
      <P>We do not sell, serve or provide alcohol. Partner bars are independent businesses and are responsible for their own service, cover charges, entry rules and premises.</P>

      <H2 id="eligibility">2. Who can ride</H2>
      <UL>
        <li>Every rider must be {LEGAL.riderMinAge} or older. Bring a valid government photo ID. We or a partner bar may ask to see it, and we can refuse boarding without a refund if you cannot show it.</li>
        <li>Anyone buying tickets must be at least {LEGAL.buyerMinAge} and must have permission to give us the name, phone and email of each rider they book for.</li>
        <li>Every rider must have a signed liability waiver on file before boarding. The waiver you sign at checkout (or through your seat link) is a separate agreement, and it controls if it conflicts with these terms.</li>
      </UL>

      <H2 id="conduct">3. Riding safely</H2>
      <P>Follow the driver&rsquo;s and staff&rsquo;s instructions and the law while boarding and on board. We can refuse boarding or remove a rider, without a refund, for conduct that puts anyone at risk or disrupts the ride, including visible intoxication that makes riding unsafe, violence, harassment, damage to the shuttle, or refusing instructions. You are responsible for damage you cause. Keep track of your own belongings; we are not responsible for items left on the shuttle, though we will try to return anything we find.</P>

      <H2 id="tickets">4. Tickets and prices</H2>
      <UL>
        <li>Prices are in US dollars and are shown before you pay. We do not add booking or service fees at checkout, so you are never charged more than the total shown.</li>
        <li>A ticket is for one rider, on the night and pickup stop you chose. Your boarding pass is the QR code we send you. Do not share it; the first scan is the one that counts.</li>
        <li>If you buy a seat for a friend using a claim link, the friend must claim it, give their details and sign the waiver before they can board.</li>
        <li>Refunds and changes are covered by our <Link href="/refunds">Refund Policy</Link>.</li>
      </UL>

      <H2 id="loop-pass">5. Loop Pass membership</H2>
      <UL>
        <li>The Loop Pass is a subscription. The price and billing period are shown on the Loop Pass page before checkout and again on the Stripe payment page.</li>
        <li><strong>It renews automatically</strong> and your card is charged at the start of each billing period until you cancel.</li>
        <li>You can cancel at any time on the <Link href="/pass/manage">Manage your Loop Pass</Link> page, or by emailing or texting us. Cancelling stops future charges. Your pass stays active until the end of the period you already paid for.</li>
        <li>What the pass covers is described on the Loop Pass page at the time you join. If we change the price, we will tell you before it applies, and you can cancel before being charged the new price.</li>
      </UL>

      <H2 id="charters">6. Private parties and charters</H2>
      <P>Private shuttle bookings are quoted and confirmed individually. The price, schedule, pickup address and any deposit or cancellation terms in your quote or booking link apply to that booking, together with these terms and the waiver.</P>

      <H2 id="sms">7. Text messages</H2>
      <P>If you opt in, Jville Brew Loop texts you about your rides from {LEGAL.smsNumberDisplay} (or another number we tell you about): booking confirmations, pickup reminders, live tracking links and ride-day updates. We text your booking confirmation and boarding pass to the phone you give us at checkout. Separately, and only if you opt in to it, we may text you when new weekends go on sale.</P>
      <UL>
        <li>Message frequency varies. Message and data rates may apply.</li>
        <li>Reply <strong>STOP</strong> to any message to opt out. Reply <strong>HELP</strong> for help, or contact us at {LEGAL.email} or {LEGAL.phoneDisplay}.</li>
        <li>Agreeing to texts is never a condition of buying anything.</li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
      </UL>

      <H2 id="site">8. Using this site</H2>
      <P>Do not misuse the site: no trying to get into staff areas, scraping, reselling tickets, interfering with checkout, or using someone else&rsquo;s pass or link. The Jville Brew Loop name, logo, photos and site content belong to us or our licensors. Partner bar and sponsor names and logos belong to their owners.</P>

      <H2 id="disclaimers">9. Disclaimers and limits on liability</H2>
      <P>We provide the site and the service &ldquo;as is&rdquo;. To the fullest extent the law allows, we disclaim implied warranties, and we are not liable for indirect, incidental or consequential damages, or for the acts of partner bars, other riders or third parties. Our total liability for any claim about a ride or purchase is limited to the amount you paid for it. Nothing in these terms limits liability that cannot be limited under North Carolina law, and nothing here replaces the waiver you signed.</P>

      <H2 id="law">10. Governing law</H2>
      <P>These terms are governed by the laws of the State of North Carolina. Any dispute will be handled in the state or federal courts serving Onslow County, North Carolina, unless the law gives you the right to bring it somewhere else. Before filing anything, please contact us so we can try to fix it.</P>

      <H2 id="changes">11. Changes</H2>
      <P>We may update these terms. The version that applies to a purchase is the one you agreed to at checkout. Continuing to use the site after an update means you accept the new terms.</P>
    </LegalPage>
  )
}
