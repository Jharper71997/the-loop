import { loadActiveTrackLoop } from '@/lib/trackLoop'
import TrackBody from '../_components/TrackBody'

export const metadata = {
  title: 'Track the Loop',
  description: 'Live shuttle position for the Jville Brew Loop. See where the bus is, what bar is next, and meet every partner on the route.',
  alternates: { canonical: '/track' },
}
export const dynamic = 'force-dynamic'

export default async function TrackPage() {
  const data = await loadActiveTrackLoop('brew')
  return <TrackBody data={data} business="brew" />
}
