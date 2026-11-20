import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import mongoose from 'mongoose'
import Product from '../src/models/Product.js'
import Promo from '../src/models/Promo.js'
import Settings from '../src/models/Settings.js'
import CmsContent from '../src/models/CmsContent.js'
import { invalidateHomeCaches } from '../src/services/HomeService.js'
import {
  backupDatabase,
  restoreBackup,
  resetContent,
  importDraftProducts,
  isLocalHost,
  redactUri,
  PACK_PRODUCTS,
} from '../src/scripts/dbTools.js'
import { startDb, stopDb, resetDb, makeUser, makeProduct, placeOrder, api } from './helpers.js'

const ASSETS = path.resolve('seed-assets/products')

beforeAll(() => startDb({ replSet: true }))
afterAll(stopDb)
beforeEach(async () => {
  await resetDb()
  await Promo.deleteMany({})
  invalidateHomeCaches()
})

describe('db tools', () => {
  it('redacts credentials and detects local hosts', () => {
    expect(redactUri('mongodb+srv://user:pass@cluster0.x.mongodb.net/zaylo?retryWrites=true')).toBe('mongodb+srv://***@cluster0.x.mongodb.net/zaylo')
    expect(isLocalHost('mongodb://127.0.0.1:27017/zaylo')).toBe(true)
    expect(isLocalHost('mongodb+srv://u:p@cluster0.x.mongodb.net/zaylo')).toBe(false)
  })

  it('backup is verified, reset keeps users/settings/indexes, restore brings data back', async () => {
    const db = mongoose.connection.db
    await makeUser('Admin')
    const p = await makeProduct()
    await Settings.create({ key: 'default', whatsapp: '123' })
    await CmsContent.create({ key: 'home', about: { story: 'demo story' }, testimonials: [{ name: 'Fake', text: 'x' }] })
    await Promo.create({ title: 'Old', slot: 'hero' })
    const indexesBefore = await db.collection('products').indexes()

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaylo-backup-'))
    const { dir: backupDir, counts } = await backupDatabase(db, dir)
    expect(counts.products).toBe(1)
    const manifest = JSON.parse(await fs.readFile(path.join(backupDir, 'manifest.json'), 'utf8'))
    expect(manifest.counts.users).toBe(1)

    const dry = await resetContent(db, { dryRun: true })
    expect(dry.products).toBe(1)
    expect(await Product.countDocuments()).toBe(1)

    await resetContent(db)
    expect(await Product.countDocuments()).toBe(0)
    expect(await Promo.countDocuments()).toBe(0)
    expect(await db.collection('users').countDocuments()).toBe(1)
    expect((await Settings.findOne({ key: 'default' })).whatsapp).toBe('123')
    const cms = await CmsContent.findOne({ key: 'home' }).lean()
    expect(cms.about.story).toBe('')
    expect(cms.testimonials).toEqual([])
    expect((await db.collection('products').indexes()).map((i) => i.name).sort()).toEqual(indexesBefore.map((i) => i.name).sort())

    await restoreBackup(db, backupDir)
    expect((await Product.findById(p._id)).name).toBe(p.name)
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('imports pack images as Inactive drafts with only printed facts; idempotent; dry-run uploads nothing', async () => {
    const uploads = []
    const storage = {
      uploadFile: async (file, folder) => {
        uploads.push({ name: file.originalname, folder, type: file.mimetype })
        return { url: `https://cdn.test/${folder}/${file.originalname}` }
      },
    }
    const dry = await importDraftProducts(Product, storage, ASSETS, { dryRun: true })
    expect(dry).toHaveLength(PACK_PRODUCTS.length)
    expect(uploads).toHaveLength(0)
    expect(await Product.countDocuments()).toBe(0)

    await importDraftProducts(Product, storage, ASSETS)
    expect(uploads).toHaveLength(7)
    expect(uploads.every((u) => u.folder === 'products' && u.type === 'image/webp')).toBe(true)
    const drafts = await Product.find().lean()
    expect(drafts).toHaveLength(7)
    for (const d of drafts) {
      expect(d).toMatchObject({ status: 'Inactive', stock: 0, mrp: 5, price: 5, category: '', description: '', weight: '' })
      expect(d.image).toMatch(/^https:\/\/cdn\.test\/products\//)
    }
    // drafts are not public
    expect((await api().get('/api/v1/products')).body.data).toHaveLength(0)

    await importDraftProducts(Product, storage, ASSETS)
    expect(uploads).toHaveLength(7) // no re-upload
    expect(await Product.countDocuments()).toBe(7)
  }, 60_000)
})

describe('products (admin)', () => {
  it('validates SKU uniqueness, price ≤ MRP, publish requirements; no protein; no fake rating', async () => {
    const { auth } = await makeUser('Admin')
    const base = { name: 'Zig Zac', price: 5, mrp: 5, sku: 'zz-001', category: 'namkeen', image: 'https://cdn.test/a.webp' }

    expect((await api().post('/api/v1/admin/products').set('Authorization', auth).send({ ...base, price: 9 })).status).toBe(400)
    const draft = await api().post('/api/v1/admin/products').set('Authorization', auth).send({ name: 'Draft', price: 5, mrp: 5, status: 'Inactive' })
    expect(draft.status).toBe(201)
    const publish = await api().patch(`/api/v1/admin/products/${draft.body.data.id}/status`).set('Authorization', auth).send({ status: 'Active' })
    expect(publish.status).toBe(400)
    expect(publish.body.message).toMatch(/category/)

    const ok = await api().post('/api/v1/admin/products').set('Authorization', auth)
      .send({ ...base, nutrition: { calories: 120, protein: '6g' }, rating: 5, reviewCount: 999, isFeatured: true })
    expect(ok.status).toBe(201)
    expect(ok.body.data.sku).toBe('ZZ-001')
    expect(ok.body.data.rating).toBe(0)
    expect(ok.body.data.reviewCount).toBe(0)

    const dup = await api().post('/api/v1/admin/products').set('Authorization', auth).send({ ...base, name: 'Other', sku: 'ZZ-001' })
    expect(dup.status).toBe(409)

    const pub = await api().get('/api/v1/products/zig-zac')
    expect(JSON.stringify(pub.body.data)).not.toMatch(/protein/i)
    expect(pub.body.data.product.images).toEqual(['https://cdn.test/a.webp'])

    const featured = await api().get('/api/v1/products?featured=true')
    expect(featured.body.data.map((p) => p.slug)).toEqual(['zig-zac'])
  })
})

describe('banners', () => {
  it('only live, scheduled banners are public; grouped by placement; legacy slots mapped', async () => {
    const day = 86400_000
    await Promo.create([
      { title: 'Hero now', slot: 'hero', imageUrl: 'd.webp', mobileImageUrl: 'm.webp' },
      { title: 'Future', slot: 'hero', startsAt: new Date(Date.now() + day) },
      { title: 'Expired', slot: 'hero', endsAt: new Date(Date.now() - day) },
      { title: 'Off', slot: 'hero', status: 'Inactive' },
      { title: 'Legacy dealer', slot: 'home-dealer' },
      { title: 'Products top', slot: 'products' },
    ])
    const home = (await api().get('/api/v1/home')).body.data
    expect(home.banners.hero.map((b) => b.title)).toEqual(['Hero now'])
    expect(home.banners.hero[0].mobileImageUrl).toBe('m.webp')
    expect(home.banners['home-bottom'].map((b) => b.title)).toEqual(['Legacy dealer'])

    const products = await api().get('/api/v1/banners?placement=products')
    expect(products.body.data.banners.map((b) => b.title)).toEqual(['Products top'])
  })

  it('admin validates schedule and requires a heading or image', async () => {
    const { auth } = await makeUser('Admin')
    const empty = await api().post('/api/v1/admin/promos').set('Authorization', auth).send({ slot: 'hero' })
    expect(empty.status).toBe(400)
    const badDates = await api().post('/api/v1/admin/promos').set('Authorization', auth)
      .send({ title: 'X', slot: 'hero', startsAt: '2030-02-01', endsAt: '2030-01-01' })
    expect(badDates.status).toBe(400)
    const ok = await api().post('/api/v1/admin/promos').set('Authorization', auth)
      .send({ title: 'Diwali', slot: 'home-middle', imageUrl: 'https://cdn.test/b.webp' })
    expect(ok.status).toBe(201)
  })
})

describe('home sections from real data', () => {
  it('bestSellers is empty without sales and reflects real orders; newArrivals newest first', async () => {
    const a = await makeProduct({ name: 'A' })
    const b = await makeProduct({ name: 'B' })
    // createdAt is immutable through mongoose; set it on the raw collection
    await Product.collection.updateOne({ _id: b._id }, { $set: { createdAt: new Date(Date.now() + 1000) } })
    let home = (await api().get('/api/v1/home')).body.data
    expect(home.bestSellers).toEqual([])
    expect(home.newArrivals[0].name).toBe('B')

    const { auth } = await makeUser()
    await placeOrder(auth, [{ productId: a.id, quantity: 3 }])
    invalidateHomeCaches()
    home = (await api().get('/api/v1/home')).body.data
    expect(home.bestSellers.map((p) => p.id)).toEqual([a.id])
    expect(b.id).toBeTruthy()
  })
})

describe('upload delete', () => {
  it('is staff-only and refuses URLs outside the media bucket', async () => {
    const cust = await makeUser()
    const admin = await makeUser('Admin')
    expect((await api().delete('/api/v1/admin/uploads').set('Authorization', cust.auth).send({ url: 'https://x.test/a.png' })).status).toBe(403)
    const res = await api().delete('/api/v1/admin/uploads').set('Authorization', admin.auth).send({ url: 'https://evil.example.com/products/a.png' })
    expect(res.status).toBe(400)
  })
})

describe('admin password recovery', () => {
  it('updates or creates a staff account that can then log in; rejects weak input', async () => {
    const { setStaffPassword } = await import('../src/scripts/dbTools.js')
    const { default: User } = await import('../src/models/User.js')
    const { default: RefreshToken } = await import('../src/models/RefreshToken.js')
    const email = `boss${Date.now()}@test.dev`

    await expect(setStaffPassword(User, RefreshToken, { email, password: 'LongEnough123' })).rejects.toThrow(/--create/)
    await expect(setStaffPassword(User, RefreshToken, { email, password: 'short', create: true })).rejects.toThrow(/10 characters/)

    expect(await setStaffPassword(User, RefreshToken, { email, password: 'LongEnough123', create: true })).toBe('created')
    let login = await api().post('/api/v1/auth/login').send({ email, password: 'LongEnough123', role: 'Admin' })
    expect(login.status).toBe(200)

    expect(await setStaffPassword(User, RefreshToken, { email, password: 'EvenLonger4567' })).toBe('updated')
    login = await api().post('/api/v1/auth/login').send({ email, password: 'LongEnough123', role: 'Admin' })
    expect(login.status).toBe(401)
    login = await api().post('/api/v1/auth/login').send({ email, password: 'EvenLonger4567', role: 'Admin' })
    expect(login.status).toBe(200)
  })
})
