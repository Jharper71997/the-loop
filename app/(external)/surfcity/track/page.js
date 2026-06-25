import { loadActiveTrackLoop } from '@/lib/trackLoop'
import TrackBody from '../../_components/TrackBody'

export const metadata = {
  title: 'Track the Surf City Loop',
  description: 'Live shuttle position for the Surf City Loop. See where the bus is and meet every partner bar on the route.',
  alternates: { canonical: '/surfcity/track' },
}
export const dynamic = 'force-dynamic'

export default async function SurfTrackPage() {
  const data = await loadActiveTrackLoop('surf')
  return <TrackBody data={data} business="surf" />
}
