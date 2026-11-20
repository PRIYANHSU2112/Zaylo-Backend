import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Product from '../src/models/Product.js'
import Bundle from '../src/models/Bundle.js'
import Order from '../src/models/Order.js'
import { invalidateHomeCaches } from '../src/services/HomeService.js'
import { startDb, stopDb, resetDb, makeUser, makeProduct, placeOrder, api } from './helpers.js'

beforeAll(() => startDb({ replSet: true }))
afterAll(stopDb)
beforeEach(async () => {
  await resetDb()
  invalidateHomeCaches()
})

async function makeBundle(products, over = {}) {
  return Bundle.create({ name: 'Party Pack', price: 99, mrp: 150, productIds: products.map((p) => p._id), status: 'Active', ...over })
}

describe('bundle packs', () => {
  it('charges the bundle price (not the sum) and decrements every component', async () => {
    const a = await makeProduct({ price: 60, stock: 10 })
    const b = await makeProduct({ price: 60, stock: 10 })
    const bundle = await makeBundle([a, b, b]) // b counted twice per pack
    const { auth } = await makeUser()

    const quote = await api().post('/api/v1/checkout/quote').send({ items: [{ bundleId: bundle.id, quantity: 2 }] })
    expect(quote.body.data).toMatchObject({ subtotal: 198 })
    expect(quote.body.data.items[0]).toMatchObject({ kind: 'bundle', price: 99, mrp: 150, stock: 5 })

    const res = await placeOrder(auth, [{ bundleId: bundle.id, quantity: 2, price: 1 }])
    expect(res.status).toBe(201)
    expect(res.body.data.subtotal).toBe(198)
    expect(res.body.data.items[0].kind).toBe('bundle')
    expect((await Product.findById(a.id)).stock).toBe(8)
    expect((await Product.findById(b.id)).stock).toBe(6)

    // cancel restores components exactly once
    await api().post(`/api/v1/orders/${res.body.data.id}/cancel`).set('Authorization', auth).send({})
    await api().post(`/api/v1/orders/${res.body.data.id}/cancel`).set('Authorization', auth).send({})
    expect((await Product.findById(a.id)).stock).toBe(10)
    expect((await Product.findById(b.id)).stock).toBe(10)
  })

  it('checks stock on the aggregate of singles + bundle components', async () => {
    const a = await makeProduct({ stock: 3 })
    const bundle = await makeBundle([a])
    const { auth } = await makeUser()
    const res = await placeOrder(auth, [
      { productId: a.id, quantity: 2 },
      { bundleId: bundle.id, quantity: 2 },
    ])
    expect(res.status).toBe(400)
    expect((await Product.findById(a.id)).stock).toBe(3)
  })

  it('never oversells under concurrent bundle orders', async () => {
    const a = await makeProduct({ stock: 4 })
    const bundle = await makeBundle([a, a]) // 2 units per pack → 2 packs max
    const users = await Promise.all(Array.from({ length: 5 }, () => makeUser()))
    const results = await Promise.all(users.map((u) => placeOrder(u.auth, [{ bundleId: bundle.id, quantity: 1 }])))
    expect(results.filter((r) => r.status === 201)).toHaveLength(2)
    expect((await Product.findById(a.id)).stock).toBe(0)
    expect(await Order.countDocuments()).toBe(2)
  })

  it('rejects inactive bundles and bundles containing inactive products', async () => {
    const a = await makeProduct()
    const off = await makeProduct({ status: 'Inactive' })
    const inactive = await makeBundle([a], { status: 'Inactive' })
    const broken = await makeBundle([a, off])
    const { auth } = await makeUser()
    expect((await placeOrder(auth, [{ bundleId: inactive.id, quantity: 1 }])).status).toBe(400)
    expect((await placeOrder(auth, [{ bundleId: broken.id, quantity: 1 }])).status).toBe(400)

    const home = await api().get('/api/v1/home')
    expect(home.body.data.bundles).toEqual([])
  })

  it('home exposes purchasable packs with availability; cart stores bundles', async () => {
    const a = await makeProduct({ stock: 7 })
    const bundle = await makeBundle([a])
    const home = await api().get('/api/v1/home')
    expect(home.body.data.bundles[0]).toMatchObject({ id: bundle.id, kind: 'bundle', price: 99, stock: 7 })

    const { auth } = await makeUser()
    const cart = await api()
      .put('/api/v1/me/cart')
      .set('Authorization', auth)
      .send({ items: [{ bundleId: bundle.id, quantity: 1 }, { productId: a.id, quantity: 1 }] })
    expect(cart.status).toBe(200)
    expect(cart.body.data.items.map((i) => i.kind).sort()).toEqual(['bundle', 'product'])
    const merged = await api().post('/api/v1/me/cart/merge').set('Authorization', auth).send({ items: [{ bundleId: bundle.id, quantity: 2 }] })
    expect(merged.body.data.items.find((i) => i.kind === 'bundle').quantity).toBe(3)
  })

  it('admin: price above MRP rejected; list shows availability', async () => {
    const admin = await makeUser('Admin')
    const a = await makeProduct({ stock: 9 })
    const bad = await api().post('/api/v1/admin/bundles').set('Authorization', admin.auth).send({ name: 'X', price: 200, mrp: 100, productIds: [a.id] })
    expect(bad.status).toBe(400)
    const empty = await api().post('/api/v1/admin/bundles').set('Authorization', admin.auth).send({ name: 'X', price: 50, mrp: 100, productIds: [] })
    expect(empty.status).toBe(400)
    await api().post('/api/v1/admin/bundles').set('Authorization', admin.auth).send({ name: 'Ok', price: 50, mrp: 100, productIds: [a.id] })
    const list = await api().get('/api/v1/admin/bundles').set('Authorization', admin.auth)
    expect(list.body.data[0]).toMatchObject({ availability: 9, purchasable: true })
  })
})
