import LookupClient from './LookupClient'

export const metadata = {
  title: 'Find My QR — Brew Loop Sales Contest',
  description: 'Already signed up? Pull up your QR + code by entering the phone or email you registered with.',
}

export default function BartenderQrPage() {
  return <LookupClient />
}
