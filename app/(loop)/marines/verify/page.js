// The Loop — verification request (Phase 1, manual stand-in). Standalone shell.
import VerifyClient from './VerifyClient'

export const metadata = {
  title: 'Verify to ride',
  description: 'Confirm your military ID to ride The Loop.',
  alternates: { canonical: '/marines/verify' },
}

export default function VerifyPage() {
  return <VerifyClient />
}
