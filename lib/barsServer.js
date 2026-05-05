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
  const fuzzy = rows.find(r => normalize(r.name) === target)
  return fuzzy || stat
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
    const fuzzy = rows.find(r => normalize(r.name) === target)
    out.set(n, fuzzy || null)
  }

  return out
}
