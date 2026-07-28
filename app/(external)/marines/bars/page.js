import { redirect } from 'next/navigation'
import { prefixLink } from '@/lib/businessConfig'

// The Loop has no bar directory — its stops are businesses around Jacksonville,
// shown on the live map. This URL only exists because the rider surface is a
// clone of the Brew/Surf tree; forward it to the map.
const TRACK = prefixLink('/track', 'marines')

export const metadata = {
  title: 'The Loop — stops',
  alternates: { canonical: TRACK },
}

export default function MarinesBarsIndex() {
  redirect(TRACK)
}
