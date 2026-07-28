// One-off: replace the placeholder stop coords on the live Marines loops with
// the real geocoded Jacksonville NC locations. Matches stops by name keyword,
// only overwrites lat/lng (keeps name/on_base/start_time). Dry-run by default;
// pass --apply to write.
//
//   set -a && source /c/Users/jacob/the-loop/.env.local && set +a
//   node scripts/fix-marines-coords.js            # dry run
//   node scripts/fix-marines-coords.js --apply    # write

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))
const APPLY = process.argv.includes('--apply')

// Real geocoded coords (OpenStreetMap), keyed by a name keyword.
const COORDS = [
  { match: s => /new river|gate/i.test(s) || false, name: 'New River gate (187 Curtis Rd)', lat: 34.7286409, lng: -77.4701155 },
  { match: s => /dragon/i.test(s),                   name: "Dragon's Brew (3430 Richlands Hwy)", lat: 34.7623492, lng: -77.4857645 },
  { match: s => /cozy/i.test(s),                     name: 'Cozy Co (408 Mill Ave)', lat: 34.7496607, lng: -77.4324215 },
  { match: s => /restaurant/i.test(s),               name: 'Restaurants (Angry Ginger, 1202 Gum Branch Rd)', lat: 34.7794209, lng: -77.4162900 },
  { match: s => /mario/i.test(s),                    name: 'Mario & Co (108 Western Blvd)', lat: 34.7458360, lng: -77.3792252 },
  { match: s => /good times/i.test(s),               name: 'Good Times (1657 Lejeune Blvd)', lat: 34.7435232, lng: -77.3825875 },
  { match: s => /crush/i.test(s),                    name: 'Crush Nutrition (571 Yopp Rd)', lat: 34.7539334, lng: -77.4641163 },
]

function coordFor(stopName, isBase) {
  // Base gate first — its name may just be "New River gate".
  if (isBase) return COORDS[0]
  return COORDS.find(c => c.match(stopName || ''))
}

;(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1) }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: groups, error } = await sb
    .from('groups')
    .select('id, name, event_date, schedule, kind, closed_out_at')
    .eq('kind', 'marines')
    .is('closed_out_at', null)
    .gte('event_date', '2026-07-01')
    .order('event_date', { ascending: true })
  if (error) { console.error('query failed', error); process.exit(1) }
  if (!groups?.length) { console.log('No open upcoming Marines groups found.'); return }

  for (const g of groups) {
    const sched = Array.isArray(g.schedule) ? g.schedule : []
    console.log(`\n${g.event_date} · ${g.name} (${sched.length} stops)`)
    const next = sched.map((s, i) => {
      const c = coordFor(s.name, !!s.on_base)
      if (!c) { console.log(`  [skip] ${i}. "${s.name}" — no coord match`); return s }
      const changed = s.lat !== c.lat || s.lng !== c.lng
      console.log(`  ${changed ? '[set ]' : '[same]'} ${i}. ${s.name} -> ${c.lat}, ${c.lng}  (${c.name})`)
      return { ...s, lat: c.lat, lng: c.lng }
    })
    if (APPLY) {
      const { error: uErr } = await sb.from('groups').update({ schedule: next }).eq('id', g.id)
      console.log(uErr ? `  !! update failed: ${uErr.message}` : '  saved.')
    }
  }
  console.log(APPLY ? '\nDone (applied).' : '\nDry run. Re-run with --apply to write.')
})()

function loadDotEnvIfMissing(p) {
  try {
    if (process.env.SUPABASE_SERVICE_KEY) return
    const txt = fs.readFileSync(p, 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {}
}
