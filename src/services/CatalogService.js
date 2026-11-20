import Product from '../models/Product.js';
import Category from '../models/Category.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { serialize, serializeMany, slugify } from '../utils/serialize.js';
import { cacheGet, cacheSet, cacheDelPrefix } from '../utils/cache.js';
import { invalidateHomeCaches } from './HomeService.js';

/** Public product shape: derived discount, no internal fields. */
export function publicProduct(doc) {
  const p = serialize(doc);
  if (!p) return p;
  const images = (p.images?.length ? p.images : [p.image]).filter(Boolean);
  if (p.nutrition) delete p.nutrition.protein; // content restriction (legacy data)
  return {
    ...p,
    images,
    discountPercent: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
  };
}

/** Normalise admin input: gallery ↔ primary image, empty SKU removed, trimmed lists. */
function normalizeProductBody(body) {
  const data = { ...body };
  if (Array.isArray(data.images)) {
    data.images = [...new Set(data.images.filter(Boolean))].slice(0, 8);
    if (data.images.length) data.image = data.images[0];
  } else if (data.image) {
    data.images = [data.image];
  }
  if (data.sku === '') delete data.sku;
  if (Array.isArray(data.ingredients)) data.ingredients = data.ingredients.map((i) => i.trim()).filter(Boolean);
  delete data.rating;
  delete data.reviewCount;
  return data;
}

/** A product can only go Active once the essentials exist (drafts may be incomplete). */
function assertPublishable(p) {
  if (p.status !== 'Active') return;
  const missing = [];
  if (!p.category) missing.push('category');
  if (!(Number(p.price) > 0)) missing.push('selling price');
  if (!(Number(p.mrp) > 0)) missing.push('MRP');
  if (!p.image && !(p.images || []).length) missing.push('image');
  if (missing.length) {
    throw ApiError.badRequest(`Add ${missing.join(', ')} before publishing this product`);
  }
}

class CatalogService {
  async listPublicProducts(query) {
    const { page, limit, skip, q } = parseListQuery(query);
    const filter = { status: 'Active' };
    const SORTS = {
      popular: { isPopular: -1, homePosition: 1, createdAt: -1 },
      newest: { createdAt: -1 },
      'price-asc': { price: 1, createdAt: -1 },
      'price-desc': { price: -1, createdAt: -1 },
      rating: { rating: -1, reviewCount: -1 },
      name: { name: 1 },
    };
    const sort = SORTS[query.sort] || SORTS.popular;

    if (query.category) {
      const cats = String(query.category).split(',').map((c) => c.trim()).filter(Boolean).slice(0, 20);
      filter.category = cats.length > 1 ? { $in: cats } : cats[0];
    }
    const min = Number(query.minPrice);
    const max = Number(query.maxPrice);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      filter.price = {};
      if (Number.isFinite(min)) filter.price.$gte = min;
      if (Number.isFinite(max)) filter.price.$lte = max;
    }
    if (query.inStock === 'true') filter.stock = { $gt: 0 };
    if (query.featured === 'true') filter.isFeatured = true;
    if (query.exclude) filter.slug = { $ne: String(query.exclude) };
    if (q) {
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        { tagline: new RegExp(escapeRegex(q), 'i') },
        { flavor: new RegExp(escapeRegex(q), 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    return { data: items.map(publicProduct), meta: buildMeta({ page, limit, total }) };
  }

  async getBySlug(slug) {
    const product = await Product.findOne({ slug, status: 'Active' }).lean();
    if (!product) throw ApiError.notFound('Product not found');

    const related = await Product.find({
      status: 'Active',
      category: product.category,
      slug: { $ne: slug },
    })
      .limit(4)
      .lean();

    return { product: publicProduct(product), related: related.map(publicProduct) };
  }

  async listAdminProducts(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.stockBand === 'instock') filter.stock = { $gt: 15 };
    if (query.stockBand === 'lowstock') filter.stock = { $gte: 1, $lte: 15 };
    if (query.stockBand === 'outofstock') filter.stock = 0;
    if (query.featured === 'true') filter.isFeatured = true;
    if (q) {
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        { slug: new RegExp(escapeRegex(q), 'i') },
        { sku: new RegExp(escapeRegex(q), 'i') },
        { tagline: new RegExp(escapeRegex(q), 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createProduct(body) {
    const slug = slugify(body.slug || body.name);
    const exists = await Product.findOne({ slug }).lean();
    if (exists) throw ApiError.conflict('Product slug already exists');

    const data = normalizeProductBody({ ...body, slug });
    assertPublishable({ ...data, status: data.status || 'Active' });
    const doc = await Product.create({ ...data, isVeg: data.isVeg ?? true, isNew: data.isNew ?? false });
    cacheDelPrefix('categories:');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updateProduct(id, body) {
    if (body.slug) body.slug = slugify(body.slug);
    if (body.name && !body.slug) body.slug = slugify(body.name);

    const existing = await Product.findById(id).lean();
    if (!existing) throw ApiError.notFound('Product not found');
    const data = normalizeProductBody(body);
    const merged = { ...existing, ...data };
    if (merged.price > merged.mrp) throw ApiError.badRequest('Selling price cannot be higher than MRP');
    // Publish rules apply when a draft becomes Active (editing live products stays possible)
    if (data.status === 'Active' && existing.status !== 'Active') assertPublishable(merged);

    const update = { $set: data };
    if (body.sku === '') {
      delete update.$set.sku;
      update.$unset = { sku: 1 };
    }
    const doc = await Product.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
    if (!doc) throw ApiError.notFound('Product not found');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async setProductStatus(id, status) {
    if (status === 'Active') {
      // only when publishing a non-active product
      const existing = await Product.findById(id).lean();
      if (!existing) throw ApiError.notFound('Product not found');
      if (existing.status !== 'Active') assertPublishable({ ...existing, status });
    }
    const doc = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) throw ApiError.notFound('Product not found');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async deleteProduct(id) {
    const doc = await Product.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Product not found');
    invalidateHomeCaches();
    return { id };
  }

  async bulkProducts({ action, ids, status }) {
    if (action === 'delete') {
      await Product.deleteMany({ _id: { $in: ids } });
      invalidateHomeCaches();
      return { deleted: ids.length };
    }
    if (action === 'status' && status) {
      await Product.updateMany({ _id: { $in: ids } }, { status });
      invalidateHomeCaches();
      return { updated: ids.length, status };
    }
    throw ApiError.badRequest('Invalid bulk action');
  }

  async listPublicCategories() {
    const cacheKey = 'categories:public';
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const items = await Category.find({ status: 'Active' }).sort({ name: 1 }).lean();
    const data = serializeMany(items);
    cacheSet(cacheKey, data, 120);
    return data;
  }

  async listAdminCategories(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (q) {
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        { slug: new RegExp(escapeRegex(q), 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      Category.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Category.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async createCategory(body) {
    const slug = slugify(body.slug || body.name);
    const doc = await Category.create({
      ...body,
      slug,
      comingSoon: body.status === 'Inactive' ? true : Boolean(body.comingSoon),
    });
    cacheDelPrefix('categories:');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updateCategory(id, body) {
    if (body.name && !body.slug) body.slug = slugify(body.name);
    if (body.slug) body.slug = slugify(body.slug);
    if (body.status === 'Inactive') body.comingSoon = true;
    if (body.status === 'Active') body.comingSoon = false;

    const doc = await Category.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) throw ApiError.notFound('Category not found');
    cacheDelPrefix('categories:');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async deleteCategory(id) {
    const doc = await Category.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Category not found');
    cacheDelPrefix('categories:');
    invalidateHomeCaches();
    return { id };
  }

  async setCategoryStatus(id, status) {
    const comingSoon = status === 'Inactive';
    const doc = await Category.findByIdAndUpdate(
      id,
      { status, comingSoon },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) throw ApiError.notFound('Category not found');
    cacheDelPrefix('categories:');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async bulkCategories({ action, ids, status }) {
    if (action === 'delete') {
      await Category.deleteMany({ _id: { $in: ids } });
      cacheDelPrefix('categories:');
      invalidateHomeCaches();
      return { deleted: ids.length };
    }
    if (action === 'status' && status) {
      const comingSoon = status === 'Inactive';
      await Category.updateMany({ _id: { $in: ids } }, { status, comingSoon });
      cacheDelPrefix('categories:');
      invalidateHomeCaches();
      return { updated: ids.length, status };
    }
    throw ApiError.badRequest('Invalid bulk action');
  }
}

export default new CatalogService();
