import { prefixLink } from '@/lib/businessConfig'
import WaiverBody from '../../_components/WaiverBody'

export const metadata = {
  title: 'Sign your waiver',
  description: 'Every Loop rider signs a liability waiver before pickup.',
  alternates: { canonical: prefixLink('/waiver', 'marines') },
}

export default function MarinesWaiverLandingPage() {
  return <WaiverBody business="marines" />
}
