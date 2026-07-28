import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// RETIRED with the old fare flow. Purchases now land on the shared booking
// success page; send anyone hitting this old URL to their tickets.
export default function MarinesRideSuccessRedirect() {
  redirect('/marines/my-tickets')
}
