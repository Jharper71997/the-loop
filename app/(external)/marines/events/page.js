import { getUpcomingLoops } from '@/lib/upcomingLoops'
import { prefixLink } from '@/lib/businessConfig'
import EventsBody from '../../_components/EventsBody'

export const metadata = {
  title: 'Upcoming Loops',
  description: 'Book a seat on an upcoming Loop shuttle.',
  alternates: { canonical: prefixLink('/events', 'marines') },
}
export const dynamic = 'force-dynamic'

export default async function MarinesEventsPage() {
  let loops = []
  let renderError = null
  try {
    loops = await getUpcomingLoops({ limit: 24, business: 'marines' })
  } catch (err) {
    console.error('[/marines/events] render threw', err)
    renderError = err?.message || String(err)
  }
  return <EventsBody loops={loops} renderError={renderError} business="marines" />
}
