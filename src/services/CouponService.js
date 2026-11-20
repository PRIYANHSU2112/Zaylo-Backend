import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { serialize, serializeMany } from '../utils/serialize.js';

const round2 = (n) => Math.round(n * 100) / 100;

class CouponService {
  /**
   * Validate a coupon for a subtotal (server prices) and return the discount.
   * Throws 400 with a user-facing message when not applicable.
   */
  async evaluate(rawCode, subtotal, userId) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) throw ApiError.badRequest('Enter a coupon code');

    const coupon = await Coupon.findOne({ code }).lean();
    const now = new Date();
    if (!coupon || coupon.status !== 'Active') throw ApiError.badRequest('Invalid coupon code');
    if (coupon.validFrom && now < coupon.validFrom) throw ApiError.badRequest('Coupon is not active yet');
    if (coupon.validTo && now > coupon.validTo) throw ApiError.badRequest('Coupon has expired');
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      throw ApiError.badRequest('Coupon usage limit reached');
    }
    if (subtotal < coupon.minOrder) {
      throw ApiError.badRequest(`Add items worth ₹${round2(coupon.minOrder - subtotal)} more to use this coupon`);
    }
    if (coupon.perUserLimit > 0) {
      if (!userId) throw ApiError.badRequest('Please log in to use this coupon');
      const used = await Order.countDocuments({
        user: userId,
        couponCode: code,
        status: { $ne: 'Cancelled' },
      });
      if (used >= coupon.perUserLimit) throw ApiError.badRequest('You have already used this coupon');
    }

    let discount =
      coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : Number(coupon.value);
    if (coupon.type === 'percent' && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    discount = round2(Math.min(discount, subtotal));

    return {
      coupon: { code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description },
      discount,
    };
  }

  /** Atomically consume one use (respects usageLimit under concurrency). */
  async consume(code, session) {
    if (!code) return;
    const res = await Coupon.updateOne(
      {
        code,
        $or: [{ usageLimit: 0 }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }],
      },
      { $inc: { usedCount: 1 } },
      { session },
    );
    if (res.modifiedCount !== 1) throw ApiError.badRequest('Coupon usage limit reached');
  }

  async release(code, session) {
    if (!code) return;
    await Coupon.updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
  }

  // ---- Admin ----
  async list(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (q) filter.code = new RegExp(escapeRegex(q), 'i');
    const [items, total] = await Promise.all([
      Coupon.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Coupon.countDocuments(filter),
    ]);
    return { data: serializeMany(items), meta: buildMeta({ page, limit, total }) };
  }

  async create(body) {
    const exists = await Coupon.findOne({ code: body.code.toUpperCase() }).lean();
    if (exists) throw ApiError.conflict('Coupon code already exists');
    return serialize(await Coupon.create(body));
  }

  async update(id, body) {
    const doc = await Coupon.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean();
    if (!doc) throw ApiError.notFound('Coupon not found');
    return serialize(doc);
  }

  async remove(id) {
    const doc = await Coupon.findByIdAndDelete(id).lean();
    if (!doc) throw ApiError.notFound('Coupon not found');
    return { id };
  }
}

export default new CouponService();
