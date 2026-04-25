import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Staff — Jville Brew Loop' }

export default async function StaffPortalPage() {
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

  if (user) redirect('/admin')

  return (
    <main style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1a1208 0%, #0a0a0b 60%)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: '#d4a333',
          marginBottom: 20,
        }}>
          Staff Portal
        </div>
        <h1 style={{
          fontSize: 'clamp(28px, 6vw, 40px)',
          margin: 0,
          color: '#d4a333',
          fontWeight: 700,
          lineHeight: 1.1,
        }}>
          Jville Brew Loop
        </h1>
        <p style={{
          color: '#9c9ca3',
          fontSize: 15,
          marginTop: 14,
          marginBottom: 32,
          lineHeight: 1.5,
        }}>
          Tonight's manifest, rider broadcasts, finance, and the live shuttle map.
          Sign in with the email Jacob set you up with.
        </p>

        <a
          href="/login?next=/admin"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
            color: '#0a0a0b',
            padding: '14px 32px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            boxShadow: '0 10px 30px rgba(212,163,51,0.3)',
          }}
        >
          Sign in
        </a>

        <div style={{
          marginTop: 40,
          paddingTop: 24,
          borderTop: '1px solid #2a2a31',
          display: 'grid',
          gap: 14,
          textAlign: 'left',
        }}>
          <Hint label="Driver" body="Open the live shuttle map and the tonight manifest after you sign in." />
          <Hint label="Marketing" body="Broadcast SMS to riders and pull contact lists per Loop." />
          <Hint label="Finance / ops" body="See cash, AR, ticket revenue, and bank entries on the Finance tab." />
        </div>

        <div style={{
          marginTop: 32,
          fontSize: 12,
          color: '#55555c',
        }}>
          Need access? Text Jacob.
        </div>
      </div>
    </main>
  )
}

function Hint({ label, body }) {
  return (
    <div style={{
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
    }}>
      <div style={{
        flex: '0 0 80px',
        fontSize: 10,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: '#d4a333',
        paddingTop: 2,
      }}>
        {label}
      </div>
      <div style={{
        color: '#bdbdc4',
        fontSize: 13,
        lineHeight: 1.5,
      }}>
        {body}
      </div>
    </div>
  )
}
