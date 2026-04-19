import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Waivers — The Loop' }

export default async function WaiversPage() {
  const supabase = supabaseAdmin()
  const [{ data: sigs }, { data: versions }] = await Promise.all([
    supabase
      .from('waiver_signatures')
      .select('id, full_name_typed, signed_at, ip_address, signed_for_contact_id, contacts:contact_id(first_name, last_name, phone), waiver_versions(version)')
      .order('signed_at', { ascending: false })
      .limit(300),
    supabase
      .from('waiver_versions')
      .select('id, version, effective_at')
      .order('version', { ascending: false }),
  ])

  return (
    <main style={pageStyle}>
      <h1 style={h1}>Waivers</h1>
      <p style={subtle}>Signed waiver audit trail. Bump a version in <code>waiver_versions</code> to force re-signing.</p>

      <h2 style={h2}>Versions</h2>
      <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
        {(versions || []).map(v => (
          <div key={v.id} style={{ ...card, padding: 10, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>v{v.version}</span>
            <span style={{ color: '#9c9ca3' }}>effective {String(v.effective_at).slice(0, 10)}</span>
          </div>
        ))}
      </div>

      <h2 style={h2}>Signatures ({sigs?.length || 0})</h2>
      <div style={{ display: 'grid', gap: 6 }}>
        {(sigs || []).map(s => {
          const c = s.contacts || {}
          return (
            <div key={s.id} style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {c.first_name} {c.last_name}
                    {s.signed_for_contact_id && (
                      <span style={{ marginLeft: 8, color: '#facc15', fontSize: 11 }}>(signed by buyer)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#9c9ca3' }}>
                    {c.phone || '—'} · v{s.waiver_versions?.version}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#bbb' }}>
                  <div>{new Date(s.signed_at).toLocaleString()}</div>
                  {s.ip_address && <div style={{ color: '#9c9ca3' }}>{s.ip_address}</div>}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#d4a333' }}>
                Signature: {s.full_name_typed}
              </div>
            </div>
          )
        })}
        {(!sigs || sigs.length === 0) && <div style={card}>No signatures yet.</div>}
      </div>
    </main>
  )
}

const pageStyle = { maxWidth: 900, margin: '0 auto', padding: '20px 16px', color: '#fff', minHeight: '100vh' }
const h1 = { fontSize: 26, color: '#d4a333', margin: '0 0 4px' }
const h2 = { fontSize: 14, color: '#d4a333', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }
const subtle = { color: '#9c9ca3', fontSize: 13, margin: '0 0 18px' }
const card = { padding: 14, background: '#15151a', border: '1px solid #2a2a31', borderRadius: 12 }
