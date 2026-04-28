import LeaderboardAdminClient from './LeaderboardAdminClient'
import { BARS } from '@/lib/bars'

export const metadata = { title: 'Leaderboard — The Loop' }
export const dynamic = 'force-dynamic'

export default function AdminLeaderboardPage() {
  const bars = BARS.map(b => ({ slug: b.slug, name: b.name }))
  return <LeaderboardAdminClient bars={bars} />
}
