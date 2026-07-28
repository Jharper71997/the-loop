import { supabaseAdmin } from './supabaseAdmin'

// Server-side merch catalog reads. The storefront + checkout use the service key
// (merch tables are RLS deny-all to anon). Kept fully separate from ride orders.

// Local-dev / pre-migration fallback catalog. Used ONLY when the merch_products
// table doesn't exist yet (the query errors), so the storefront looks built on
// localhost before sql/046_merch.sql is applied. Once the migration runs, the
// real seeded rows take over. Mirrors the seed in sql/046_merch.sql; ids equal
// slugs so cart keys stay stable. NOTE: real checkout persistence still needs
// the migration — these fallback ids aren't in the DB.
const FALLBACK_PRODUCTS = [
  {
    id: 'brew-loop-hoodie', slug: 'brew-loop-hoodie', name: 'Jville Brew Loop Hoodie',
    description: 'Heavyweight black hoodie with the gold Brew Loop badge on the chest. Your go-to layer for a night on the Loop.',
    priceCents: 5500, image: '/brand/merch/hoodie-1.png',
    images: ['/brand/merch/hoodie-1.png', '/brand/merch/hoodie-2.png', '/brand/merch/hoodie-3.png', '/brand/merch/hoodie-4.png'],
    variants: ['S', 'M', 'L', 'XL', '2XL'].map((n, i) => ({ id: `brew-loop-hoodie-${n}`, name: n, priceCents: 5500, sort: i })),
  },
  {
    id: 'brew-loop-tee', slug: 'brew-loop-tee', name: 'Jville Brew Loop T-Shirt',
    description: 'Soft black tee with the gold Brew Loop badge. Light enough to wear bar to bar all night.',
    priceCents: 3500, image: '/brand/merch/tshirt-1.png',
    images: ['/brand/merch/tshirt-1.png', '/brand/merch/tshirt-2.png', '/brand/merch/tshirt-3.png', '/brand/merch/tshirt-4.png', '/brand/merch/tshirt-5.png'],
    variants: ['S', 'M', 'L', 'XL', '2XL'].map((n, i) => ({ id: `brew-loop-tee-${n}`, name: n, priceCents: 3500, sort: i })),
  },
  {
    id: 'brew-loop-patch', slug: 'brew-loop-patch', name: 'Jville Brew Loop Patches',
    description: 'Embroidered gold-on-black Brew Loop patch with the full badge. Stick it on a jacket, hat, or bag.',
    priceCents: 1000, image: '/brand/merch/patches.png', images: ['/brand/merch/patches.png'], variants: [],
  },
]

// All active products (with their active variants), for the /merch grid.
export async function getMerchProducts() {
  let sb
  try { sb = supabaseAdmin() } catch (err) {
    console.error('[merch] supabaseAdmin init failed', err)
    return []
  }
  const { data, error } = await sb
    .from('merch_products')
    .select('id, slug, name, description, price_cents, image_url, image_urls, sort_order, active, merch_variants(id, name, price_cents, active, sort_order)')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    // Table not created yet (pre-migration) — show the fallback so /merch looks
    // built locally. A real (migrated) DB that's simply empty returns [] here.
    console.warn('[merch] products query failed; using fallback catalog', error?.message)
    return FALLBACK_PRODUCTS
  }
  return (data || []).map(normalizeProduct)
}

// One product by slug, for /merch/[slug].
export async function getMerchProduct(slug) {
  let sb
  try { sb = supabaseAdmin() } catch { return null }
  const { data, error } = await sb
    .from('merch_products')
    .select('id, slug, name, description, price_cents, image_url, image_urls, active, merch_variants(id, name, price_cents, active, sort_order)')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle()
  if (error) {
    // Pre-migration: serve the matching fallback product so the detail page works.
    return FALLBACK_PRODUCTS.find(p => p.slug === slug) || null
  }
  if (!data) return null
  return normalizeProduct(data)
}

function normalizeProduct(p) {
  const variants = (p.merch_variants || [])
    .filter(v => v.active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(v => ({
      id: v.id,
      name: v.name,
      // null variant price inherits the product price.
      priceCents: v.price_cents ?? p.price_cents,
    }))
  // Gallery: prefer the image_urls array; fall back to the single image_url.
  const images = (Array.isArray(p.image_urls) && p.image_urls.length)
    ? p.image_urls.filter(Boolean)
    : (p.image_url ? [p.image_url] : [])
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description || '',
    priceCents: p.price_cents,
    image: p.image_url || images[0] || null,
    images,
    variants,
  }
}
