/** @type {import('next').NextConfig} */

// Security headers.
//
// The old config had exactly one rule: the permissive /widget/* exception
// below, with a comment claiming "other routes inherit the default
// deny-by-omission posture." They don't — Next sets no X-Frame-Options and no
// CSP by default, and middleware.js sets none either. So /admin,
// /admin/security, /leadership and every boarding pass were framable by any
// site on the internet, and claim/feedback tokens in the URL leaked to every
// third-party origin those pages link out to via the Referer header.
//
// Verified against this codebase before writing the CSP, not assumed:
//   - Stripe is redirect-only. @stripe/stripe-js is in package.json but is
//     imported nowhere; checkout is a server-created Session and a top-level
//     navigation to session.url, which CSP does not govern. No js.stripe.com
//     entry is needed. Add one to script-src/frame-src if embedded Checkout is
//     ever adopted.
//   - Leaflet is bundled from npm, not a CDN. Map tiles are <img> requests to
//     *.tile.openstreetmap.org, covered by img-src https:.
//   - Google Fonts IS required: app/globals.css:1 @imports Orbitron and
//     JetBrains Mono. Dropping the style-src/font-src entries silently kills
//     the branding.
//   - No Supabase realtime anywhere (no .channel(, no postgres_changes), so no
//     wss: entry. Add one if realtime is introduced.
//   - Web push goes through the browser's push service, not fetch. The service
//     worker is same-origin, covered by worker-src 'self'.
//
// script-src keeps 'unsafe-inline': Next's App Router emits inline bootstrap
// and RSC flight scripts on every page, and there is no nonce pipeline here.
// Dropping it renders a blank site. What the policy still buys, all of it free:
// no third-party script origins, no <object>/<embed>, no <base> hijack, no
// off-origin form posts, and a real frame-ancestors deny.
const SUPABASE_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin } catch { return '' }
})()

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Deliberately broad. Event cover_image_url is a free-text URL typed by an
  // admin and rendered on the public booking page, and QR PNGs come from
  // qrcode.ai. Images are not a script vector; locking this breaks real content.
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${SUPABASE_ORIGIN}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
]

const fullCsp = (frameAncestors) =>
  [...CSP_DIRECTIVES, `frame-ancestors ${frameAncestors}`].join('; ')

// Enforced immediately. These carry no breakage risk for this app.
const BASELINE = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(), usb=()' },
  // No `preload`. Confirm every *.jvillebrewloop.com host is HTTPS-only before
  // adding it — preload is effectively irreversible.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig = {
  async headers() {
    return [
      // Everything except the widget. The negative lookahead keeps the two
      // rules mutually exclusive, so neither can override the other's CSP
      // rather than relying on Next's duplicate-key merge semantics.
      //
      // frame-ancestors ships ENFORCED because it is the actual clickjacking
      // fix and cannot break a same-origin app. The rest of the policy ships
      // Report-Only so Jacob can watch the console on /book, /track (Leaflet),
      // /tickets/<code> and the Stripe redirect for one deploy, then promote
      // it by moving CSP_DIRECTIVES into the enforced header. A CSP that
      // breaks checkout is worse than no CSP.
      {
        source: '/((?!widget/).*)',
        headers: [
          ...BASELINE,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Content-Security-Policy-Report-Only', value: fullCsp("'self'") },
        ],
      },
      // The widget is embedded on partner bar sites — that is the whole point.
      // It renders a read-only list of upcoming loops whose only control is a
      // target="_blank" link to /book, holds no session and exposes no
      // state-changing action, so there is nothing to clickjack. Keep the
      // baseline hardening and relax only the framing directives.
      //
      // X-Frame-Options: ALLOWALL was dropped: it is not a valid value, every
      // browser ignores it, and frame-ancestors is what actually does the work.
      {
        source: '/widget/:path*',
        headers: [
          ...BASELINE,
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'Content-Security-Policy-Report-Only', value: fullCsp('*') },
        ],
      },
    ]
  },
};

export default nextConfig;
