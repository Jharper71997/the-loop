import { prefixLink } from '@/lib/businessConfig'
import VerifyClient from './VerifyClient'

export const metadata = {
  title: 'Verify to ride',
  description: "Verify you're a Marine with your 10-digit DoD ID, then you're cleared to ride The Loop.",
  robots: { index: false },
  alternates: { canonical: prefixLink('/verify', 'marines') },
}

export const dynamic = 'force-dynamic'

export default function MarinesVerifyPage() {
  return <VerifyClient />
}
