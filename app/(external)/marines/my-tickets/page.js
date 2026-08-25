import { prefixLink } from '@/lib/businessConfig'
import MyTicketsBody from '../../_components/MyTicketsBody'

export const metadata = {
  title: 'My Loop Tickets & Messages',
  description: 'Pull up your Loop tickets, waiver, and message security.',
  robots: { index: false, follow: false },
  alternates: { canonical: prefixLink('/my-tickets', 'marines') },
}

export default function MarinesMyTicketsPage() {
  return <MyTicketsBody business="marines" />
}
