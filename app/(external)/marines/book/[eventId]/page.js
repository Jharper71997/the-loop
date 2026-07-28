// The Loop (Marines) booking route. The Brew /book/[eventId] page is branded
// data-driven from the loaded event's kind, so it renders The Loop correctly
// here while the /marines prefix gives the shared (external) chrome its brand.
// Route segment config must be declared inline (Next can't parse re-exported config).
export { default, generateMetadata } from '../../../book/[eventId]/page'

export const dynamic = 'force-dynamic'
