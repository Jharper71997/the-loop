// Server-only bar lookup that merges the static lib/bars.js directory with
// the bars DB table. Used by /track and /driver so leadership-added bars
// (which only live in the DB) get their pin on the live map without a
// code change to lib/bars.js.
//
// Lookup order:
//   1. Static directory (fastest, no DB hit, covers the original 8 partners)
//   2. DB by exact lowercase name match
//   3. DB by normalized name (drops "the ", punctuation, whitespace) so a
//      schedule entry of "Unhinged" resolves to "Unhinged Bar and Grill"
//
// Returns { name, lat, lng, slug, address, blurb } or null if no match
// with usable coords. Callers should treat null lat/lng as "no pin".

import { getBarByName as getStaticBarByName } from './bars'

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
}

// Normalized substring match either direction, with min length to avoid
// "Bar" matching every bar. Returns the longest-matching row.
function fuzzyMatch(rows, name) {
  const target = normalize(name)
  if (!target || target.length < 4) return null
  let best = null
  let bestLen = 0
  for (const r of rows) {
    const rn = normalize(r.name)
    if (rn.length < 4) continue
    if (rn.includes(target) || target.includes(rn)) {
      const matchLen = Math.min(rn.length, target.length)
      if (matchLen > bestLen) { best = r; bestLen = matchLen }
    }
  }
  return best
}

export async function lookupBarByName(supabase, name) {
  if (!name) return null

  const stat = getStaticBarByName(name)
  if (stat && Number.isFinite(stat.lat) && Number.isFinite(stat.lng)) {
    return stat
  }

  if (!supabase) return stat
  const lower = String(name).trim().toLowerCase()

  const { data: rows } = await supabase
    .from('bars')
    .select('slug, name, address, lat, lng, blurb')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (!Array.isArray(rows) || !rows.length) return stat

  const exact = rows.find(r => String(r.name || '').toLowerCase() === lower)
  if (exact) return exact

  const target = normalize(name)
  if (!target) return stat
  const normExact = rows.find(r => normalize(r.name) === target)
  if (normExact) return normExact

  return fuzzyMatch(rows, name) || stat
}

// Bulk variant — resolves a list of stop names in one DB round-trip.
// Returns Map<originalName, bar | null>. Use this from page renders that
// loop over a schedule, instead of calling lookupBarByName per stop.
export async function lookupBarsByNames(supabase, names) {
  const out = new Map()
  if (!Array.isArray(names) || !names.length) return out

  // Static pass first.
  const unresolved = []
  for (const n of names) {
    const stat = getStaticBarByName(n)
    if (stat && Number.isFinite(stat.lat) && Number.isFinite(stat.lng)) {
      out.set(n, stat)
    } else {
      unresolved.push(n)
    }
  }

  if (!unresolved.length || !supabase) return out

  const { data: rows } = await supabase
    .from('bars')
    .select('slug, name, address, lat, lng, blurb')
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (!Array.isArray(rows) || !rows.length) return out

  for (const n of unresolved) {
    const lower = String(n).trim().toLowerCase()
    const exact = rows.find(r => String(r.name || '').toLowerCase() === lower)
    if (exact) { out.set(n, exact); continue }
    const target = normalize(n)
    if (!target) { out.set(n, null); continue }
    const normExact = rows.find(r => normalize(r.name) === target)
    if (normExact) { out.set(n, normExact); continue }
    out.set(n, fuzzyMatch(rows, n) || null)
  }

  return out
}

// Resolve a group's schedule into placed stops for the live map + ETA math.
//
// A schedule entry may carry inline lat/lng (The Loop / Marines stops, which
// are NOT partner bars) or just a name that resolves against the bars table
// (Brew Loop stops). Inline coords always win — a Marine stop named like a
// real bar must not grab the bar's pin. One bar lookup covers the rest.
//
// Returns [{ index, name, startTime, lat, lng, onBase }]; lat/lng are null
// when neither source has usable coords (caller treats null as "no pin").
export async function resolveScheduleStops(supabase, schedule) {
  const sched = Array.isArray(schedule) ? schedule : []
  if (!sched.length) return []

  const hasInline = s => Number.isFinite(Number(s?.lat)) && Number.isFinite(Number(s?.lng))
  const needLookup = sched.filter(s => !hasInline(s) && s?.name).map(s => s.name)
  const barLookup = needLookup.length
    ? await lookupBarsByNames(supabase, needLookup).catch(() => new Map())
    : new Map()

  return sched.map((s, i) => {
    const inline = hasInline(s)
    const bar = !inline && s?.name ? barLookup.get(s.name) : null
    return {
      index: i,
      name: s?.name || `Stop ${i + 1}`,
      startTime: s?.start_time || null,
      lat: inline ? Number(s.lat) : (Number.isFinite(bar?.lat) ? bar.lat : null),
      lng: inline ? Number(s.lng) : (Number.isFinite(bar?.lng) ? bar.lng : null),
      onBase: !!s?.on_base,
    }
  })
}
