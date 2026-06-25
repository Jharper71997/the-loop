import { notFound } from 'next/navigation'
import { BARS, getBar } from '@/lib/bars'
import BarDetailBody from '../../_components/BarDetailBody'

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
    openGraph: { title: `${bar.name} — Jville Brew Loop`, description: desc, url },
    twitter: { title: `${bar.name} — Jville Brew Loop`, description: desc },
  }
}

export default async function BarDetail({ params }) {
  const { slug } = await params
  const bar = getBar(slug)
  if (!bar) notFound()
  return <BarDetailBody bar={bar} business="brew" />
}
