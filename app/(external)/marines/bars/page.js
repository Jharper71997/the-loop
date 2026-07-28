import { redirect } from 'next/navigation'

export const metadata = {
  title: 'The Loop — stops',
  alternates: { canonical: '/marines/track' },
}

export default function MarinesBarsIndex() {
  redirect('/marines/track')
}
