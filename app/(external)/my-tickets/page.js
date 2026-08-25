import MyTicketsBody from '../_components/MyTicketsBody'

export const metadata = {
  title: 'My Tickets & Messages',
  description: 'Pull up your Brew Loop tickets, waiver, and message security.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/my-tickets' },
}

export default function MyTicketsPage() {
  return <MyTicketsBody business="brew" />
}
