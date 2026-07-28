// The Loop (Marines) overrides the shared (external) PWA identity so browser
// tabs read "· The Loop" instead of "· Brew Loop", and saving to the home
// screen installs "The Loop" pointing at /marines (not a Brew Loop icon). The
// black+gold app icons are shared — Marines uses the same palette as Brew.
//
// Only identity fields are set here; each page still declares its own title +
// canonical, so don't put `alternates` on the layout (it would force every
// /marines page to canonicalize to /marines).
export const metadata = {
  title: { default: 'The Loop', template: '%s · The Loop' },
  description: "The Loop — a daytime shuttle for Marines at Camp Lejeune. Ride to sponsor spots and restaurants around town. Grab a ride, sign your waiver, show your QR when you board.",
  manifest: '/marines-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'The Loop',
  },
}

export default function MarinesLayout({ children }) {
  return children
}
