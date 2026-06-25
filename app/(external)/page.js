import { getUpcomingLoops } from '@/lib/upcomingLoops'
import HomeBody from './_components/HomeBody'

export const metadata = {
  title: { absolute: 'Brew Loop' },
  description: 'Hop between partner bars every Friday and Saturday night in Jacksonville. Book a seat, track the shuttle live, and ride safe.',
  alternates: { canonical: '/' },
}
export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const loops = await getUpcomingLoops({ limit: 4 })
  return <HomeBody loops={loops} business="brew" />
}
