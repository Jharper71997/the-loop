import { getUpcomingLoops } from '@/lib/upcomingLoops'
import BrewLanding from './_components/marketing/BrewLanding'

export const metadata = {
  title: { absolute: 'Jville Brew Loop — Jacksonville’s weekend bar-hop shuttle' },
  description:
    'The Brew Loop loops the best bars in Jacksonville all night so nobody has to be the one who drives. $20 flat, tracked live, back to your pickup. Book a seat.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Jville Brew Loop — hit every bar, never touch your keys',
    description:
      'Jacksonville’s weekend bar-hop shuttle. $20 flat, tracked live, back to your pickup. Nobody drives between bars.',
    url: '/',
    type: 'website',
  },
  twitter: {
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
