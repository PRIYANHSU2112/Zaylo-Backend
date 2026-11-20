/** Banner placements (Promo.slot). Legacy values stay valid and are mapped. */
export const BANNER_PLACEMENTS = ['hero', 'home-middle', 'home-bottom', 'products', 'about', 'dealer'];
export const LEGACY_SLOTS = ['general', 'home-festival', 'home-dealer'];
const LEGACY_MAP = { general: 'hero', 'home-festival': 'home-middle', 'home-dealer': 'home-bottom' };

export const placementOf = (slot) => LEGACY_MAP[slot] || slot || 'hero';

/** Mongo filter: Active and inside the optional schedule window. */
export function liveBannerFilter(now = new Date()) {
  return {
    status: 'Active',
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };
}

/** Public banner shape used by /home and /banners. */
export function presentBanner(p) {
  return {
    id: String(p._id || p.id),
    placement: placementOf(p.slot),
    slot: p.slot || 'general',
    title: p.title || '',
    subtitle: p.subtitle || '',
    cta: p.cta || '',
    link: p.link || '/products',
    badge: p.badge || '',
    variant: p.variant || 'default',
    gradient: p.gradient || '',
    imageUrl: p.imageUrl || '',
    mobileImageUrl: p.mobileImageUrl || '',
    bgImageUrl: p.bgImageUrl || '',
    position: p.position ?? 0,
  };
}

export function groupByPlacement(banners) {
  const out = Object.fromEntries(BANNER_PLACEMENTS.map((k) => [k, []]));
  for (const b of banners) (out[b.placement] ||= []).push(b);
  return out;
}
