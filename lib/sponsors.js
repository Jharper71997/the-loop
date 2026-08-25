// Current Jville Brew Loop sponsors, mirrored from the live site. Logos are
// self-hosted in public/brand/sponsors/ (not hotlinked from Squarespace). `url`
// is each sponsor's best outbound link (website, else booking/social). `blurb`
// is a one-line description pulled from each sponsor's own copy; `tag` is a short
// category shown as a chip on the featured sponsor cards.
//
// THIS LIST GOES STALE AND NOTHING CATCHES IT. It is a hand-kept mirror taken
// off Squarespace in July 2026; the `sponsors` table that actually tracks who
// is paying (tier, amount, status — see /leadership/sponsors) has no logo or
// URL column, so the two can't be joined and the public wall keeps showing
// whoever was here last time somebody edited this file.
//
// The poker sponsor was removed 2026-08-25 because Jacob spotted it on the
// site after they had left — and the entry was ALSO wrong on its own terms:
// it was named "No Limit Pub Poker" while the logo art in it read "SADDLE UP
// POKER". Check names against /leadership/sponsors before a deploy, and if a
// sponsor is dropped, delete the row here AND its file in
// public/brand/sponsors/.
export const SPONSORS = [
  { name: 'Mabuhay Designs & Co', tag: 'Printing & design', logo: '/brand/sponsors/mabuhay.jpg', url: 'http://www.mabuhay.store', blurb: 'Veteran-owned custom printing and design shop in Jacksonville.' },
  { name: 'Cozy Co. Luxe', tag: 'Candles & fragrance', logo: '/brand/sponsors/cozy-co-luxe.jpg', url: 'https://brand.page/cozycoluxeexperiences', blurb: 'Veteran and active-duty-owned candle and fragrance shop downtown. Common scents isn’t so common.' },
  { name: 'The Dragon’s Brew Cafe', tag: 'Coffee & kava', logo: '/brand/sponsors/dragons-brew.jpg', url: 'https://www.thedragonsbrewcafe.com/', blurb: 'Specialty coffee and kava bar, handcrafted espresso and 70+ flavors.' },
  { name: 'Joyas Detailing Services', tag: 'Auto detailing', logo: '/brand/sponsors/joyas-detailing.jpg', url: 'https://www.instagram.com/joyasdetailingservicesllc/', blurb: 'Veteran-owned auto detailing, restoration, and customization. Precision isn’t optional, it’s standard.' },
  { name: 'Good Times Tattoo Co.', tag: 'Tattoo studio', logo: '/brand/sponsors/good-times-tattoo.jpg', url: 'https://www.goodtimestattoonc.com/', blurb: 'Custom tattoo shop, voted 2024 Best of the Best.' },
  { name: 'Estetica Med Spa', tag: 'Med spa', logo: '/brand/sponsors/estetica.png', url: 'https://conciergeaestheticnc.com/', blurb: 'Jacksonville’s destination for advanced aesthetics and wellness.' },
  { name: 'Pop Smoke Cigars', tag: 'Cigar shop', logo: '/brand/sponsors/pop-smoke.png', url: 'https://popsmokecigars.com/', blurb: 'The only on-base cigar shop serving MCAS New River and Camp Lejeune.' },
  { name: 'Mario & Company Barber Studio', tag: 'Barber studio', logo: '/brand/sponsors/mario-company.png', url: 'https://getsquire.com/booking/book/mario-and-company-barber-studio-jacksonville', blurb: 'Precision cuts and fades. There’s fresh, then there’s Mario & Company fresh.' },
  { name: 'Crush Nutrition', tag: 'Teas & shakes', logo: '/brand/sponsors/crush-nutrition.png', url: 'https://www.facebook.com/crushnutrition.nc', blurb: 'Loaded teas and protein shakes. Great energy, great drinks, great people.' },
  { name: 'Dream Entertainment', tag: 'Events & DJ', logo: '/brand/sponsors/dream-entertainment.png', url: 'https://www.dreamentertainmentnc.com/', blurb: 'Full-service event and entertainment company, 16+ years running the party.' },
  { name: 'El Cerro Tacos', tag: 'Mexican food', logo: '/brand/sponsors/el-cerro-tacos.jpg', url: 'https://www.elcerrotacos.com/', blurb: 'Authentic Mexican in Jacksonville and Swansboro. Every bite closer to the streets of Mexico.' },
]
