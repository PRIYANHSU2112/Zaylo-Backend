import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Product from '../src/models/Product.js';
import Order from '../src/models/Order.js';
import Coupon from '../src/models/Coupon.js';
import database from '../src/config/database.js';
import { startDb, stopDb, resetDb, makeUser, makeProduct, placeOrder, api, idemKey } from './helpers.js';

beforeAll(() => startDb({ replSet: true }));
afterAll(stopDb);
beforeEach(resetDb);

describe('transactions', () => {
  it('detects replica-set support', () => {
    expect(database.supportsTransactions).toBe(true);
  });
});

describe('order creation — server pricing & stock', () => {
  it('ignores client-supplied prices and computes totals from the DB', async () => {
    const { auth } = await makeUser();
    const p = await makeProduct({ price: 50, stock: 10 });
    const res = await placeOrder(auth, [{ productId: p.id, quantity: 2, price: 1, name: 'hacked' }]);
    // Unknown keys are stripped; price comes from DB
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(100);
    expect(res.body.data.items[0].price).toBe(50);
    expect(res.body.data.items[0].name).toBe(p.name);
    expect(res.body.data.paymentStatus).toBe('Pending');
    expect(res.body.data.status).toBe('Pending');
    expect((await Product.findById(p.id)).stock).toBe(8);
  });

  it('rejects orders above available stock', async () => {
    const { auth } = await makeUser();
    const p = await makeProduct({ stock: 2 });
    const res = await placeOrder(auth, [{ productId: p.id, quantity: 3 }]);
    expect(res.status).toBe(400);
    expect((await Product.findById(p.id)).stock).toBe(2);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('never oversells under concurrent orders', async () => {
    const p = await makeProduct({ stock: 3 });
    const users = await Promise.all(Array.from({ length: 6 }, () => makeUser()));
    const results = await Promise.all(users.map((u) => placeOrder(u.auth, [{ productId: p.id, quantity: 1 }])));
    const ok = results.filter((r) => r.status === 201).length;
    expect(ok).toBe(3);
    expect((await Product.findById(p.id)).stock).toBe(0);
    expect(await Order.countDocuments()).toBe(3);
  });

  it('rolls back every line when one line fails', async () => {
    const { auth } = await makeUser();
    const a = await makeProduct({ stock: 5 });
    const b = await makeProduct({ stock: 0 });
    const res = await placeOrder(auth, [
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
    ]);
    expect(res.status).toBe(400);
    expect((await Product.findById(a.id)).stock).toBe(5);
  });

  it('requires an Idempotency-Key and dedupes repeated submits', async () => {
    const { auth } = await makeUser();
    const p = await makeProduct({ stock: 10 });
    const items = [{ productId: p.id, quantity: 1 }];

    const missing = await api().post('/api/v1/orders').set('Authorization', auth).send({ items, address: {} });
    expect(missing.status).toBe(400);

    const key = idemKey();
    const [r1, r2] = await Promise.all([placeOrder(auth, items, { key }), placeOrder(auth, items, { key })]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    expect(r1.body.data.id).toBe(r2.body.data.id);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Product.findById(p.id)).stock).toBe(9);
  });

  it('requires authentication', async () => {
    const p = await makeProduct();
    const res = await api().post('/api/v1/orders').send({ items: [{ productId: p.id, quantity: 1 }] });
    expect(res.status).toBe(401);
  });
});

describe('cancellation & status', () => {
  it('customer cancel restocks exactly once', async () => {
    const { auth } = await makeUser();
    const p = await makeProduct({ stock: 5 });
    const { body } = await placeOrder(auth, [{ productId: p.id, quantity: 2 }]);
    const c1 = await api().post(`/api/v1/orders/${body.data.id}/cancel`).set('Authorization', auth).send({});
    expect(c1.status).toBe(200);
    const c2 = await api().post(`/api/v1/orders/${body.data.id}/cancel`).set('Authorization', auth).send({});
    expect(c2.status).toBe(400);
    expect((await Product.findById(p.id)).stock).toBe(5);
  });

  it('enforces transitions and keeps payment status independent', async () => {
    const cust = await makeUser();
    const staff = await makeUser('Manager');
    const p = await makeProduct();
    const { body } = await placeOrder(cust.auth, [{ productId: p.id, quantity: 1 }]);
    const id = body.data.id;
    const bad = await api().patch(`/api/v1/admin/orders/${id}/status`).set('Authorization', staff.auth).send({ status: 'Delivered' });
    expect(bad.status).toBe(400);

    const early = await api().patch(`/api/v1/admin/orders/${id}/payment`).set('Authorization', staff.auth).send({ action: 'cod-collected' });
    expect(early.status).toBe(400);

    for (const status of ['Confirmed', 'Shipped']) {
      const r = await api().patch(`/api/v1/admin/orders/${id}/status`).set('Authorization', staff.auth).send({ status, trackingNumber: 'TRK1' });
      expect(r.status).toBe(200);
      expect(r.body.data.paymentStatus).toBe('Pending');
    }
    const paid = await api().patch(`/api/v1/admin/orders/${id}/payment`).set('Authorization', staff.auth).send({ action: 'cod-collected' });
    expect(paid.status).toBe(200);
    expect(paid.body.data.paymentStatus).toBe('Paid');
    expect(paid.body.data.status).toBe('Shipped');
    expect(paid.body.data.trackingNumber).toBe('TRK1');

    const again = await api().patch(`/api/v1/admin/orders/${id}/payment`).set('Authorization', staff.auth).send({ action: 'cod-collected' });
    expect(again.status).toBe(400);
  });

  it('other customers cannot see an order', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const p = await makeProduct();
    const { body } = await placeOrder(a.auth, [{ productId: p.id, quantity: 1 }]);
    const res = await api().get(`/api/v1/orders/${body.data.id}`).set('Authorization', b.auth);
    expect(res.status).toBe(404);
  });
});

describe('invoice eligibility', () => {
  it('only for confirmed+ orders, never Pending or Cancelled', async () => {
    const cust = await makeUser();
    const staff = await makeUser('Admin');
    const p = await makeProduct();
    const { body } = await placeOrder(cust.auth, [{ productId: p.id, quantity: 1 }]);
    const id = body.data.id;
    expect(body.data.invoiceAvailable).toBe(false);

    const pending = await api().get(`/api/v1/orders/${id}/invoice`).set('Authorization', cust.auth);
    expect(pending.status).toBe(403);

    await api().patch(`/api/v1/admin/orders/${id}/status`).set('Authorization', staff.auth).send({ status: 'Confirmed' });
    const ok = await api().get(`/api/v1/orders/${id}/invoice`).set('Authorization', cust.auth);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain(body.data.orderCode);

    await api().patch(`/api/v1/admin/orders/${id}/status`).set('Authorization', staff.auth).send({ status: 'Cancelled' });
    const cancelled = await api().get(`/api/v1/orders/${id}/invoice`).set('Authorization', cust.auth);
    expect(cancelled.status).toBe(403);
    expect((await Product.findById(p.id)).stock).toBe(10);
  });
});

describe('coupons', () => {
  it('applies capped percent discount and enforces usage limit atomically', async () => {
    await Coupon.create({ code: 'SAVE10', type: 'percent', value: 10, maxDiscount: 15, usageLimit: 1 });
    const p = await makeProduct({ price: 100, stock: 50 });
    const u1 = await makeUser();
    const u2 = await makeUser();
    const quote = await api()
      .post('/api/v1/checkout/quote')
      .send({ items: [{ productId: p.id, quantity: 2 }], couponCode: 'save10' });
    expect(quote.body.data.discount).toBe(15);

    const [a, b] = await Promise.all([
      placeOrder(u1.auth, [{ productId: p.id, quantity: 2 }], { couponCode: 'SAVE10' }),
      placeOrder(u2.auth, [{ productId: p.id, quantity: 2 }], { couponCode: 'SAVE10' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect((await Coupon.findOne({ code: 'SAVE10' })).usedCount).toBe(1);
    expect((await Product.findById(p.id)).stock).toBe(48);
  });
});

describe('payments (disabled)', () => {
  it('exposes disabled config and refuses every payment action', async () => {
    const { auth } = await makeUser();
    const cfg = await api().get('/api/v1/payments/config');
    expect(cfg.body.data.enabled).toBe(false);
    expect(cfg.body.data.keyId).toBeNull();

    const p = await makeProduct();
    const online = await placeOrder(auth, [{ productId: p.id, quantity: 1 }], { paymentMethod: 'Razorpay' });
    expect(online.status).toBe(503);
    expect((await Product.findById(p.id)).stock).toBe(10);

    const id = '64b7f1f1f1f1f1f1f1f1f1f1';
    expect((await api().post('/api/v1/payments/razorpay/order').set('Authorization', auth).send({ orderId: id })).status).toBe(503);
    expect(
      (
        await api()
          .post('/api/v1/payments/razorpay/verify')
          .set('Authorization', auth)
          .send({ orderId: id, razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'z' })
      ).status,
    ).toBe(503);
    expect((await api().post('/api/v1/payments/razorpay/webhook').send({ event: 'payment.captured' })).status).toBe(503);
  });
});

describe('RBAC', () => {
  it('blocks customers from admin and managers from admin-only routes', async () => {
    const cust = await makeUser();
    const mgr = await makeUser('Manager');
    expect((await api().get('/api/v1/admin/orders')).status).toBe(401);
    expect((await api().get('/api/v1/admin/orders').set('Authorization', cust.auth)).status).toBe(403);
    expect((await api().get('/api/v1/admin/coupons').set('Authorization', cust.auth)).status).toBe(403);
    expect((await api().get('/api/v1/admin/orders').set('Authorization', mgr.auth)).status).toBe(200);
    expect((await api().get('/api/v1/admin/settings').set('Authorization', mgr.auth)).status).toBe(403);
  });
});
