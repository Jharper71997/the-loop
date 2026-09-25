import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { isLeadership } from '@/lib/roles'

export const metadata = { title: 'Texts' }

// Middleware already bounces non-leadership from /admin/messages (see
// LEADERSHIP_ONLY_PREFIXES in lib/roles.js). This is the second lock, same as
// the /leadership layout: these pages read private rider conversations with
// the service key, so a slip in middleware must not expose them.
export default async function MessagesLayout({ children }) {
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
  if (!user) redirect('/login?next=/admin/messages')
  if (!isLeadership(user.email)) redirect('/admin')
  return children
}
