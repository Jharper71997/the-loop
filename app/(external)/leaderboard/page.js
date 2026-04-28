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
  if (!expected || token !== expected) {
    notFound()
  }

  return <LeaderboardClient token={token} />
}
