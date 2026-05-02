import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Session storage instead of localStorage so closing the browser/tab signs
// users out. Leadership/admin sessions don't persist across browser restarts —
// matches the security posture for a finance + ops dashboard. Public routes
// (/book, /my-tickets, /waiver, etc.) are gated by middleware PUBLIC_PREFIXES
// and don't rely on a Supabase session, so they're unaffected.
const sessionOnlyStorage = typeof window === 'undefined'
  ? undefined
  : window.sessionStorage

export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: sessionOnlyStorage,
    persistSession: true,         // still persist within the session
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
