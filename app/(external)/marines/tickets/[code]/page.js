// The Loop (Marines) boarding pass route. The Brew /tickets/[code] page brands
// itself data-driven from the loaded event's kind, so it renders The Loop
// correctly here while the /marines prefix gives the shared (external) chrome
// its brand. Route config must be declared locally — Next.js / Turbopack can't
// statically parse a re-exported dynamic/runtime. Mirror the source page's values.
export { default } from '../../../tickets/[code]/page'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
