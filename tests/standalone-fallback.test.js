import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Product from '../src/models/Product.js';
import Order from '../src/models/Order.js';
import database from '../src/config/database.js';
import { startDb, stopDb, resetDb, makeUser, makeProduct, placeOrder } from './helpers.js';

// Standalone mongod (no replica set) → no transactions; compensation path must hold.
beforeAll(() => startDb({ replSet: false }));
afterAll(stopDb);
beforeEach(resetDb);

describe('standalone MongoDB fallback', () => {
  it('reports no transaction support', () => {
    expect(database.supportsTransactions).toBe(false);
  });

  it('still never oversells and compensates partial decrements', async () => {
    const a = await makeProduct({ stock: 3 });
    const b = await makeProduct({ stock: 100 });
    const users = await Promise.all(Array.from({ length: 6 }, () => makeUser()));
    const results = await Promise.all(
      users.map((u) =>
        placeOrder(u.auth, [
          { productId: b.id, quantity: 2 },
          { productId: a.id, quantity: 1 },
        ]),
      ),
    );
    const ok = results.filter((r) => r.status === 201).length;
    expect(ok).toBe(3);
    expect((await Product.findById(a.id)).stock).toBe(0);
    // b decremented only for successful orders (failed ones restored)
    expect((await Product.findById(b.id)).stock).toBe(100 - ok * 2);
    expect(await Order.countDocuments()).toBe(3);
  });
});
