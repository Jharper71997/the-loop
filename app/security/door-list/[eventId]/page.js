import RosterClient from './RosterClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function DoorListRosterPage({ params }) {
  const { eventId } = await params
  return <RosterClient eventId={eventId} />
}
