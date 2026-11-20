import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import ApiError from '../utils/ApiError.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { presentOrder } from './OrderService.js';

const disabled = () =>
  new ApiError(503, 'Online payments are currently disabled', [{ code: 'PAYMENTS_DISABLED' }]);

/** Constant-time HMAC-SHA256 check. Exported for unit tests. */
export function verifyHmac(payload, signature, secret) {
  if (!payload || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

class PaymentService {
  #client;

  get client() {
    if (!this.#client) {
      this.#client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
    }
    return this.#client;
  }

  getConfig() {
    return {
      enabled: config.paymentsEnabled,
      provider: 'razorpay',
      keyId: config.paymentsEnabled ? config.razorpay.keyId : null,
    };
  }

  /** Create (or reuse) the Razorpay order for an existing unpaid Zaylo order. Amount from DB only. */
  async createRazorpayOrder(orderId, user) {
    if (!config.paymentsEnabled) throw disabled();
    const order = await Order.findOne({ _id: orderId, user: user._id }).lean();
    if (!order) throw ApiError.notFound('Order not found');
    if (order.paymentMethod !== 'Razorpay') throw ApiError.badRequest('Order is not an online-payment order');
    if (order.paymentStatus === 'Paid') throw ApiError.badRequest('Order is already paid');
    if (order.status === 'Cancelled') throw ApiError.badRequest('Order is cancelled');

    let rzpOrderId = order.razorpayOrderId;
    if (!rzpOrderId) {
      const rzp = await this.client.orders.create({
        amount: Math.round(order.amount * 100),
        currency: 'INR',
        receipt: order.orderCode,
        notes: { orderId: order._id.toString() },
      });
      rzpOrderId = rzp.id;
      await Order.updateOne({ _id: order._id, razorpayOrderId: { $exists: false } }, { $set: { razorpayOrderId: rzpOrderId } });
    }
    return {
      keyId: config.razorpay.keyId,
      razorpayOrderId: rzpOrderId,
      amount: Math.round(order.amount * 100),
      currency: 'INR',
      orderCode: order.orderCode,
    };
  }

  async #markPaid(filter, paymentId, note) {
    const doc = await Order.findOneAndUpdate(
      { ...filter, paymentStatus: { $ne: 'Paid' } },
      {
        $set: { paymentStatus: 'Paid', paidAt: new Date(), razorpayPaymentId: paymentId },
        $push: { history: { kind: 'payment', value: 'Paid', note } },
      },
      { new: true },
    ).lean();
    return doc || Order.findOne(filter).lean();
  }

  /** Client callback — trusted only after signature verification. */
  async verifyCheckout(body, user) {
    if (!config.paymentsEnabled) throw disabled();
    const order = await Order.findOne({ _id: body.orderId, user: user._id }).lean();
    if (!order || order.razorpayOrderId !== body.razorpay_order_id) throw ApiError.badRequest('Payment does not match order');
    const ok = verifyHmac(
      `${body.razorpay_order_id}|${body.razorpay_payment_id}`,
      body.razorpay_signature,
      config.razorpay.keySecret,
    );
    if (!ok) throw ApiError.badRequest('Payment verification failed');
    const doc = await this.#markPaid({ _id: order._id }, body.razorpay_payment_id, 'Razorpay payment verified');
    return presentOrder(doc);
  }

  /** Server-to-server webhook (raw body). Source of truth for capture events. */
  async handleWebhook(rawBody, signature) {
    if (!config.paymentsEnabled) throw disabled();
    if (!verifyHmac(rawBody, signature, config.razorpay.webhookSecret)) {
      throw ApiError.badRequest('Invalid webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8'));
    const payment = event?.payload?.payment?.entity;
    if (!payment?.order_id) return { ignored: true };

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const order = await Order.findOne({ razorpayOrderId: payment.order_id }).lean();
      if (!order) return { ignored: true };
      if (Math.round(order.amount * 100) !== payment.amount) {
        logger.error(`Razorpay amount mismatch for ${order.orderCode}`);
        return { ignored: true };
      }
      await this.#markPaid({ _id: order._id }, payment.id, 'Razorpay webhook: captured');
    } else if (event.event === 'payment.failed') {
      await Order.updateOne(
        { razorpayOrderId: payment.order_id, paymentStatus: 'Pending' },
        { $set: { paymentStatus: 'Failed' }, $push: { history: { kind: 'payment', value: 'Failed', note: 'Razorpay webhook: failed' } } },
      );
    }
    return { received: true };
  }
}

export default new PaymentService();
