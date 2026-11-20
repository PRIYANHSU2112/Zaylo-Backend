import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { startDb, stopDb, resetDb, makeUser, makeProduct, api } from './helpers.js';
import { verifyHmac } from '../src/services/PaymentService.js';
import crypto from 'node:crypto';

beforeAll(() => startDb({ replSet: true }));
afterAll(stopDb);
beforeEach(resetDb);

const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('zaylo_rt='));

describe('auth', () => {
  it('admin login still returns a long-lived accessToken in the body', async () => {
    const { user, password } = await makeUser('Admin');
    const res = await api().post('/api/v1/auth/login').send({ email: user.email, password, role: 'Admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    const { exp, iat } = jwt.decode(res.body.data.accessToken);
    expect(exp - iat).toBeGreaterThan(24 * 3600);
  });

  it('customer: register → refresh rotation → reuse detection → logout', async () => {
    const reg = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Asha', email: `asha${Date.now()}@test.dev`, password: 'secret123' });
    expect(reg.status).toBe(201);
    const c1 = cookieOf(reg);
    expect(c1).toMatch(/HttpOnly/i);
    const { exp, iat } = jwt.decode(reg.body.data.accessToken);
    expect(exp - iat).toBe(15 * 60);
    expect(reg.body.data.user.password).toBeUndefined();

    const r1 = await api().post('/api/v1/auth/refresh').set('Cookie', c1.split(';')[0]);
    expect(r1.status).toBe(200);
    const c2 = cookieOf(r1);
    expect(c2).not.toBe(c1);

    // Re-using the rotated token revokes the family
    const reuse = await api().post('/api/v1/auth/refresh').set('Cookie', c1.split(';')[0]);
    expect(reuse.status).toBe(401);
    const afterReuse = await api().post('/api/v1/auth/refresh').set('Cookie', c2.split(';')[0]);
    expect(afterReuse.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const { user, password } = await makeUser();
    const login = await api().post('/api/v1/auth/login').send({ email: user.email, password });
    const c = cookieOf(login).split(';')[0];
    expect((await api().post('/api/v1/auth/logout').set('Cookie', c)).status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', c)).status).toBe(401);
  });

  it('rejects wrong passwords and password change requires the current one', async () => {
    const { user, password, auth } = await makeUser();
    expect((await api().post('/api/v1/auth/login').send({ email: user.email, password: 'nope1234' })).status).toBe(401);
    const bad = await api().patch('/api/v1/me/password').set('Authorization', auth).send({ currentPassword: 'x', newPassword: 'newpass123' });
    expect(bad.status).toBe(400);
    const ok = await api().patch('/api/v1/me/password').set('Authorization', auth).send({ currentPassword: password, newPassword: 'newpass123' });
    expect(ok.status).toBe(200);
    expect((await api().post('/api/v1/auth/login').send({ email: user.email, password: 'newpass123' })).status).toBe(200);
  });
});

describe('cart, wishlist, addresses', () => {
  it('cart is server-priced, filters invalid products and merges guest carts', async () => {
    const { auth } = await makeUser();
    const p = await makeProduct({ price: 30 });
    const gone = await makeProduct({ status: 'Inactive' });
    const set = await api()
      .put('/api/v1/me/cart')
      .set('Authorization', auth)
      .send({ items: [{ productId: p.id, quantity: 2 }, { productId: gone.id, quantity: 1 }] });
    expect(set.status).toBe(200);
    expect(set.body.data.items).toHaveLength(1);
    expect(set.body.data.subtotal).toBe(60);

    const merged = await api().post('/api/v1/me/cart/merge').set('Authorization', auth).send({ items: [{ productId: p.id, quantity: 3 }] });
    expect(merged.body.data.items[0].quantity).toBe(5);
  });

  it('wishlist add/remove', async () => {
    const { auth } = await makeUser();
    const p = await makeProduct();
    const add = await api().post(`/api/v1/me/wishlist/${p.id}`).set('Authorization', auth);
    expect(add.body.data.map((x) => x.id)).toEqual([p.id]);
    const del = await api().delete(`/api/v1/me/wishlist/${p.id}`).set('Authorization', auth);
    expect(del.body.data).toEqual([]);
  });

  it('validates structured addresses and keeps one default', async () => {
    const { auth } = await makeUser();
    const bad = await api().post('/api/v1/me/addresses').set('Authorization', auth).send({ name: 'A', line1: 'x' });
    expect(bad.status).toBe(400);
    const body = { name: 'Asha K', phone: '9876543210', line1: '1 Main St', city: 'Delhi', state: 'Delhi', pincode: '110001' };
    const a1 = await api().post('/api/v1/me/addresses').set('Authorization', auth).send(body);
    expect(a1.body.data.isDefault).toBe(true);
    const a2 = await api().post('/api/v1/me/addresses').set('Authorization', auth).send({ ...body, isDefault: true });
    const list = await api().get('/api/v1/me/addresses').set('Authorization', auth);
    expect(list.body.data.filter((a) => a.isDefault).map((a) => a.id)).toEqual([a2.body.data.id]);
  });
});

describe('catalog', () => {
  it('lists only active products with pagination meta', async () => {
    await makeProduct({ name: 'Moon Lite' });
    await makeProduct({ name: 'Hidden', status: 'Inactive' });
    const res = await api().get('/api/v1/products?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.name)).toEqual(['Moon Lite']);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('home', () => {
  it('falls back to newest active products when none are flagged popular', async () => {
    const { invalidateHomeCaches } = await import('../src/services/HomeService.js')
    invalidateHomeCaches()
    await makeProduct({ name: 'Plain One' })
    await makeProduct({ name: 'Hidden', status: 'Inactive' })
    const res = await api().get('/api/v1/home')
    expect(res.body.data.popularProducts.map((p) => p.name)).toEqual(['Plain One'])
  });
});

describe('razorpay signature helper', () => {
  it('accepts only the exact HMAC', () => {
    const sig = crypto.createHmac('sha256', 'sec').update('o|p').digest('hex');
    expect(verifyHmac('o|p', sig, 'sec')).toBe(true);
    expect(verifyHmac('o|p', sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0'), 'sec')).toBe(false);
    expect(verifyHmac('o|p', sig, '')).toBe(false);
  });
});
