import Product from '../models/Product.js';
import Category from '../models/Category.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { serialize, serializeMany, slugify } from '../utils/serialize.js';
import { cacheGet, cacheSet, cacheDelPrefix } from '../utils/cache.js';
import { invalidateHomeCaches } from './HomeService.js';

class CatalogService {
  async listPublicProducts(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = { status: 'Active' };

    if (query.category) filter.category = query.category;
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

    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
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

    return { product: serialize(product), related: serializeMany(related) };
  }

  async listAdminProducts(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.stockBand === 'instock') filter.stock = { $gt: 15 };
    if (query.stockBand === 'lowstock') filter.stock = { $gte: 1, $lte: 15 };
    if (query.stockBand === 'outofstock') filter.stock = 0;
    if (q) {
      filter.$or = [
        { name: new RegExp(escapeRegex(q), 'i') },
        { slug: new RegExp(escapeRegex(q), 'i') },
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

    const doc = await Product.create({
      ...body,
      slug,
      isVeg: body.isVeg ?? true,
      isNew: body.isNew ?? false,
      rating: body.rating ?? 5,
      reviewCount: body.reviewCount ?? 0,
    });
    cacheDelPrefix('categories:');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async updateProduct(id, body) {
    if (body.slug) body.slug = slugify(body.slug);
    if (body.name && !body.slug) body.slug = slugify(body.name);

    const doc = await Product.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) throw ApiError.notFound('Product not found');
    invalidateHomeCaches();
    return serialize(doc);
  }

  async setProductStatus(id, status) {
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
