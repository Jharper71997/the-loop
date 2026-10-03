import { getUpcomingLoops } from '@/lib/upcomingLoops'
import BrewLanding from './_components/marketing/BrewLanding'
import { OG_IMAGES } from '@/lib/socialMeta'

export const metadata = {
  title: { absolute: 'Jville Brew Loop | Bar Hopping Shuttle in Jacksonville, NC' },
  description:
    'Jacksonville, NC’s Friday and Saturday night bar shuttle. One $20 seat loops the partner bars all night and brings you back to your pickup, so nobody has to drive. Tracked live. Book a seat.',
  alternates: { canonical: '/' },
  openGraph: {
    images: OG_IMAGES,
    title: 'Jville Brew Loop — hit every bar, never touch your keys',
    description:
      'Jacksonville’s weekend bar-hop shuttle. $20 flat, tracked live, back to your pickup. Nobody drives between bars.',
    url: '/',
    type: 'website',
  },
  twitter: {
    images: OG_IMAGES,
    card: 'summary_large_image',
    title: 'Jville Brew Loop',
    description: 'Jacksonville’s weekend bar-hop shuttle. $20 flat, tracked live. Nobody drives between bars.',
  },
}
export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const loops = await getUpcomingLoops({ limit: 4, business: 'brew' })
  return <BrewLanding loops={loops} />
}
