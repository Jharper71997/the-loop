import { notFound } from 'next/navigation'
import { BARS, getBar } from '@/lib/bars'
import BarDetailBody from '../../_components/BarDetailBody'
import { OG_IMAGES } from '@/lib/socialMeta'

export function generateStaticParams() {
  return BARS.map(b => ({ slug: b.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const bar = getBar(slug)
  if (!bar) return { title: 'Partner bar' }
  const neighborhoodBit = bar.neighborhood && bar.neighborhood !== 'TBD' ? ` in ${bar.neighborhood}` : ''
  const desc = `${bar.name} is a Jville Brew Loop partner bar${neighborhoodBit}. ${bar.blurb}`
  const url = `/bars/${bar.slug}`
  return {
    title: bar.name,
    description: desc,
    alternates: { canonical: url },
    // The generic share card, not the bar's own sign: the signs are square-ish
    // logos that a 1.91:1 card crops into fragments, and several are white
    // artwork on transparency that renders on black in a feed.
    openGraph: { images: OG_IMAGES, title: `${bar.name} — Jville Brew Loop`, description: desc, url },
    twitter: { images: OG_IMAGES, title: `${bar.name} — Jville Brew Loop`, description: desc },
  }
}

export default async function BarDetail({ params }) {
  const { slug } = await params
  const bar = getBar(slug)
  if (!bar) notFound()
  return <BarDetailBody bar={bar} business="brew" />
}
