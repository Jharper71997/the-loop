import LeaderboardAdminClient from './LeaderboardAdminClient'

export const metadata = { title: 'Leaderboard — The Loop' }
export const dynamic = 'force-dynamic'

export default function AdminLeaderboardPage() {
  return <LeaderboardAdminClient />
}
