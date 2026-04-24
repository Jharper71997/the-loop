import { redirect } from 'next/navigation'

// /book is the old events list (pre-external-rebuild). /events is the new
// polished discovery page — send visitors there. Individual booking URLs
// /book/[eventId] are unaffected.
export default function BookRedirect() {
  redirect('/events')
}
