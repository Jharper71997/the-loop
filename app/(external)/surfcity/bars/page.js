import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Track the Surf City Loop',
  alternates: { canonical: '/surfcity/track' },
}

export default function SurfBarsIndex() {
  redirect('/surfcity/track')
}
