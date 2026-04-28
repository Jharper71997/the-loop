import { notFound } from 'next/navigation'
import LeaderboardClient from './LeaderboardClient'

export const metadata = {
  title: 'Bartender Leaderboard',
  description: 'Brew Loop bartender contest standings.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage({ searchParams }) {
  const params = await searchParams
  const token = String(params?.t || '')
  const expected = process.env.LEADERBOARD_TOKEN || ''
  // If LEADERBOARD_TOKEN is not configured, the leaderboard is public — that's
  // the friendlier default while bartenders are still passing links around.
  // If it's configured, ?t= must match.
  if (expected && token !== expected) {
    notFound()
  }

  return <LeaderboardClient token={token} />
}
