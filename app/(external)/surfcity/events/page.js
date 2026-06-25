import { getUpcomingLoops } from '@/lib/upcomingLoops'
import EventsBody from '../../_components/EventsBody'

export const metadata = {
  title: 'Upcoming Surf City Loops',
  description: 'Book a seat on an upcoming Surf City Loop shuttle.',
  alternates: { canonical: '/surfcity/events' },
}
export const dynamic = 'force-dynamic'

export default async function SurfEventsPage() {
  let loops = []
  let renderError = null
  try {
    loops = await getUpcomingLoops({ limit: 24, business: 'surf' })
  } catch (err) {
    console.error('[/surfcity/events] render threw', err)
    renderError = err?.message || String(err)
  }
  return <EventsBody loops={loops} renderError={renderError} business="surf" />
}
