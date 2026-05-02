import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { isLeadership } from '@/lib/roles'
import LeadershipNav from '../_components/LeadershipNav'

// Middleware already gates /leadership/** via LEADERSHIP_ONLY_PREFIXES, but
// we double-check at the layout level so that a slip in middleware config
// doesn't expose financial data. Server-side hard fail.
async function requireLeadership() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/leadership')
  if (!isLeadership(user.email)) redirect('/admin')
}

export default async function LeadershipLayout({ children }) {
  await requireLeadership()
  return (
    <div className="hud-shell">
      <LeadershipNav />
      {children}
    </div>
  )
}
