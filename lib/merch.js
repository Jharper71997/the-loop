import { supabaseAdmin } from './supabaseAdmin'

// Server-side merch catalog reads. The storefront + checkout use the service key
// (merch tables are RLS deny-all to anon). Kept fully separate from ride orders.

// NO fallback catalog on purpose. There used to be a hardcoded one that rendered
// whenever the merch_products query failed (e.g. before sql/046_merch.sql was
// applied), which meant /merch showed three buyable-looking products whose ids
// don't exist in the DB — add to cart worked, checkout 400'd. An empty list is
// honest: MerchBody renders "Merch is dropping soon" instead. Real products
// appear the moment the migration + seed are in.

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
    // Table missing or unreachable — show nothing rather than an unbuyable
    // catalog. /merch degrades to "dropping soon".
    console.warn('[merch] products query failed; storefront will show empty', error?.message)
    return []
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
  if (error) return null
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
