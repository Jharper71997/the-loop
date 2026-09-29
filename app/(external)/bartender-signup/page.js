import SignupClient from './SignupClient'
import { BARS } from '@/lib/bars'

export const metadata = {
  title: 'Brew Loop Sales Team — Sign up',
  description: 'Get your personal Brew Loop referral QR and code. Sell tickets, earn commission.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function BartenderSignupPage() {
  const bars = BARS.map(b => ({ slug: b.slug, name: b.name }))
  return <SignupClient bars={bars} />
}
