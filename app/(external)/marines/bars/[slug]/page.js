import { notFound } from 'next/navigation'
import { MARINES_BARS, getMarinesBar } from '@/lib/bars'
import BarDetailBody from '../../../_components/BarDetailBody'

export function generateStaticParams() {
  return MARINES_BARS.map(b => ({ slug: b.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const bar = getMarinesBar(slug)
  if (!bar) return { title: 'Partner stop' }
  const neighborhoodBit = bar.neighborhood && bar.neighborhood !== 'TBD' ? ` in ${bar.neighborhood}` : ''
  const desc = `${bar.name} is a Loop partner stop${neighborhoodBit}. ${bar.blurb}`
  const url = `/marines/bars/${bar.slug}`
  return {
    title: bar.name,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: `${bar.name} — The Loop`, description: desc, url },
    twitter: { title: `${bar.name} — The Loop`, description: desc },
  }
}

export default async function MarinesBarDetail({ params }) {
  const { slug } = await params
  const bar = getMarinesBar(slug)
  if (!bar) notFound()
  return <BarDetailBody bar={bar} business="marines" />
}
