// Surf City booking-confirmation route. The shared /book/success page is branded
// data-driven from the order's event kind, so it renders Surf correctly here
// while the /surfcity prefix gives the (external) chrome its Surf branding.
// Route segment config must be declared inline (Next can't parse re-exported config).
export { default, generateMetadata } from '../../../book/success/page'

export const dynamic = 'force-dynamic'
