// Surf City Loop route builder, re-homed into the /admin HUD app. Leadership-only
// (gated in middleware via LEADERSHIP_ONLY_PREFIXES). Passes the Surf bar
// directory to the client as the stop-picker source. Loads/saves loops via
// /api/admin/loops (multi-loop, stop-first — see that route).
//
// This is the flexible builder Brew's rigid "clone last weekend" flow lacks; it
// only ever builds kind='surf' loops, regardless of the business toggle.

import { SURF_BARS } from '@/lib/bars'
import BuilderClient from './BuilderClient'

export const dynamic = 'force-dynamic'

export default function BuilderPage() {
  const bars = SURF_BARS.map(b => ({ slug: b.slug, name: b.name, lat: b.lat, lng: b.lng }))
  return <BuilderClient bars={bars} />
}
