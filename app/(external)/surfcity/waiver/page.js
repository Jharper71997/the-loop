import WaiverBody from '../../_components/WaiverBody'

export const metadata = {
  title: 'Sign your waiver',
  description: 'Every Surf City Loop rider signs a liability waiver before pickup.',
  alternates: { canonical: '/surfcity/waiver' },
}

export default function SurfWaiverLandingPage() {
  return <WaiverBody business="surf" />
}
