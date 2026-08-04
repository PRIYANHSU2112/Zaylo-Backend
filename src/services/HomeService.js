import Announcement from '../models/Announcement.js';
import Promo from '../models/Promo.js';
import HomeLandingImage from '../models/HomeLandingImage.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Bundle from '../models/Bundle.js';
import CmsContent from '../models/CmsContent.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta } from '../utils/pagination.js';
import { serialize, serializeMany } from '../utils/serialize.js';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache.js';

const HOME_CACHE_KEY = 'home:public';
const BANNERS_CACHE_KEY = 'banners:public';
const HOME_CACHE_TTL = 120;

const PRODUCT_CARD_FIELDS =
  'slug name price mrp image tagline rating reviewCount isVeg isNew homePosition category status';

function invalidateHomeCaches() {
  cacheDel(HOME_CACHE_KEY);
  cacheDel(BANNERS_CACHE_KEY);
}

function leanProductCard(doc) {
  if (!doc) return null;
  const s = serialize(doc);
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    price: s.price,
    mrp: s.mrp,
    image: s.image || '',
    tagline: s.tagline || '',
    rating: s.rating,
    reviewCount: s.reviewCount,
    isVeg: s.isVeg,
    isNew: s.isNew,
    position: s.homePosition ?? 0,
    category: s.category,
  };
}

class HomeService {
  async getHomePage() {
    const cached = cacheGet(HOME_CACHE_KEY);
    if (cached) return cached;

    const [
      announcements,
      promos,
      landingImages,
      categories,
      popularProducts,
      bundlesRaw,
      cms,
    ] = await Promise.all([
      Announcement.find({ status: 'Active' }).sort({ position: 1, createdAt: -1 }).lean(),
      Promo.find({ status: 'Active' }).sort({ position: 1, createdAt: -1 }).lean(),
      HomeLandingImage.find({ status: 'Active' }).sort({ position: 1, createdAt: -1 }).lean(),
      Category.find({ status: 'Active' })
        .sort({ homePosition: 1, name: 1 })
        .limit(12)
        .lean(),
      Product.find({ status: 'Active', isPopular: true })
        .select(PRODUCT_CARD_FIELDS)
        .sort({ homePosition: 1, createdAt: -1 })
        .limit(8)
        .lean(),
      Bundle.find({ status: 'Active' })
        .sort({ position: 1, createdAt: -1 })
        .limit(12)
        .lean(),
      CmsContent.findOne({ key: 'home' }).lean(),
    ]);

    const productIdSet = new Set();
    for (const b of bundlesRaw) {
      for (const pid of b.productIds || []) productIdSet.add(String(pid));
    }
    const bundleProducts = productIdSet.size
      ? await Product.find({ _id: { $in: [...productIdSet] }, status: 'Active' })
          .select(PRODUCT_CARD_FIELDS)
          .lean()
      : [];
    const productMap = new Map(bundleProducts.map((p) => [String(p._id), leanProductCard(p)]));

    const bundles = bundlesRaw.map((b) => {
      const s = serialize(b);
      return {
        id: s.id,
        name: s.name,
        tagline: s.tagline || '',
        price: s.price,
        mrp: s.mrp,
        position: s.position ?? 0,
        items: (b.productIds || [])
          .map((pid) => productMap.get(String(pid)))
          .filter(Boolean),
      };
    });

    const testimonials = [...(cms?.testimonials || [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .slice(0, 12)
      .map((t, i) => ({
        id: t._id?.toString?.() || `t${i}`,
        name: t.name || '',
        role: t.role || '',
        rating: t.rating ?? 5,
        text: t.text || '',
        avatar: t.avatar || '',
        position: t.position ?? i,
      }));

    const data = {
      announcements: serializeMany(announcements).map((a) => ({
        id: a.id,
        text: a.text,
        link: a.link || '/products',
        position: a.position ?? 0,
      })),
      promos: serializeMany(promos).map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle || '',
        cta: p.cta || 'Shop Now',
        link: p.link || '/products',
        gradient: p.gradient || '',
        badge: p.badge || '',
        variant: p.variant || 'default',
        imageUrl: p.imageUrl || '',
        bgImageUrl: p.bgImageUrl || '',
        slot: p.slot || 'general',
        position: p.position ?? 0,
      })),
      landingImages: serializeMany(landingImages).map((img) => ({
        id: img.id,
        slot: img.slot,
        url: img.url,
        alt: img.alt || '',
        link: img.link || '/products',
        position: img.position ?? 0,
      })),
      categories: serializeMany(categories).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image: c.image || '',
        color: c.color || '',
        position: c.homePosition ?? 0,
      })),
      popularProducts: popularProducts.map(leanProductCard),
      bundles,
      testimonials,
    };

    cacheSet(HOME_CACHE_KEY, data, HOME_CACHE_TTL);
    return data;
  }

  // --- Landing images admin ---
  async listLandingImages(query) {
    const { page, limit, skip, sort } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.slot) filter.slot = query.slot;
    const [items, total] = await Promise.all([
      HomeLandingImage.find(filter).sort({ position: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      HomeLandingImage.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createLandingImage(body) {
    const doc = await HomeLandingImage.create(body);
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updateLandingImage(id, body) {
    const doc = await HomeLandingImage.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean();
    if (!doc) throw ApiError.notFound('Landing image not found');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async deleteLandingImage(id) {
    const doc = await HomeLandingImage.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Landing image not found');
    invalidateHomeCaches();
    return { id };
  }

  // --- Bundles admin ---
  async listBundles(query) {
    const { page, limit, skip } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      Bundle.find(filter).sort({ position: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Bundle.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createBundle(body) {
    const doc = await Bundle.create(body);
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updateBundle(id, body) {
    const doc = await Bundle.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean();
    if (!doc) throw ApiError.notFound('Bundle not found');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async deleteBundle(id) {
    const doc = await Bundle.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Bundle not found');
    invalidateHomeCaches();
    return { id };
  }
}

export { invalidateHomeCaches, HOME_CACHE_KEY, BANNERS_CACHE_KEY };
export default new HomeService();
