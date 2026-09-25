import Link from 'next/link'
import LegalPage, { H2, P, UL } from '../_components/legal/LegalPage'
import { LEGAL } from '@/lib/legal'

export const metadata = {
  title: 'Privacy Policy',
  description: 'What Jville Brew Loop collects when you book, ride, or contact us, who we share it with, and how to get it deleted.',
  alternates: { canonical: '/privacy' },
}

// Written from what the code actually does (2026-09-25 compliance pass). If a
// new form field, processor or tracking script is added, this page has to
// change in the same commit.
export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy Policy"
      intro={`This policy explains what ${LEGAL.entity} ("Jville Brew Loop", "we", "us") collects when you use ${LEGAL.site}, book a seat, ride the shuttle, or get in touch, and what we do with it. We do not sell your personal information.`}
    >
      <H2 id="collect">What we collect</H2>
      <P><strong>When you book a seat or claim one a friend bought for you:</strong></P>
      <UL>
        <li>First and last name, mobile number and email for the buyer and each rider.</li>
        <li>The loop, ticket and pickup stop you chose, your order and payment status, and whether you boarded (the driver or door staff scan your pass).</li>
        <li>Your liability waiver signature: the name you type, the date and time, your IP address and your browser type, plus who signed for whom when one person signs for a group. We keep these as evidence of the signed waiver.</li>
        <li>Your choice about ride texts (opted in or not) and the version of our Terms you agreed to.</li>
        <li>How you found us, if the link you used carried it: a QR code tag, a campaign tag (UTM), a bartender code or a rider referral code.</li>
      </UL>
      <P><strong>Payments.</strong> Card payments are processed by Stripe. We never see or store your full card number. Stripe shares with us your name, email, phone, billing details, and whether the payment succeeded or was refunded. For merch orders shipped to you, Stripe also collects your shipping address and shares it with us so we can mail the order.</P>
      <P><strong>Loop Pass membership.</strong> Name, mobile number, optional email, the plan, and your subscription status and renewal dates from Stripe.</P>
      <P><strong>Texts and email.</strong> The texts and emails we send you about your ride, any replies you send to our texting number, and whether you have opted out.</P>
      <P><strong>Ride survey.</strong> Your ratings and comments, favorite stop, who you rode with, how you heard about us, what you are interested in, and, if you give them, your first name, mobile number and email and whether you want texts about new weekends. We also note if you tapped through to leave a Google review.</P>
      <P><strong>Messages to us.</strong> What you send through the contact form, the data request form, or the security chat on your ticket page (messages to our door staff), along with the name, email or phone you give.</P>
      <P><strong>Waitlist.</strong> Name, mobile number and party size when a stop is sold out.</P>
      <P><strong>Bartender program.</strong> Bartender name, bar, mobile number and email when a bartender signs up to earn credit for riders they send.</P>
      <P><strong>Push notifications.</strong> If you allow notifications, your browser gives us a push address and we store it with your browser type. You can turn this off in your browser at any time.</P>
      <P><strong>Device and usage basics.</strong> Our hosting provider records standard server logs (IP address, pages requested, time, browser type). We use IP addresses to limit repeated ticket lookups. Some things are saved only on your own device, in your browser&rsquo;s storage: the phone number you used on My Tickets, your merch cart, campaign tags from the link you arrived on, and whether you dismissed a prompt. See our <Link href="/cookies">Cookie Policy</Link>.</P>
      <P><strong>What we do not collect.</strong> We do not collect your location. The live tracker shows the shuttle&rsquo;s location, which comes from our driver&rsquo;s phone. We do not run advertising pixels or third-party analytics on this site today. If we add analytics, it will only load after you agree to it in the cookie banner.</P>

      <H2 id="use">How we use it</H2>
      <UL>
        <li>To sell you a seat, issue your boarding pass, get you on the right shuttle at the right stop, and keep a record of your signed waiver.</li>
        <li>To send your booking confirmation, receipts and pass by email and text. Ride reminders and ride-day texts go only to riders who opted in.</li>
        <li>To run the night safely: rider lists for drivers and door staff, boarding scans, and answering messages sent to security.</li>
        <li>To handle refunds, charge-backs and disputes, and to keep business and tax records.</li>
        <li>To understand which bars, partners and campaigns bring riders in, credit bartenders and referrers, and improve the service using survey answers.</li>
        <li>To send texts about new weekends only if you opted in to those separately.</li>
        <li>To protect the service and our riders, and to meet legal obligations.</li>
      </UL>

      <H2 id="share">Who we share it with</H2>
      <P>We share personal information only with the service providers that run the Loop for us, under their own privacy and security terms, and only what each one needs:</P>
      <UL>
        <li><strong>Supabase</strong>, our database and staff login provider, stores booking, rider and survey records.</li>
        <li><strong>Vercel</strong> hosts this website and keeps server logs.</li>
        <li><strong>Stripe</strong> processes payments, refunds and Loop Pass subscriptions.</li>
        <li><strong>SimpleTexting</strong> sends and receives our text messages and keeps opt-out lists.</li>
        <li><strong>Resend</strong> delivers our emails.</li>
        <li><strong>Ticket Tailor</strong> handled ticket sales before our own checkout, and still holds those past orders.</li>
        <li><strong>Google Fonts</strong> serves two of the fonts on this site, so your browser sends Google a request (including your IP address) when pages load.</li>
        <li><strong>OpenStreetMap</strong> serves the map tiles on the live tracker, so your browser requests tiles from their servers.</li>
        <li><strong>Your browser&rsquo;s push service</strong> (for example Google, Apple or Mozilla) delivers push notifications if you turned them on.</li>
      </UL>
      <P>Our drivers, door staff and partner-bar contacts see what they need on the night, such as rider first names, pickup stops and boarding status. We also share information if the law requires it, to protect the safety of riders or the public, or as part of a sale or transfer of the business. We do not sell or rent personal information, and we do not share it for cross-context behavioral advertising.</P>

      <H2 id="keep">How long we keep it</H2>
      <P>We keep booking, payment and waiver records for as long as we need them for the service, taxes, accounting and possible legal claims (waivers in particular may be needed long after a ride). Survey answers, contact messages and marketing preferences are kept until you ask us to delete them or they are no longer useful. Server logs are kept by our host for a limited period. When you ask us to delete your data, we delete what we are not required to keep. See <Link href="/privacy/request">Delete my data</Link>.</P>

      <H2 id="choices">Your choices and rights</H2>
      <UL>
        <li><strong>Texts:</strong> reply STOP to any text from us to opt out, or HELP for help. Opting out of texts never cancels your ticket.</li>
        <li><strong>Email:</strong> our emails are about your bookings. If we ever send marketing email, every one will have an unsubscribe link.</li>
        <li><strong>Access, correction and deletion:</strong> ask us for a copy of your information, to fix it, or to delete it, using the <Link href="/privacy/request">data request form</Link> or by emailing <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. We will confirm your request, may ask you to verify you control the phone or email on file, and aim to respond within 30 days.</li>
        <li><strong>Cookies and analytics:</strong> see the <Link href="/cookies">Cookie Policy</Link>.</li>
      </UL>
      <P>We will not treat you differently for using any of these choices.</P>

      <H2 id="age">Age requirements and children</H2>
      <P>Riders on Jville Brew Loop must be {LEGAL.riderMinAge} or older, and anyone buying tickets must be at least {LEGAL.buyerMinAge}. This site is not meant for children and we do not knowingly collect personal information from anyone under 13. If you believe a child has given us information, contact us and we will delete it.</P>

      <H2 id="security">Security</H2>
      {/* Do NOT add claims like "access is restricted to staff" here until the
          anon-readable tables found in the 2026-09-20 security audit are
          locked down (RLS). Today that sentence would be false. */}
      <P>We use established providers and encrypted connections (HTTPS) to protect your information. No system is perfectly secure, so we cannot promise absolute security. If a breach affects your personal information, we will notify you as North Carolina law requires.</P>

      <H2 id="changes">Changes</H2>
      <P>If we change this policy, we will update the effective date above. If a change is significant, we will give notice on this site before it takes effect.</P>
    </LegalPage>
  )
}
