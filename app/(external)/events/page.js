import { getUpcomingLoops } from '@/lib/upcomingLoops'
import EventsBody from '../_components/EventsBody'
import { OG_IMAGES } from '@/lib/socialMeta'
import JsonLd from '../_components/site/JsonLd'
import { loopEventNode, breadcrumbNode } from '@/lib/jsonLd'

export const metadata = {
  title: 'Book the Bar Shuttle This Weekend',
  description: 'Book a seat on this weekend’s Jville Brew Loop, the Friday and Saturday night bar-hop shuttle in Jacksonville, NC. $20 a seat, pick your pickup bar, tracked live.',
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
  return (
    <>
      <EventsBody loops={loops} renderError={renderError} business="brew" />
      {/* Each public on-sale night as a schema.org Event, so the dates can show
          up as event results in Google. Private parties never reach this list
          (getUpcomingLoops filters is_private). */}
      <JsonLd nodes={[
        breadcrumbNode([{ name: 'Home', path: '/' }, { name: 'Upcoming Loops', path: '/events' }]),
        ...loops.map(loopEventNode),
      ]} />
    </>
  )
}
