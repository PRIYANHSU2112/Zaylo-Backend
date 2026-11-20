import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Bundle from '../models/Bundle.js';
import ApiError from '../utils/ApiError.js';
import { formatAddress } from './OrderService.js';
import CommerceService, { productCard } from './CommerceService.js';

function presentAddress(a) {
  return {
    id: a._id.toString(),
    type: a.type,
    name: a.name || '',
    phone: a.phone || '',
    line1: a.line1 || a.address || '',
    line2: a.line2 || '',
    city: a.city || '',
    state: a.state || '',
    pincode: a.pincode || '',
    isDefault: Boolean(a.isDefault),
    address: a.address,
  };
}

const MAX_CART_LINES = 50;

/** Stored cart entry → client/quote line. */
const toLine = (c) =>
  c.bundle
    ? { bundleId: c.bundle.toString(), quantity: c.quantity }
    : { productId: c.product.toString(), quantity: c.quantity };
const MAX_WISHLIST = 200;

class AccountService {
  async #user(userId, select) {
    const user = await User.findById(userId).select(select);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  // ---- Addresses ----
  async listAddresses(userId) {
    const user = await User.findById(userId).select('addresses').lean();
    if (!user) throw ApiError.notFound('User not found');
    return (user.addresses || []).map(presentAddress);
  }

  async addAddress(userId, body) {
    const user = await this.#user(userId, 'addresses');
    if (user.addresses.length >= 20) throw ApiError.badRequest('Address limit reached');
    const makeDefault = body.isDefault || user.addresses.length === 0;
    if (makeDefault) user.addresses.forEach((a) => (a.isDefault = false));
    user.addresses.push({ ...body, isDefault: makeDefault, address: formatAddress(body) || body.address });
    await user.save();
    return presentAddress(user.addresses[user.addresses.length - 1]);
  }

  async updateAddress(userId, addressId, body) {
    const user = await this.#user(userId, 'addresses');
    const addr = user.addresses.id(addressId);
    if (!addr) throw ApiError.notFound('Address not found');
    if (body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
    Object.assign(addr, body);
    addr.address = formatAddress(addr) || addr.address;
    await user.save();
    return presentAddress(addr);
  }

  async deleteAddress(userId, addressId) {
    const user = await this.#user(userId, 'addresses');
    const addr = user.addresses.id(addressId);
    if (!addr) throw ApiError.notFound('Address not found');
    const wasDefault = addr.isDefault;
    addr.deleteOne();
    if (wasDefault && user.addresses[0]) user.addresses[0].isDefault = true;
    await user.save();
    return { id: addressId };
  }

  // ---- Password ----
  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await this.#user(userId, '+password');
    if (!(await user.comparePassword(currentPassword))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    user.password = newPassword;
    await user.save();
    return { changed: true };
  }

  // ---- Cart (server-priced) ----
  async getCart(userId) {
    const user = await User.findById(userId).select('cart').lean();
    if (!user) throw ApiError.notFound('User not found');
    return this.#presentCart(user.cart || []);
  }

  async #presentCart(cart) {
    if (!cart.length) return { items: [], subtotal: 0, issues: [] };
    const { lines, issues } = await CommerceService.resolveLines(cart.map(toLine), { strict: false });
    return {
      items: lines.map((l) => ({
        kind: l.kind,
        ...(l.kind === 'bundle' ? { bundleId: l.id } : { productId: l.id }),
        quantity: l.quantity,
        product: {
          id: l.id,
          kind: l.kind,
          slug: l.slug,
          name: l.name,
          image: l.image,
          weight: l.weight,
          price: l.price,
          mrp: l.mrp,
          stock: l.stock,
          inStock: l.stock > 0,
          components: l.components?.map((c) => ({ name: c.name, quantity: c.quantity })),
        },
        lineTotal: l.lineTotal,
      })),
      subtotal: Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
      issues,
    };
  }

  /** Normalise client lines → stored cart entries ({product}|{bundle}, quantity). Dedupes, caps qty. */
  #sanitizeLines(items = []) {
    const merged = new Map();
    for (const it of items) {
      const isBundle = Boolean(it.bundleId);
      const id = String((isBundle ? it.bundleId : it.productId) || '');
      const qty = Math.floor(Number(it.quantity));
      if (!mongoose.isValidObjectId(id) || !Number.isFinite(qty) || qty < 1) continue;
      const key = `${isBundle ? 'b' : 'p'}:${id}`;
      merged.set(key, Math.min(99, (merged.get(key) || 0) + qty));
    }
    return [...merged].slice(0, MAX_CART_LINES).map(([key, quantity]) => {
      const [t, id] = key.split(':');
      return t === 'b' ? { bundle: id, quantity } : { product: id, quantity };
    });
  }

  async #onlyExisting(lines) {
    if (!lines.length) return lines;
    const [pIds, bIds] = await Promise.all([
      Product.find({ _id: { $in: lines.filter((l) => l.product).map((l) => l.product) }, status: 'Active' }).distinct('_id'),
      Bundle.find({ _id: { $in: lines.filter((l) => l.bundle).map((l) => l.bundle) }, status: 'Active' }).distinct('_id'),
    ]);
    const ok = new Set([...pIds, ...bIds].map(String));
    return lines.filter((l) => ok.has(String(l.product || l.bundle)));
  }

  /** Replace the whole cart (client is source of the selection, never of prices). */
  async setCart(userId, items) {
    const lines = await this.#onlyExisting(this.#sanitizeLines(items));
    await User.updateOne({ _id: userId }, { $set: { cart: lines } });
    return this.#presentCart(lines);
  }

  /** Merge a guest cart into the account cart (quantities add up, capped at 99). */
  async mergeCart(userId, items) {
    const user = await User.findById(userId).select('cart').lean();
    if (!user) throw ApiError.notFound('User not found');
    const combined = [...(user.cart || []).map(toLine), ...(items || [])];
    return this.setCart(userId, combined);
  }

  // ---- Wishlist ----
  async getWishlist(userId) {
    const user = await User.findById(userId).select('wishlist').lean();
    if (!user) throw ApiError.notFound('User not found');
    const products = await Product.find({ _id: { $in: user.wishlist || [] }, status: 'Active' }).lean();
    return products.map(productCard);
  }

  async addToWishlist(userId, productId) {
    if (!mongoose.isValidObjectId(productId)) throw ApiError.badRequest('Invalid product');
    const exists = await Product.exists({ _id: productId, status: 'Active' });
    if (!exists) throw ApiError.notFound('Product not found');
    const res = await User.updateOne(
      { _id: userId, [`wishlist.${MAX_WISHLIST - 1}`]: { $exists: false } },
      { $addToSet: { wishlist: productId } },
    );
    if (res.matchedCount === 0) throw ApiError.badRequest('Wishlist is full');
    return this.getWishlist(userId);
  }

  async removeFromWishlist(userId, productId) {
    await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });
    return this.getWishlist(userId);
  }

  async mergeWishlist(userId, productIds = []) {
    const valid = productIds.filter((id) => mongoose.isValidObjectId(id)).slice(0, MAX_WISHLIST);
    const existing = await Product.find({ _id: { $in: valid }, status: 'Active' }).distinct('_id');
    if (existing.length) {
      await User.updateOne({ _id: userId }, { $addToSet: { wishlist: { $each: existing } } });
    }
    return this.getWishlist(userId);
  }
}

export default new AccountService();
