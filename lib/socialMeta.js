// The picture that shows up when someone shares a Brew Loop link.
//
// Every Brew page already had `openGraph` and `twitter` blocks, and not one of
// them named an image — so a link pasted into Facebook, Instagram DMs, iMessage
// or a group text rendered as a bare grey text card. For a business whose
// entire marketing is people sending each other "we're doing this Friday", that
// is the most-seen surface on the site.
//
// WHY THIS HAS TO BE SPREAD INTO EVERY PAGE rather than set once in the root
// layout: Next merges metadata SHALLOWLY. A page that declares its own
// `openGraph` replaces the parent's object outright — it does not inherit
// `images` from it. So the root default only covers pages that declare no
// openGraph at all, and any page with its own block needs these spread in
// explicitly. Miss one and that page silently goes back to a grey card.
//
// The file is public/brand/og/brew-loop.jpg, 1200x630 (the size Facebook and
// iMessage both want). Rebuild it by rendering a 1200x630 card and saving over
// that path; the deliberate choice in it is that the shuttle is a real
// photograph of the real bus and the only claims on it — $20, Friday +
// Saturday, Jacksonville — are ones that don't go stale. There is no bar count
// on it on purpose: a number baked into a JPEG can't be derived from the
// database and would be wrong the first weekend a bar joins.

export const OG_IMAGE = {
  url: '/brand/og/brew-loop.jpg',
  width: 1200,
  height: 630,
  alt: 'The Jville Brew Loop shuttle, with the words: hit every bar, never touch your keys. $20 a seat, Friday and Saturday, Jacksonville NC.',
}

// Spread as `images: OG_IMAGES` in both openGraph and twitter.
export const OG_IMAGES = [OG_IMAGE]
