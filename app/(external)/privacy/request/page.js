import LegalPage, { H2, P, UL } from '../../_components/legal/LegalPage'
import PrivacyRequestForm from './PrivacyRequestForm'
import { LEGAL } from '@/lib/legal'

export const metadata = {
  title: 'Delete my data',
  description: 'Ask Jville Brew Loop to delete, correct, or send you a copy of your personal information.',
  alternates: { canonical: '/privacy/request' },
}

export default function PrivacyRequestPage() {
  return (
    <LegalPage
      current="/privacy/request"
      title="Delete or see your data"
      intro="Ask us to delete your information, send you a copy, fix something, or stop all texts. A person handles every request."
    >
      <PrivacyRequestForm />

      <H2 id="process">What happens next</H2>
      <UL>
        <li>We reply within 10 days to confirm we got your request.</li>
        <li>To protect you, we check that the request really comes from you. Usually that means replying from the email, or confirming from the phone number, you booked with.</li>
        <li>We complete the request within 30 days and tell you what we did.</li>
      </UL>

      <H2 id="what-we-keep">What deletion does and does not remove</H2>
      <P>We delete your contact details, survey answers, marketing preferences, messages and push subscription from our systems. Some records we have to keep, and we will tell you which: payment and refund records needed for taxes and accounting, and signed liability waivers, which may be needed if there is ever a claim about a ride. Those are kept only as long as needed and are not used for anything else. We also remove your number from our texting service&rsquo;s contact list and ask Stripe and Ticket Tailor to delete what they hold where they allow it.</P>
      <P>Just want texts to stop? Reply STOP to any text from us. That works instantly, and you can still ride.</P>
      <P>Prefer email? Write to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> with the subject &ldquo;Privacy request&rdquo;.</P>
    </LegalPage>
  )
}
