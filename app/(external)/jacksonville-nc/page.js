import { LandingHub } from '../_components/marketing/LandingTemplate'
import { OG_IMAGES } from '@/lib/socialMeta'

const TITLE = 'Jacksonville, NC Nightlife and Bar Hopping Guides | Jville Brew Loop'
const DESCRIPTION = 'Bar hopping, nightlife, group nights and getting around Jacksonville, NC without driving. Guides from the Jville Brew Loop, the city’s Friday and Saturday night bar shuttle.'

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/jacksonville-nc' },
  openGraph: { images: OG_IMAGES, title: TITLE, description: DESCRIPTION, url: '/jacksonville-nc' },
  twitter: { images: OG_IMAGES, title: TITLE, description: DESCRIPTION },
}

export default function JacksonvilleHub() {
  return <LandingHub />
}
