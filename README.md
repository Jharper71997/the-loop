# the-loop

One Next.js app, one Supabase database, three shuttle businesses:

| Business | `kind` | Rider surface | Staff console |
|---|---|---|---|
| Jville Brew Loop | `brew` | `/` | `/admin` |
| Surf City Loop | `surf` | `/surfcity` | `/surf` |
| The Loop (Marines) | `marines` | `/marines` | `/loop` |

Business-specific behavior belongs in `lib/businessConfig.js` (`brandFor(kind)`),
not in scattered `kind === 'marines' ? … : …` ternaries.

## Getting Started

```bash
npm run dev          # http://localhost:3000
```

Env comes from `.env.local`.

## Two deployments

The same repo is deployed as two Vercel projects against the same database.
`NEXT_PUBLIC_SITE` decides which one a build is (see `lib/site.js`):

- **unset / `brew`** — the combined host. Serves all three businesses at the
  prefixes above. This is the Brew production site.
- **`marines`** — the standalone **The Loop** site on its own domain. The rider
  surface moves to the root and the console to `/admin`:

  ```
  /            ->  /marines           (rider home)
  /events      ->  /marines/events
  /book/[id]   ->  /marines/book/[id]
  /track       ->  /marines/track
  /admin/...   ->  /loop/...          (staff console)
  ```

  The page files do not move. `middleware.js` maps the public URL onto the
  existing trees, 308s the prefixed spellings to the root ones so old QR codes
  keep working, and hides every Brew/Surf surface (`/surfcity`, `/merch`,
  `/sponsors`, `/pass`, …). The Loop must carry no bar or alcohol association —
  its riders are largely under 21.

To run the Loop site locally:

```bash
NEXT_PUBLIC_SITE=marines npx next dev -p 3210
```

### Adding a second Vercel project

Import the same GitHub repo again, then set on the new project:

- `NEXT_PUBLIC_SITE=marines`
- `APP_URL` = that project's own domain (drives ticket links, SMS/email links,
  Stripe redirects, canonicals and the sitemap)
- every other var copied from the Brew project (Supabase, Stripe, Resend,
  SimpleTexting, VAPID, `SUPABASE_SERVICE_KEY`, role email lists)

`vercel.json` is shared, so both projects register the same cron schedules.
`lib/cronAuth.js` no-ops the jobs on any deployment where `NEXT_PUBLIC_SITE`
is not `brew`, so they run exactly once against the shared database.

## Notes

- Rider links go through `prefixLink(path, kind)` so they render correctly on
  both deployments. Never hardcode `/marines/...`.
- Staff console links go through `adminBase(business)` for the same reason.
- Weekend seeding scripts live in `scripts/` (`build-this-weekend.js`,
  `build-marines-weekend.js`); SQL migrations in `sql/`, applied by hand in
  Supabase.
