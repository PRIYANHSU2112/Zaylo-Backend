import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';
import App from '../src/app.js';
import database from '../src/config/database.js';
import User from '../src/models/User.js';
import Product from '../src/models/Product.js';
import AuthService from '../src/services/AuthService.js';

let server;
export const app = new App().express;
export const api = () => request(app);

/** Start an in-memory MongoDB. `replSet: true` enables real transactions. */
export async function startDb({ replSet = true } = {}) {
  server = replSet
    ? await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
    : await MongoMemoryServer.create();
  await mongoose.connect(server.getUri(), { dbName: 'zaylo-test' });
  await database.detectTransactionSupport();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function stopDb() {
  await mongoose.disconnect();
  await server?.stop();
}

export async function resetDb() {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections)
      .filter((c) => c.collectionName !== 'products' && c.collectionName !== 'users')
      .map((c) => c.deleteMany({})),
  );
  await Product.deleteMany({});
  await User.deleteMany({});
}

let n = 0;
export async function makeUser(role = 'Customer', extra = {}) {
  n += 1;
  const password = 'Passw0rd!';
  const user = await User.create({
    name: `${role} ${n}`,
    email: `${role.toLowerCase()}${n}-${Date.now()}@test.dev`,
    password,
    role,
    phone: '9876543210',
    ...extra,
  });
  return { user, password, token: AuthService.signAccessToken(user), auth: `Bearer ${AuthService.signAccessToken(user)}` };
}

export async function makeProduct(over = {}) {
  n += 1;
  return Product.create({
    slug: `p-${n}-${Date.now()}`,
    name: `Product ${n}`,
    category: 'namkeen',
    price: 50,
    mrp: 60,
    stock: 10,
    status: 'Active',
    ...over,
  });
}

export const ADDRESS = {
  name: 'Test Buyer',
  phone: '9876543210',
  line1: '12 MG Road',
  city: 'Sonipat',
  state: 'Haryana',
  pincode: '131001',
};

let keySeq = 0;
export const idemKey = () => `test-key-${Date.now()}-${(keySeq += 1)}`;

export function placeOrder(auth, items, { key = idemKey(), ...body } = {}) {
  return api()
    .post('/api/v1/orders')
    .set('Authorization', auth)
    .set('Idempotency-Key', key)
    .send({ items, address: ADDRESS, paymentMethod: 'COD', ...body });
}
