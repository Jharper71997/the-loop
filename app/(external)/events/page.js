import { getUpcomingLoops } from '@/lib/upcomingLoops'
import EventsBody from '../_components/EventsBody'
import { OG_IMAGES } from '@/lib/socialMeta'

export const metadata = {
  title: 'Upcoming Loops',
  description: 'Book a seat on an upcoming Jville Brew Loop shuttle night. $20 flat, any pickup bar.',
  alternates: { canonical: '/events' },
  openGraph: {
    images: OG_IMAGES,
    title: 'Upcoming Loops',
    description: 'Pick a Friday or Saturday. $20 per seat covers your whole night on the Loop.',
    url: '/events',
  },
  twitter: {
    images: OG_IMAGES,
    title: 'Upcoming Loops',
    description: 'Pick a Friday or Saturday. $20 per seat covers your whole night on the Loop.',
  },
}
export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  let loops = []
  let renderError = null
  try {
    loops = await getUpcomingLoops({ limit: 24 })
  } catch (err) {
    console.error('[/events] render threw', err)
    renderError = err?.message || String(err)
  }
  return <EventsBody loops={loops} renderError={renderError} business="brew" />
}
