import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { isLeadership } from '@/lib/roles'
import ConsoleShell from '../../_components/console/ConsoleShell'

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

// Same shell as /admin. The leadership pages keep their own URLs; they are just
// no longer in the sidebar. The crew's console is the six things that run a
// night, and everything here is reached from the Back office index instead.
export default async function LeadershipLayout({ children }) {
  await requireLeadership()
  return <ConsoleShell>{children}</ConsoleShell>
}
