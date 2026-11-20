import crypto from 'node:crypto';
import Order, { STATUS_TRANSITIONS, isInvoiceEligible } from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';
import { parseListQuery, buildMeta, escapeRegex } from '../utils/pagination.js';
import { serialize, serializeMany } from '../utils/serialize.js';
import { withTransaction, transactionsEnabled } from '../utils/transaction.js';
import NotificationService from './NotificationService.js';
import CommerceService, { aggregateStockNeeds } from './CommerceService.js';
import CouponService from './CouponService.js';

const RELEASABLE = ['Pending', 'Confirmed', 'Packed'];
const CUSTOMER_CANCELLABLE = ['Pending', 'Confirmed'];

function makeOrderCode() {
  const t = Date.now().toString(36).toUpperCase();
  const r = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ZAY-${t}-${r}`;
}

export function formatAddress(a = {}) {
  return [a.line1, a.line2, a.city, a.state && a.pincode ? `${a.state} - ${a.pincode}` : a.state || a.pincode]
    .filter(Boolean)
    .join(', ');
}

/** Public order shape (adds derived flags, hides internal fields). */
export function presentOrder(doc) {
  const o = serialize(doc);
  if (!o) return o;
  delete o.idempotencyKey;
  delete o.stockReleased;
  o.invoiceAvailable = isInvoiceEligible(o);
  o.canCancel = CUSTOMER_CANCELLABLE.includes(o.status);
  o.paymentStatus = o.paymentStatus || 'Pending';
  return o;
}

class OrderService {
  /**
   * Create an order. Prices, totals, stock and coupon come exclusively from the DB.
   * Idempotent per (user, Idempotency-Key). Stock is decremented with conditional
   * atomic updates so concurrent orders can never oversell.
   */
  async createOrder(body, user, idempotencyKey) {
    const userId = user._id;
    if (!idempotencyKey) throw ApiError.badRequest('Missing Idempotency-Key header');
    const idemKey = `${userId}:${idempotencyKey}`;

    const existing = await Order.findOne({ idempotencyKey: idemKey }).lean();
    if (existing) return { order: presentOrder(existing), replayed: true };

    const paymentMethod = body.paymentMethod || 'COD';
    const commerce = await CommerceService.getCommerce();
    if (paymentMethod === 'Razorpay' && !config.paymentsEnabled) {
      throw new ApiError(503, 'Online payments are currently unavailable. Please choose Cash on Delivery.');
    }
    if (paymentMethod === 'COD' && !commerce.codEnabled) {
      throw ApiError.badRequest('Cash on Delivery is not available');
    }

    // Shipping address: saved address id or a full address object
    let ship = body.address;
    if (body.addressId) {
      const u = await User.findById(userId).select('addresses').lean();
      const a = u?.addresses?.find((x) => x._id.toString() === body.addressId);
      if (!a) throw ApiError.badRequest('Address not found');
      ship = a;
    }
    if (!ship?.line1 && !ship?.address) throw ApiError.badRequest('Shipping address is required');
    const shippingDetails = {
      name: ship.name || user.name,
      phone: ship.phone || user.phone || '',
      line1: ship.line1 || ship.address,
      line2: ship.line2 || '',
      city: ship.city || '',
      state: ship.state || '',
      pincode: ship.pincode || '',
    };

    const quote = await CommerceService.quote({
      items: body.items,
      couponCode: body.couponCode,
      paymentMethod,
      userId,
    });

    const decremented = [];
    let couponConsumed = false;
    try {
      const order = await withTransaction(async (session) => {
        // One conditional decrement per product on the aggregate of singles + bundle components.
        for (const [productId, qty] of aggregateStockNeeds(quote.lines)) {
          const res = await Product.updateOne(
            { _id: productId, status: 'Active', stock: { $gte: qty } },
            { $inc: { stock: -qty } },
            { session },
          );
          if (res.modifiedCount !== 1) {
            throw ApiError.conflict('An item in your cart just went out of stock. Please review your cart.');
          }
          if (!session) decremented.push({ product: productId, quantity: qty });
        }
        if (quote.couponCode) {
          await CouponService.consume(quote.couponCode, session);
          if (!session) couponConsumed = true;
        }
        const [created] = await Order.create(
          [
            {
              orderCode: makeOrderCode(),
              user: userId,
              customerName: shippingDetails.name,
              customerEmail: user.email,
              customerPhone: shippingDetails.phone,
              subtotal: quote.subtotal,
              discount: quote.discount,
              shippingFee: quote.shippingFee,
              codFee: quote.codFee,
              tax: quote.tax,
              amount: quote.amount,
              couponCode: quote.couponCode,
              paymentMethod,
              paymentStatus: 'Pending',
              status: 'Pending',
              shippingAddress: `${shippingDetails.name}, ${formatAddress(shippingDetails)}`,
              shippingDetails,
              items: quote.lines.map(({ stock: _s, ...l }) => l),
              history: [{ kind: 'status', value: 'Pending', note: 'Order placed', by: userId }],
              idempotencyKey: idemKey,
              date: new Date(),
            },
          ],
          { session },
        );
        await User.updateOne({ _id: userId }, { $set: { cart: [] } }, { session });
        return created;
      });

      const data = presentOrder(order);
      NotificationService.notify({
        type: 'order',
        title: 'New order',
        message: `Order ${data.orderCode} placed by ${data.customerName} (₹${data.amount})`,
        link: '/orders',
        entityId: data.id,
        meta: { orderCode: data.orderCode, amount: data.amount },
      });
      return { order: data, replayed: false };
    } catch (err) {
      // Standalone Mongo: compensate the writes made before the failure.
      if (!transactionsEnabled()) {
        await Promise.all(
          decremented.map((l) => Product.updateOne({ _id: l.product }, { $inc: { stock: l.quantity } })),
        );
        if (couponConsumed) await CouponService.release(quote.couponCode);
      }
      // Concurrent duplicate submit with the same key → return the winner.
      if (err?.code === 11000 && String(err.message).includes('idempotencyKey')) {
        const winner = await Order.findOne({ idempotencyKey: idemKey }).lean();
        if (winner) return { order: presentOrder(winner), replayed: true };
      }
      throw err;
    }
  }

  /** Return reserved stock + coupon use exactly once (guarded by `stockReleased`). */
  async #releaseStock(orderId, session) {
    const order = await Order.findOneAndUpdate(
      { _id: orderId, stockReleased: { $ne: true } },
      { $set: { stockReleased: true } },
      { new: true, session },
    ).lean();
    if (!order) return;
    for (const i of order.items) {
      if (i.kind === 'bundle') {
        for (const c of i.components || []) {
          await Product.updateOne({ _id: c.product }, { $inc: { stock: c.quantity * i.quantity } }, { session });
        }
      } else if (i.product) {
        await Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } }, { session });
      }
    }
    if (order.couponCode) await CouponService.release(order.couponCode, session);
  }

  async #transition(order, nextStatus, { by, note = '', extra = {} } = {}) {
    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (order.status !== nextStatus && !allowed.includes(nextStatus)) {
      throw ApiError.badRequest(`Cannot change order from ${order.status} to ${nextStatus}`);
    }
    return withTransaction(async (session) => {
      const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: order.status }, // optimistic: status unchanged since read
        {
          $set: { status: nextStatus, ...extra },
          $push: { history: { kind: 'status', value: nextStatus, note, by } },
        },
        { new: true, session },
      ).lean();
      if (!updated) throw ApiError.conflict('Order was updated by someone else. Refresh and retry.');
      if (nextStatus === 'Cancelled' && RELEASABLE.includes(order.status)) {
        await this.#releaseStock(order._id, session);
      }
      return updated;
    });
  }

  async listMine(userId, query) {
    const { page, limit, skip } = parseListQuery(query);
    const filter = { user: userId };
    const [items, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return { data: items.map(presentOrder), meta: buildMeta({ page, limit, total }) };
  }

  async #getAuthorized(id, requester) {
    const order = await Order.findById(id).lean();
    if (!order) throw ApiError.notFound('Order not found');
    const isStaff = ['Admin', 'Manager'].includes(requester?.role);
    const isOwner = order.user && order.user.toString() === String(requester?._id || requester?.id);
    if (!isStaff && !isOwner) throw ApiError.notFound('Order not found');
    return order;
  }

  async getOne(id, requester) {
    return presentOrder(await this.#getAuthorized(id, requester));
  }

  async getForInvoice(id, requester) {
    const order = await this.#getAuthorized(id, requester);
    if (!isInvoiceEligible(order)) {
      throw ApiError.forbidden('Invoice is available once the order is confirmed (and paid, for online payments)');
    }
    return order;
  }

  async cancelByCustomer(id, requester, reason = '') {
    const order = await this.#getAuthorized(id, requester);
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw ApiError.badRequest('This order can no longer be cancelled');
    }
    const updated = await this.#transition(order, 'Cancelled', {
      by: requester._id,
      note: reason ? `Cancelled by customer: ${reason}` : 'Cancelled by customer',
    });
    return presentOrder(updated);
  }

  // ---- Admin ----
  async listAdmin(query) {
    const { page, limit, skip, sort, q } = parseListQuery(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ orderCode: rx }, { customerName: rx }, { customerEmail: rx }, { shippingAddress: rx }];
    }
    const [items, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return { data: items.map(presentOrder), meta: buildMeta({ page, limit, total }) };
  }

  async setStatus(id, { status, courier, trackingNumber, note }, staff) {
    const order = await Order.findById(id).lean();
    if (!order) throw ApiError.notFound('Order not found');
    const extra = {};
    if (courier !== undefined) extra.courier = courier;
    if (trackingNumber !== undefined) extra.trackingNumber = trackingNumber;
    if (status === order.status) {
      if (!Object.keys(extra).length) return presentOrder(order);
      const doc = await Order.findByIdAndUpdate(id, { $set: extra }, { new: true }).lean();
      return presentOrder(doc);
    }
    const updated = await this.#transition(order, status, { by: staff?._id, note, extra });
    return presentOrder(updated);
  }

  /**
   * Payment status changes are separate from fulfilment status.
   * COD → Paid only on confirmed cash collection after dispatch.
   */
  async setPayment(id, { action, note }, staff) {
    const order = await Order.findById(id).lean();
    if (!order) throw ApiError.notFound('Order not found');
    if (action !== 'cod-collected') throw ApiError.badRequest('Unsupported payment action');
    if (order.paymentMethod !== 'COD') throw ApiError.badRequest('Only COD orders can be marked as collected');
    if (!['Shipped', 'Delivered'].includes(order.status)) {
      throw ApiError.badRequest('COD can be marked collected only after the order is shipped or delivered');
    }
    const doc = await Order.findOneAndUpdate(
      { _id: id, paymentStatus: { $ne: 'Paid' } },
      {
        $set: { paymentStatus: 'Paid', paidAt: new Date() },
        $push: { history: { kind: 'payment', value: 'Paid', note: note || 'COD collected', by: staff?._id } },
      },
      { new: true },
    ).lean();
    if (!doc) throw ApiError.badRequest('Payment already marked as collected');
    return presentOrder(doc);
  }

  async remove(id) {
    const order = await Order.findById(id).lean();
    if (!order) throw ApiError.notFound('Order not found');
    if (RELEASABLE.includes(order.status)) await this.#releaseStock(order._id);
    await Order.deleteOne({ _id: id });
    return { id };
  }

  async bulk({ action, ids, status }, staff) {
    if (action === 'delete') {
      for (const id of ids) await this.remove(id).catch(() => null);
      return { deleted: ids.length };
    }
    if (action === 'status' && status) {
      const failed = [];
      for (const id of ids) {
        try {
          await this.setStatus(id, { status }, staff);
        } catch (err) {
          failed.push({ id, message: err.message });
        }
      }
      return { updated: ids.length - failed.length, failed, status };
    }
    throw ApiError.badRequest('Invalid bulk action');
  }
}

export default new OrderService();
