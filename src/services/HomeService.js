import Announcement from '../models/Announcement.js';
import Promo from '../models/Promo.js';
import HomeLandingImage from '../models/HomeLandingImage.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Bundle from '../models/Bundle.js';
import CmsContent from '../models/CmsContent.js';
import Order from '../models/Order.js';
import { liveBannerFilter, presentBanner, groupByPlacement } from '../utils/banners.js';
import { bundleView } from './CommerceService.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta } from '../utils/pagination.js';
import { serialize, serializeMany } from '../utils/serialize.js';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache.js';

const HOME_CACHE_KEY = 'home:public';
const BANNERS_CACHE_KEY = 'banners:public';
const HOME_CACHE_TTL = 120;

const PRODUCT_CARD_FIELDS =
  'slug name price mrp image images tagline rating reviewCount isVeg isNew isFeatured homePosition category status stock weight';

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
    weight: s.weight || '',
    stock: s.stock ?? 0,
    isFeatured: Boolean(s.isFeatured),
    discountPercent: s.mrp > s.price ? Math.round(((s.mrp - s.price) / s.mrp) * 100) : 0,
  };
}

class HomeService {
  /**
   * Best sellers from REAL sales only (non-cancelled orders, last 180 days),
   * counting bundle components too. Empty when there are no sales.
   */
  async #bestSellers(limit = 8) {
    const since = new Date(Date.now() - 180 * 86400_000);
    const rows = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' }, createdAt: { $gte: since } } },
      { $unwind: '$items' },
      {
        $project: {
          pairs: {
            $cond: [
              { $eq: ['$items.kind', 'bundle'] },
              {
                $map: {
                  input: { $ifNull: ['$items.components', []] },
                  as: 'c',
                  in: { product: '$c.product', qty: { $multiply: ['$c.quantity', '$items.quantity'] } },
                },
              },
              [{ product: '$items.product', qty: '$items.quantity' }],
            ],
          },
        },
      },
      { $unwind: '$pairs' },
      { $match: { 'pairs.product': { $ne: null } } },
      { $group: { _id: '$pairs.product', sold: { $sum: '$pairs.qty' } } },
      { $sort: { sold: -1 } },
      { $limit: limit * 2 },
    ]);
    if (!rows.length) return [];
    const products = await Product.find({ _id: { $in: rows.map((r) => r._id) }, status: 'Active' })
      .select(PRODUCT_CARD_FIELDS)
      .lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));
    return rows
      .map((r) => byId.get(String(r._id)))
      .filter(Boolean)
      .slice(0, limit)
      .map(leanProductCard);
  }

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
      Promo.find(liveBannerFilter()).sort({ position: 1, createdAt: -1 }).lean(),
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

    const [featuredRaw, newArrivalsRaw, bestSellers] = await Promise.all([
      Product.find({ status: 'Active', isFeatured: true })
        .select(PRODUCT_CARD_FIELDS)
        .sort({ homePosition: 1, createdAt: -1 })
        .limit(8)
        .lean(),
      Product.find({ status: 'Active' }).select(PRODUCT_CARD_FIELDS).sort({ createdAt: -1 }).limit(8).lean(),
      this.#bestSellers(),
    ]);

    // No product flagged "Popular" in admin yet → show the newest active products
    // (real catalogue data) instead of an empty section.
    const popularList = popularProducts.length
      ? popularProducts
      : await Product.find({ status: 'Active' })
          .select(PRODUCT_CARD_FIELDS)
          .sort({ homePosition: 1, createdAt: -1 })
          .limit(8)
          .lean();

    const productIdSet = new Set();
    for (const b of bundlesRaw) {
      for (const pid of b.productIds || []) productIdSet.add(String(pid));
    }
    const bundleProducts = productIdSet.size
      ? await Product.find({ _id: { $in: [...productIdSet] } })
          .select(PRODUCT_CARD_FIELDS)
          .lean()
      : [];
    const rawById = new Map(bundleProducts.map((p) => [String(p._id), p]));
    const productMap = new Map(bundleProducts.map((p) => [String(p._id), leanProductCard(p)]));

    // Only purchasable packs (active bundle + all products active); price is the bundle price.
    const bundles = bundlesRaw
      .map((b) => ({ b, view: bundleView(b, rawById) }))
      .filter(({ view }) => view.purchasable)
      .map(({ b, view }) => {
        const s = serialize(b);
        return {
          id: s.id,
          kind: 'bundle',
          name: s.name,
          tagline: s.tagline || '',
          price: s.price,
          mrp: s.mrp,
          image: view.image,
          stock: view.stock,
          position: s.position ?? 0,
          items: (b.productIds || []).map((pid) => productMap.get(String(pid))).filter(Boolean),
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
      // Banners: Active + within schedule window, grouped by website placement
      promos: promos.map(presentBanner),
      banners: groupByPlacement(promos.map(presentBanner)),
      featuredProducts: featuredRaw.map(leanProductCard),
      newArrivals: newArrivalsRaw.map(leanProductCard),
      bestSellers,
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
      popularProducts: popularList.map(leanProductCard),
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
    // Admin view: computed availability + purchasable flag (from live product stock/status)
    const pids = [...new Set(items.flatMap((b) => (b.productIds || []).map(String)))];
    const prods = pids.length ? await Product.find({ _id: { $in: pids } }).select('name status stock image').lean() : [];
    const byId = new Map(prods.map((p) => [String(p._id), p]));
    const data = items.map((b) => {
      const view = bundleView(b, byId);
      return { ...serialize(b), availability: view.stock, purchasable: view.purchasable };
    });
    return { data, meta: buildMeta({ page, limit, total }) };
  }

  async #assertPricing(body, existing = {}) {
    const price = body.price ?? existing.price;
    const mrp = body.mrp ?? existing.mrp;
    if (price != null && mrp != null && Number(price) > Number(mrp)) {
      throw ApiError.badRequest('Bundle price cannot be higher than MRP');
    }
  }

  async createBundle(body) {
    await this.#assertPricing(body);
    const doc = await Bundle.create(body);
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updateBundle(id, body) {
    const existing = await Bundle.findById(id).select('price mrp').lean();
    if (!existing) throw ApiError.notFound('Bundle not found');
    await this.#assertPricing(body, existing);
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
