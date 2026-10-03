import { notFound } from 'next/navigation'
import { BARS, getBar } from '@/lib/bars'
import BarDetailBody from '../../_components/BarDetailBody'
import { OG_IMAGES } from '@/lib/socialMeta'
import { ROUTE_NOTES } from '@/lib/seoPages'

export function generateStaticParams() {
  return BARS.map(b => ({ slug: b.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const bar = getBar(slug)
  if (!bar) return { title: 'Partner bar' }
  // Tuned to how people actually search a bar: "<bar name> jacksonville nc".
  // Address in the description because "where is" is the most common follow-on.
  const title = `${bar.name}, Jacksonville NC | Brew Loop Partner Bar`
  // No blurb here: several lib/bars.js blurbs carry unverified claims
  // (karaoke nights, veteran-owned), and Jacob kept those out of metadata.
  const fridayOnly = ROUTE_NOTES[bar.slug] === 'Fridays only'
  const desc = `${bar.name}${bar.address ? ` at ${bar.address}` : ''} is a partner bar on the Jville Brew Loop${fridayOnly ? ', on Friday nights only' : ''}. Ride the $20 ${fridayOnly ? 'Friday night' : 'Friday and Saturday'} bar shuttle there without driving.`
  const url = `/bars/${bar.slug}`
  return {
    title: { absolute: title },
    description: desc,
    alternates: { canonical: url },
    // The generic share card, not the bar's own sign: the signs are square-ish
    // logos that a 1.91:1 card crops into fragments, and several are white
    // artwork on transparency that renders on black in a feed.
    openGraph: { images: OG_IMAGES, title, description: desc, url },
    twitter: { images: OG_IMAGES, title, description: desc },
  }
}

export default async function BarDetail({ params }) {
  const { slug } = await params
  const bar = getBar(slug)
  if (!bar) notFound()
  return <BarDetailBody bar={bar} business="brew" />
}
