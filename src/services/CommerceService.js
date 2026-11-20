import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Bundle from '../models/Bundle.js';
import Settings from '../models/Settings.js';
import ApiError from '../utils/ApiError.js';
import { cacheGet, cacheSet } from '../utils/cache.js';
import config from '../config/index.js';
import CouponService from './CouponService.js';

export const COMMERCE_DEFAULTS = Object.freeze({
  shippingFee: 40,
  freeShippingThreshold: 499,
  codEnabled: true,
  codFee: 0,
  taxPercent: 0,
  minOrderAmount: 0,
  maxQtyPerItem: 50,
});

export function withCommerceDefaults(commerce = {}) {
  return { ...COMMERCE_DEFAULTS, ...(commerce || {}) };
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Derived, read-only view of a bundle from its products (all from DB).
 * - components: per ONE pack, duplicates counted
 * - stock: packs that can be fulfilled right now = min(floor(stock / count))
 * - purchasable: bundle Active, ≥1 product, every product exists & is Active
 */
export function bundleView(bundle, productsById) {
  const counts = new Map();
  for (const pid of bundle.productIds || []) counts.set(String(pid), (counts.get(String(pid)) || 0) + 1);
  const components = [];
  let stock = Infinity;
  let allActive = counts.size > 0;
  for (const [pid, quantity] of counts) {
    const p = productsById.get(pid);
    if (!p || p.status !== 'Active') {
      allActive = false;
      stock = 0;
      continue;
    }
    components.push({ product: p._id, name: p.name, quantity });
    stock = Math.min(stock, Math.floor((p.stock ?? 0) / quantity));
  }
  const first = productsById.get(String(bundle.productIds?.[0] || ''));
  return {
    components,
    stock: Number.isFinite(stock) ? stock : 0,
    itemCount: (bundle.productIds || []).length,
    image: first?.image || '',
    purchasable: bundle.status === 'Active' && allActive,
  };
}

/** Map<productId, totalUnits> across product lines and bundle components. */
export function aggregateStockNeeds(lines) {
  const need = new Map();
  const add = (pid, q) => need.set(String(pid), (need.get(String(pid)) || 0) + q);
  for (const l of lines) {
    if (l.kind === 'bundle') l.components.forEach((c) => add(c.product, c.quantity * l.quantity));
    else add(l.product, l.quantity);
  }
  return need;
}

/** Card-safe public projection of a product (prices/stock straight from DB). */
export function productCard(p) {
  return {
    id: p._id.toString(),
    slug: p.slug,
    name: p.name,
    image: p.image || '',
    weight: p.weight || '',
    price: p.price,
    mrp: p.mrp,
    stock: p.stock ?? 0,
    inStock: (p.stock ?? 0) > 0,
    status: p.status,
  };
}

class CommerceService {
  async getCommerce() {
    const cached = await cacheGet('settings:commerce');
    if (cached) return cached;
    const doc = await Settings.findOne({ key: 'default' }).select('commerce').lean();
    const data = withCommerceDefaults(doc?.commerce);
    await cacheSet('settings:commerce', data, 60);
    return data;
  }

  /**
   * Resolve client lines — `{productId, quantity}` or `{bundleId, quantity}` — against the DB.
   * Client prices/names/stock are never read. Duplicate lines are merged.
   * Stock is checked per product on the AGGREGATE demand of direct lines plus every
   * bundle component, so a product can't be oversold through a mix of packs and singles.
   * Issue/line `id` (and legacy `productId`) is the cart item id (product or bundle id).
   * @returns {Promise<{lines: object[], issues: object[]}>}
   */
  async resolveLines(items = [], { strict = true } = {}) {
    const commerce = await this.getCommerce();
    const wantedProducts = new Map();
    const wantedBundles = new Map();
    for (const it of items) {
      const isBundle = Boolean(it.bundleId || it.bundle);
      const id = String((isBundle ? it.bundleId || it.bundle : it.productId || it.product || it.id) || '');
      if (!mongoose.isValidObjectId(id)) {
        if (strict) throw ApiError.badRequest('Invalid item in cart');
        continue;
      }
      const qty = Math.floor(Number(it.quantity));
      if (!Number.isFinite(qty) || qty < 1) throw ApiError.badRequest('Invalid quantity');
      const target = isBundle ? wantedBundles : wantedProducts;
      target.set(id, (target.get(id) || 0) + qty);
    }

    const bundles = wantedBundles.size
      ? await Bundle.find({ _id: { $in: [...wantedBundles.keys()] } }).lean()
      : [];
    const bundleById = new Map(bundles.map((b) => [b._id.toString(), b]));
    const productIds = new Set(wantedProducts.keys());
    bundles.forEach((b) => (b.productIds || []).forEach((pid) => productIds.add(String(pid))));
    const products = await Product.find({ _id: { $in: [...productIds] } }).lean();
    const byId = new Map(products.map((p) => [p._id.toString(), p]));

    const lines = [];
    const issues = [];
    const issue = (id, code, message, extra = {}) => issues.push({ id, productId: id, code, message, ...extra });

    for (const [id, quantity] of wantedProducts) {
      const p = byId.get(id);
      if (!p || p.status !== 'Active') {
        issue(id, 'UNAVAILABLE', 'Product is no longer available');
        continue;
      }
      lines.push({
        kind: 'product',
        product: p._id,
        id,
        slug: p.slug,
        name: p.name,
        image: p.image || '',
        weight: p.weight || '',
        price: p.price,
        mrp: p.mrp,
        quantity,
        lineTotal: round2(p.price * quantity),
        stock: p.stock ?? 0,
      });
    }

    for (const [id, quantity] of wantedBundles) {
      const b = bundleById.get(id);
      const view = b ? bundleView(b, byId) : null;
      if (!view || !view.purchasable) {
        issue(id, 'BUNDLE_UNAVAILABLE', `${b?.name || 'This pack'} is no longer available`, { bundleId: id });
        continue;
      }
      lines.push({
        kind: 'bundle',
        bundle: b._id,
        id,
        slug: '',
        name: b.name,
        image: view.image,
        weight: `${view.itemCount} items`,
        price: b.price,
        mrp: b.mrp,
        quantity,
        lineTotal: round2(b.price * quantity),
        stock: view.stock,
        components: view.components,
      });
    }

    for (const l of lines) {
      if (l.quantity > commerce.maxQtyPerItem) {
        issue(l.id, 'MAX_QTY', `Maximum ${commerce.maxQtyPerItem} per item`, { available: commerce.maxQtyPerItem });
      }
    }

    // Aggregate stock check across singles + bundle components
    const need = aggregateStockNeeds(lines);
    for (const [pid, qty] of need) {
      const p = byId.get(pid);
      const have = p?.stock ?? 0;
      if (have >= qty) continue;
      const affected = lines.filter(
        (l) => (l.kind === 'product' && l.id === pid) || l.components?.some((c) => String(c.product) === pid),
      );
      for (const l of affected) {
        if (issues.some((i) => i.id === l.id && i.code === 'OUT_OF_STOCK')) continue;
        const msg =
          l.kind === 'bundle'
            ? have > 0
              ? `Not enough stock of ${p?.name} for this pack`
              : `${l.name} is out of stock`
            : have > 0
              ? `Only ${have} left in stock`
              : 'Out of stock';
        issue(l.id, 'OUT_OF_STOCK', msg, { available: l.kind === 'bundle' ? l.stock : have });
      }
    }

    if (strict && issues.length) {
      throw ApiError.badRequest(issues[0].message, issues);
    }
    return { lines, issues };
  }

  /**
   * Full server-side price quote. Used by POST /checkout/quote and order creation
   * so the customer always sees exactly what will be charged.
   */
  async quote({ items, couponCode, paymentMethod = 'COD', userId }, { strict = true } = {}) {
    const commerce = await this.getCommerce();
    const { lines, issues } = await this.resolveLines(items, { strict });
    if (!lines.length && strict) throw ApiError.badRequest('Your cart is empty');

    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

    let discount = 0;
    let coupon = null;
    let couponError = null;
    if (couponCode) {
      try {
        const res = await CouponService.evaluate(couponCode, subtotal, userId);
        discount = res.discount;
        coupon = res.coupon;
      } catch (err) {
        if (strict) throw err;
        couponError = err.message;
      }
    }

    const afterDiscount = Math.max(0, subtotal - discount);
    const freeShip =
      commerce.freeShippingThreshold > 0 && afterDiscount >= commerce.freeShippingThreshold;
    const shippingFee = lines.length && !freeShip ? commerce.shippingFee : 0;
    const codFee = paymentMethod === 'COD' && lines.length ? commerce.codFee : 0;
    const tax = round2((afterDiscount * commerce.taxPercent) / 100);
    const amount = round2(afterDiscount + shippingFee + codFee + tax);

    if (strict && commerce.minOrderAmount > 0 && subtotal < commerce.minOrderAmount) {
      throw ApiError.badRequest(`Minimum order amount is ₹${commerce.minOrderAmount}`);
    }

    return {
      lines,
      issues,
      subtotal,
      discount: round2(discount),
      couponCode: coupon?.code || '',
      couponError,
      shippingFee,
      codFee,
      tax,
      amount,
      freeShippingThreshold: commerce.freeShippingThreshold,
      paymentMethods: {
        COD: commerce.codEnabled,
        Razorpay: config.paymentsEnabled,
      },
    };
  }
}

export default new CommerceService();
