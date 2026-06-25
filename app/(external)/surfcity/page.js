import { getUpcomingLoops } from '@/lib/upcomingLoops'
import HomeBody from '../_components/HomeBody'

export const metadata = {
  title: { absolute: 'Surf City Loop' },
  description: 'Hop between Surf City bars on the weekend shuttle. Book a seat, track live, ride safe.',
  alternates: { canonical: '/surfcity' },
}
export const dynamic = 'force-dynamic'

export default async function SurfLandingPage() {
  const loops = await getUpcomingLoops({ limit: 4, business: 'surf' })
  return <HomeBody loops={loops} business="surf" />
}
