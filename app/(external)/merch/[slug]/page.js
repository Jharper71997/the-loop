import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMerchProduct } from '@/lib/merch'
import { fmtPrice } from '../../_components/merch/MerchBody'
import MerchGallery from '../../_components/merch/MerchGallery'
import AddToCart from './AddToCart'
import { GOLD, INK, INK_DIM, MAX_W } from '@/lib/marketingTheme'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { slug } = await params
  const product = await getMerchProduct(slug)
  if (!product) return { title: 'Merch' }
  return {
    title: product.name,
    description: product.description || `${product.name} — Jville Brew Loop merch.`,
    alternates: { canonical: `/merch/${product.slug}` },
    openGraph: { title: `${product.name} · Brew Loop Merch`, description: product.description || '', url: `/merch/${product.slug}` },
  }
}

export default async function ProductPage({ params }) {
  const { slug } = await params
  const product = await getMerchProduct(slug)
  if (!product) notFound()

  return (
    <main className="site-main">
      <div style={{ maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) 16px clamp(48px, 7vw, 76px)' }}>
        <Link href="/merch" style={{ color: GOLD, fontSize: 13.5, fontWeight: 700, textDecoration: 'none', display: 'inline-block', marginBottom: 18 }}>
          &larr; All merch
        </Link>
        <div style={{ display: 'grid', gap: 'clamp(20px, 4vw, 44px)', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'start' }}>
          {/* Gallery */}
          <MerchGallery images={product.images} name={product.name} />
          {/* Detail + add to cart */}
          <div>
            <h1 style={{ color: INK, fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 800, letterSpacing: '-0.015em', margin: 0 }}>{product.name}</h1>
            <div style={{ color: GOLD, fontSize: 22, fontWeight: 800, marginTop: 10 }}>
              {product.variants?.length ? 'From ' : ''}{fmtPrice(product.variants?.length ? Math.min(...product.variants.map(v => v.priceCents)) : product.priceCents)}
            </div>
            {product.description && (
              <p style={{ color: INK_DIM, fontSize: 15.5, lineHeight: 1.6, margin: '16px 0 0' }}>{product.description}</p>
            )}
            <AddToCart product={product} />
            <p style={{ color: INK_DIM, fontSize: 13, lineHeight: 1.5, margin: '20px 0 0' }}>
              Ships in the US, or choose &ldquo;grab it on the shuttle&rdquo; at checkout to skip shipping.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
