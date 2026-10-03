import { notFound } from 'next/navigation'
import { LANDING_PAGES, getLandingPage } from '@/lib/seoPages'
import LandingTemplate from '../../_components/marketing/LandingTemplate'
import { OG_IMAGES } from '@/lib/socialMeta'

// Search-landing pages, one per keyword cluster. The content is data in
// lib/seoPages.js; the layout is LandingTemplate. Don't add page files here.

export const dynamicParams = false

export function generateStaticParams() {
  return LANDING_PAGES.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const page = getLandingPage(slug)
  if (!page) return {}
  const url = `/jacksonville-nc/${page.slug}`
  return {
    title: { absolute: page.meta.title },
    description: page.meta.description,
    alternates: { canonical: url },
    openGraph: { images: OG_IMAGES, title: page.meta.title, description: page.meta.description, url },
    twitter: { images: OG_IMAGES, title: page.meta.title, description: page.meta.description },
  }
}

export default async function LandingPage({ params }) {
  const { slug } = await params
  const page = getLandingPage(slug)
  if (!page) notFound()
  return <LandingTemplate page={page} />
}
