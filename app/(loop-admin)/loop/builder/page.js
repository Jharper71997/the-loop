// The Loop (Marines) route builder, in the /loop HUD. Leadership-only (gated in
// middleware via LEADERSHIP_ONLY_PREFIXES). Reuses the Surf BuilderClient with
// business="marines" so it loads/saves via /api/admin/loops?business=marines and
// builds kind='marines' loops. Passes the Marines partner-stop directory as the
// stop-picker source.
import { MARINES_BARS } from '@/lib/bars'
import BuilderClient from '../../../(surf-admin)/surf/builder/BuilderClient'

export const dynamic = 'force-dynamic'

export default function LoopBuilderPage() {
  const bars = MARINES_BARS.map(b => ({ slug: b.slug, name: b.name, lat: b.lat, lng: b.lng }))
  return <BuilderClient bars={bars} business="marines" />
}
