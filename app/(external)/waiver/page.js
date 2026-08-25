import WaiverBody from '../_components/WaiverBody'

export const metadata = {
  title: 'Sign your waiver',
  description: 'Every Brew Loop rider signs a liability waiver before pickup.',
  alternates: { canonical: '/waiver' },
}

export default function WaiverLandingPage() {
  return <WaiverBody business="brew" />
}
