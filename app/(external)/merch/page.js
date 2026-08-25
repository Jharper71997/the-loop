import { getMerchProducts } from '@/lib/merch'
import MerchBody from '../_components/merch/MerchBody'
import { OG_IMAGES } from '@/lib/socialMeta'

export const metadata = {
  title: 'Merch',
  description: 'Black-and-gold Jville Brew Loop gear: hoodies, tees, and patches. Ships to your door, or grab it on the shuttle.',
  alternates: { canonical: '/merch' },
  openGraph: {
    images: OG_IMAGES,
    title: 'Brew Loop Merch',
    description: 'Wear the gold badge. Black-and-gold Brew Loop gear.',
    url: '/merch',
  },
}
export const dynamic = 'force-dynamic'

export default async function MerchPage() {
  const products = await getMerchProducts()
  return <MerchBody products={products} />
}
