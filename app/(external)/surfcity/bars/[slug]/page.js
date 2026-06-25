import { notFound } from 'next/navigation'
import { SURF_BARS, getSurfBar } from '@/lib/bars'
import BarDetailBody from '../../../_components/BarDetailBody'

export function generateStaticParams() {
  return SURF_BARS.map(b => ({ slug: b.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const bar = getSurfBar(slug)
  if (!bar) return { title: 'Partner bar' }
  const neighborhoodBit = bar.neighborhood && bar.neighborhood !== 'TBD' ? ` in ${bar.neighborhood}` : ''
  const desc = `${bar.name} is a Surf City Loop partner bar${neighborhoodBit}. ${bar.blurb}`
  const url = `/surfcity/bars/${bar.slug}`
  return {
    title: bar.name,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: `${bar.name} — Surf City Loop`, description: desc, url },
    twitter: { title: `${bar.name} — Surf City Loop`, description: desc },
  }
}

export default async function SurfBarDetail({ params }) {
  const { slug } = await params
  const bar = getSurfBar(slug)
  if (!bar) notFound()
  return <BarDetailBody bar={bar} business="surf" />
}
