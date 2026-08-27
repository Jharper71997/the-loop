import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getPartyByToken } from '@/lib/parties'
import { loadActiveTrackLoop } from '@/lib/trackLoop'
import TrackBody from '../../../_components/TrackBody'
import { INK_MUTE, MAX_W } from '@/lib/marketingTheme'

export const dynamic = 'force-dynamic'

// Live tracking for ONE private party.
//
// The public /track answers "where is the Friday bus", and it deliberately
// ignores private parties — a charter appearing there would publish its name
// and its pickup address, which is often somebody's house. That exclusion is
// what makes this page necessary: without it a charter rider opening /track
// would be shown the public loop and watch the wrong bus all night.
//
// Reached only through the party's own secret token, so it inherits exactly the
// privacy of the booking page it hangs off.
export const metadata = {
  title: 'Track your shuttle',
  robots: { index: false, follow: false, nocache: true },
}

export default async function PartyTrackPage({ params }) {
  const { token } = await params

  let sb
  try {
    sb = supabaseAdmin()
  } catch (err) {
    console.error('[party/track] supabaseAdmin init failed', err)
    notFound()
  }

  const party = await getPartyByToken(sb, token)
  if (!party) notFound()

  // Load THIS party by id rather than "the next loop", which is the whole point.
  const data = await loadActiveTrackLoop('brew', { eventId: party.event.id })

  return (
    <>
      <TrackBody data={data} business="brew" />
      <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: '0 24px 40px' }}>
        <Link href={`/party/${token}`} style={{ color: INK_MUTE, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
          &larr; Back to your outing
        </Link>
      </div>
    </>
  )
}
