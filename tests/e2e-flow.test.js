import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Coupon from '../src/models/Coupon.js'
import Settings from '../src/models/Settings.js'
import { startDb, stopDb, makeUser, makeProduct, api } from './helpers.js'

beforeAll(() => startDb({ replSet: true }))
afterAll(stopDb)

const cookie = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('zaylo_rt=')).split(';')[0]

describe('end-to-end business flow', () => {
  it('guest cart → register → merge → address → coupon → COD order → admin fulfils → paid → invoice; admin edits reflect publicly', async () => {
    await Settings.create({ key: 'default', commerce: { shippingFee: 40, freeShippingThreshold: 500, codEnabled: true, codFee: 10, taxPercent: 0 } })
    const chips = await makeProduct({ name: 'Moon Lite', price: 60, mrp: 70, stock: 20, isPopular: true })
    const pasta = await makeProduct({ name: '5PM Pasta', price: 25, mrp: 25, stock: 5 })
    await Coupon.create({ code: 'WELCOME20', type: 'flat', value: 20, minOrder: 100, perUserLimit: 1 })
    const admin = await makeUser('Admin')

    // 1. Browse catalogue (public, server search)
    const list = await api().get('/api/v1/products?q=moon')
    expect(list.body.data.map((p) => p.id)).toEqual([chips.id])

    // 2. Guest quote — server prices
    const guestCart = [{ productId: chips.id, quantity: 2 }, { productId: pasta.id, quantity: 1 }]
    const guestQuote = await api().post('/api/v1/checkout/quote').send({ items: guestCart })
    expect(guestQuote.body.data).toMatchObject({ subtotal: 145, shippingFee: 40, codFee: 10, amount: 195 })

    // 3. Register + merge guest cart
    const reg = await api().post('/api/v1/auth/register').send({ name: 'Riya Shah', email: `riya${Date.now()}@test.dev`, password: 'goodpass123' })
    expect(reg.status).toBe(201)
    const auth = `Bearer ${reg.body.data.accessToken}`
    const merged = await api().post('/api/v1/me/cart/merge').set('Authorization', auth).send({ items: guestCart })
    expect(merged.body.data.subtotal).toBe(145)

    // 4. Refresh session via cookie works
    const refreshed = await api().post('/api/v1/auth/refresh').set('Cookie', cookie(reg))
    expect(refreshed.status).toBe(200)

    // 5. Address
    const addr = await api().post('/api/v1/me/addresses').set('Authorization', auth)
      .send({ name: 'Riya Shah', phone: '9811122233', line1: '4 Lake View', city: 'Pune', state: 'Maharashtra', pincode: '411001' })
    expect(addr.status).toBe(201)

    // 6. Coupon + quote
    const withCoupon = await api().post('/api/v1/checkout/quote').set('Authorization', auth).send({ items: guestCart, couponCode: 'welcome20' })
    expect(withCoupon.body.data).toMatchObject({ discount: 20, amount: 175 })

    // 7. Place COD order
    const order = await api().post('/api/v1/orders').set('Authorization', auth).set('Idempotency-Key', 'e2e-1')
      .send({ items: guestCart, addressId: addr.body.data.id, couponCode: 'WELCOME20', paymentMethod: 'COD' })
    expect(order.status).toBe(201)
    const o = order.body.data
    expect(o).toMatchObject({ amount: 175, status: 'Pending', paymentStatus: 'Pending', invoiceAvailable: false })
    expect((await api().get('/api/v1/me/cart').set('Authorization', auth)).body.data.items).toHaveLength(0)

    // 8. Stock decremented; order visible to customer and admin
    const pastaAfter = await api().get(`/api/v1/products/${pasta.slug}`)
    expect(pastaAfter.body.data.product.stock).toBe(4)
    expect((await api().get('/api/v1/orders/me').set('Authorization', auth)).body.data[0].id).toBe(o.id)
    const adminList = await api().get('/api/v1/admin/orders?status=Pending').set('Authorization', admin.auth)
    expect(adminList.body.data.map((x) => x.id)).toContain(o.id)

    // 9. Admin fulfils; payment stays pending until COD is collected
    for (const status of ['Confirmed', 'Packed']) {
      expect((await api().patch(`/api/v1/admin/orders/${o.id}/status`).set('Authorization', admin.auth).send({ status })).status).toBe(200)
    }
    const shipped = await api().patch(`/api/v1/admin/orders/${o.id}/status`).set('Authorization', admin.auth)
      .send({ status: 'Shipped', courier: 'Delhivery', trackingNumber: 'DL123' })
    expect(shipped.body.data).toMatchObject({ status: 'Shipped', paymentStatus: 'Pending', trackingNumber: 'DL123', canCancel: false })
    expect((await api().post(`/api/v1/orders/${o.id}/cancel`).set('Authorization', auth).send({})).status).toBe(400)
    await api().patch(`/api/v1/admin/orders/${o.id}/status`).set('Authorization', admin.auth).send({ status: 'Delivered' })
    const paid = await api().patch(`/api/v1/admin/orders/${o.id}/payment`).set('Authorization', admin.auth).send({ action: 'cod-collected' })
    expect(paid.body.data).toMatchObject({ status: 'Delivered', paymentStatus: 'Paid' })

    // 10. Customer sees tracking + invoice
    const mine = await api().get(`/api/v1/orders/${o.id}`).set('Authorization', auth)
    expect(mine.body.data).toMatchObject({ status: 'Delivered', paymentStatus: 'Paid', invoiceAvailable: true, courier: 'Delhivery' })
    const inv = await api().get(`/api/v1/orders/${o.id}/invoice`).set('Authorization', auth)
    expect(inv.status).toBe(200)
    expect(inv.text).toContain('WELCOME20')

    // 11. Coupon is single-use per customer
    const again = await api().post('/api/v1/checkout/quote').set('Authorization', auth).send({ items: guestCart, couponCode: 'WELCOME20' })
    expect(again.body.data.couponError).toMatch(/already used/i)

    // 12. Admin edits price → reflected on public catalogue and /home
    await api().patch(`/api/v1/admin/products/${chips.id}`).set('Authorization', admin.auth).send({ price: 55 })
    expect((await api().get(`/api/v1/products/${chips.slug}`)).body.data.product.price).toBe(55)
    const home = await api().get('/api/v1/home')
    expect(home.body.data.popularProducts.find((p) => p.id === chips.id).price).toBe(55)

    // 13. Dashboard separates booked vs collected revenue
    const dash = await api().get('/api/v1/admin/dashboard').set('Authorization', admin.auth)
    expect(dash.status).toBe(200)
    expect(dash.body.data.collectedRevenue).toBe(175)
  })
})
