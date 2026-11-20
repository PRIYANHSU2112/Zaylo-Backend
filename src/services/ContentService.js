import config from '../config/index.js';
import { liveBannerFilter, presentBanner } from '../utils/banners.js';
import { withCommerceDefaults } from './CommerceService.js';
import Blog from '../models/Blog.js';
import Gallery from '../models/Gallery.js';
import Announcement from '../models/Announcement.js';
import Promo from '../models/Promo.js';
import Settings from '../models/Settings.js';
import CmsContent from '../models/CmsContent.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { serialize, serializeMany } from '../utils/serialize.js';
import { cacheGet, cacheSet, cacheDel } from '../utils/cache.js';
import { invalidateHomeCaches } from './HomeService.js';

class ContentService {
  async listPublicBlogs(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = { status: 'Published' };
    if (query.category) filter.category = query.category;
    if (q) filter.title = new RegExp(escapeRegex(q), 'i');
    const [items, total] = await Promise.all([
      Blog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Blog.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async listAdminBlogs(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (q) {
      filter.$or = [
        { title: new RegExp(escapeRegex(q), 'i') },
        { excerpt: new RegExp(escapeRegex(q), 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      Blog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Blog.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createBlog(body) {
    return serialize(await Blog.create(body));
  }

  async updateBlog(id, body) {
    const doc = await Blog.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean();
    if (!doc) throw ApiError.notFound('Blog not found');
    return serialize(doc);
  }

  async deleteBlog(id) {
    const doc = await Blog.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Blog not found');
    return { id };
  }

  async listGallery(query, { publicOnly = false } = {}) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.category) filter.category = query.category;
    if (q) filter.title = new RegExp(escapeRegex(q), 'i');
    void publicOnly;
    const [items, total] = await Promise.all([
      Gallery.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Gallery.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createGallery(body) {
    return serialize(await Gallery.create(body));
  }

  async updateGallery(id, body) {
    const doc = await Gallery.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!doc) throw ApiError.notFound('Gallery item not found');
    return serialize(doc);
  }

  async deleteGallery(id) {
    const doc = await Gallery.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Gallery item not found');
    return { id };
  }

  /** Public banners: Active + inside schedule window; optional ?placement= filter. */
  async getBanners(placement) {
    const [announcements, promos] = await Promise.all([
      Announcement.find({ status: 'Active' }).sort({ position: 1, createdAt: -1 }).lean(),
      Promo.find(liveBannerFilter()).sort({ position: 1, createdAt: -1 }).lean(),
    ]);
    let banners = promos.map(presentBanner);
    if (placement) banners = banners.filter((b) => b.placement === placement);
    return {
      announcements: serializeMany(announcements),
      banners,
      promos: banners, // legacy key
    };
  }

  async listAnnouncements(query) {
    const { page, limit, skip, sort } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      Announcement.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Announcement.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createAnnouncement(body) {
    const doc = await Announcement.create(body);
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updateAnnouncement(id, body) {
    const doc = await Announcement.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!doc) throw ApiError.notFound('Announcement not found');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async deleteAnnouncement(id) {
    const doc = await Announcement.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Announcement not found');
    invalidateHomeCaches();
    return { id };
  }

  async listPromos(query) {
    const { page, limit, skip, sort } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.placement) {
      const legacy = Object.entries({ general: 'hero', 'home-festival': 'home-middle', 'home-dealer': 'home-bottom' })
        .filter(([, v]) => v === query.placement)
        .map(([k]) => k);
      filter.slot = { $in: [query.placement, ...legacy] };
    }
    const [items, total] = await Promise.all([
      Promo.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Promo.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createPromo(body) {
    if (!body.title && !body.imageUrl && !body.bgImageUrl) {
      throw ApiError.badRequest('Add a heading or upload a banner image');
    }
    const doc = await Promo.create(body);
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updatePromo(id, body) {
    const doc = await Promo.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!doc) throw ApiError.notFound('Promo not found');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async deletePromo(id) {
    const doc = await Promo.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Promo not found');
    invalidateHomeCaches();
    return { id };
  }

  async getPublicSettings() {
    const cacheKey = 'settings:public';
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
    let doc = await Settings.findOne({ key: 'default' }).lean();
    if (!doc) {
      doc = (await Settings.create({ key: 'default' })).toObject();
    }
    const data = {
      corporate: doc.corporate,
      factory: doc.factory,
      whatsapp: doc.whatsapp,
      salesTeam: doc.salesTeam || [],
      brand: doc.brand || {},
      social: doc.social || {},
      footer: doc.footer || {},
      map: doc.map || {},
      general: {
        siteName: doc.general?.siteName,
        siteTagline: doc.general?.siteTagline,
        themeDefault: doc.general?.themeDefault,
        modeDefault: doc.general?.modeDefault,
        maintenanceMode: doc.general?.maintenanceMode,
        allowRegistrations: doc.general?.allowRegistrations !== false,
      },
      commerce: withCommerceDefaults(doc.commerce),
      payments: { onlineEnabled: config.paymentsEnabled },
    };
    cacheSet(cacheKey, data, 120);
    return data;
  }

  async getAdminSettings() {
    let doc = await Settings.findOne({ key: 'default' }).lean();
    if (!doc) doc = (await Settings.create({ key: 'default' })).toObject();
    return serialize(doc);
  }

  async updateSettings(body) {
    const doc = await Settings.findOneAndUpdate(
      { key: 'default' },
      { $set: flattenOneLevel(body) },
      { new: true, upsert: true, runValidators: true },
    ).lean();
    cacheDel('settings:public');
    cacheDel('settings:commerce');
    return serialize(doc);
  }

  async getCmsHome() {
    const cacheKey = 'cms:home';
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
    let doc = await CmsContent.findOne({ key: 'home' }).lean();
    if (!doc) {
      doc = (await CmsContent.create({ key: 'home' })).toObject();
    }
    const data = serialize(doc);
    cacheSet(cacheKey, data, 300);
    return data;
  }

  async updateCms(body) {
    const doc = await CmsContent.findOneAndUpdate(
      { key: 'home' },
      { $set: body },
      { new: true, upsert: true },
    ).lean();
    cacheDel('cms:home');
    invalidateHomeCaches();
    return serialize(doc);
  }
}

export default new ContentService();

/** `{ commerce: { codFee: 5 } }` → `{ 'commerce.codFee': 5 }` so partial section updates merge. */
function flattenOneLevel(body = {}) {
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [sub, v] of Object.entries(value)) out[`${key}.${sub}`] = v;
    } else {
      out[key] = value;
    }
  }
  return out;
}
