import LeaderboardAdminClient from './LeaderboardAdminClient'

export const metadata = { title: 'Leaderboard — The Loop' }
export const dynamic = 'force-dynamic'

// /leadership is leadership-only (middleware + lib/roles), so the real signup
// code and leaderboard token can go into the copyable share links here. They
// used to show placeholders, and a signup link copied from this page without
// the code was rejected with "invalid invite code".
export default function AdminLeaderboardPage() {
  return (
    <LeaderboardAdminClient
      signupCode={process.env.BARTENDER_SIGNUP_CODE || ''}
      leaderboardToken={process.env.LEADERBOARD_TOKEN || ''}
    />
  )
}
