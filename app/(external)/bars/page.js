import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Track the Loop',
  alternates: { canonical: '/track' },
}

export default function BarsIndex() {
  redirect('/track')
}
