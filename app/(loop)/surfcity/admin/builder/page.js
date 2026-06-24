// Surf City Loop route builder. Code-gated. Passes the Surf bar directory to
// the client as the stop picker source. The client loads/saves loops via
// /api/surf-admin/loops (multi-loop, stop-first — see that route).

import { isSurfAdmin } from '@/lib/surfAdmin'
import { SURF_BARS } from '@/lib/bars'
import SurfAdminGate from '../SurfAdminGate'
import BuilderClient from './BuilderClient'

export const dynamic = 'force-dynamic'

export default async function SurfBuilderPage() {
  if (!(await isSurfAdmin())) return <SurfAdminGate />
  const bars = SURF_BARS.map(b => ({ slug: b.slug, name: b.name, lat: b.lat, lng: b.lng }))
  return <BuilderClient bars={bars} />
}
