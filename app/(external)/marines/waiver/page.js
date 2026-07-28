import WaiverBody from '../../_components/WaiverBody'

export const metadata = {
  title: 'Sign your waiver',
  description: 'Every Loop rider signs a liability waiver before pickup.',
  alternates: { canonical: '/marines/waiver' },
}

export default function MarinesWaiverLandingPage() {
  return <WaiverBody business="marines" />
}
