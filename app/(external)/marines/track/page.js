import { loadActiveTrackLoop } from '@/lib/trackLoop'
import TrackBody from '../../_components/TrackBody'

export const metadata = {
  title: 'Track the Loop',
  description: 'Live shuttle position for The Loop. See where the bus is and meet every stop on the route.',
  alternates: { canonical: '/marines/track' },
}
export const dynamic = 'force-dynamic'

export default async function MarinesTrackPage() {
  const data = await loadActiveTrackLoop('marines')
  return <TrackBody data={data} business="marines" />
}
