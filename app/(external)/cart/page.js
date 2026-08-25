import CartBody from './CartBody'

export const metadata = {
  title: 'Cart',
  description: 'Your Brew Loop merch cart.',
  alternates: { canonical: '/cart' },
  robots: { index: false },
}

export default function CartPage() {
  return <CartBody />
}
