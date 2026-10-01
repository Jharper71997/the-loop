import { loadActiveTrackLoop, loadDoorPickupTrack, findDoorPickupOn } from '@/lib/trackLoop'
import TrackBody from '../_components/TrackBody'
import DoorPickupTrack from './DoorPickupTrack'

export const metadata = {
  title: 'Track the Loop',
  description: 'Live shuttle position for the Jville Brew Loop. See where the bus is, what bar is next, and meet every partner on the route.',
  alternates: { canonical: '/track' },
}
export const dynamic = 'force-dynamic'

export default async function TrackPage({ searchParams }) {
  // ?event=<id> for a door pickup (Oktoberfest) shows that ride, not a bar loop.
  const { event } = (await searchParams) || {}
  const door = await loadDoorPickupTrack(typeof event === 'string' ? event : null)
  if (door) return <DoorPickupTrack event={door.event} zones={door.zones} />

  const data = await loadActiveTrackLoop('brew')
  const doorSameDay = await findDoorPickupOn(data?.eventDate)
  return <TrackBody data={data} business="brew" doorPickup={doorSameDay} />
}
