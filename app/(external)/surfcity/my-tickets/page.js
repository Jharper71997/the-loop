import MyTicketsBody from '../../_components/MyTicketsBody'

export const metadata = {
  title: 'My Surf City Tickets & Messages',
  description: 'Pull up your Surf City Loop tickets, waiver, and message security.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/surfcity/my-tickets' },
}

export default function SurfMyTicketsPage() {
  return <MyTicketsBody business="surf" />
}
