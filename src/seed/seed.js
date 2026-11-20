/**
 * npm run seed — bootstrap a fresh database with ONLY system records:
 *   - Admin / Manager staff accounts (if missing)
 *   - Settings document (if missing; empty contact info — fill it in Admin → Settings)
 *   - Empty CMS document (if missing)
 *
 * It never creates demo products, categories, banners, blogs, reviews or contact
 * details, and never overwrites existing settings. Real catalogue content is added
 * through the Admin panel (or `npm run db:import-products` for the pack images).
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import config from '../config/index.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import CmsContent from '../models/CmsContent.js';
import logger from '../utils/logger.js';

dotenv.config();

function seedPassword(envKey, devFallback) {
  const v = process.env[envKey];
  if (v && v.trim()) return v.trim();
  if (config.isProduction) {
    throw new Error(`${envKey} is required to seed staff users in production`);
  }
  return devFallback; // development-only default
}

async function ensureUser(email, payload) {
  if (await User.exists({ email })) return;
  await User.create(payload);
  logger.info(`Created ${payload.role} ${email}`);
}

async function seed() {
  await mongoose.connect(config.mongodbUri);

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@zaylo.com').toLowerCase();
  const managerEmail = (process.env.SEED_MANAGER_EMAIL || 'manager@zaylo.com').toLowerCase();

  await ensureUser(adminEmail, {
    name: 'Zaylo Admin',
    email: adminEmail,
    password: seedPassword('SEED_ADMIN_PASSWORD', 'Admin123!'),
    role: 'Admin',
    status: 'Active',
  });
  await ensureUser(managerEmail, {
    name: 'Zaylo Manager',
    email: managerEmail,
    password: seedPassword('SEED_MANAGER_PASSWORD', 'Manager123!'),
    role: 'Manager',
    status: 'Active',
  });

  // Insert-only: never overwrite settings or CMS content an admin has edited.
  await Settings.updateOne({ key: 'default' }, { $setOnInsert: { key: 'default' } }, { upsert: true });
  await CmsContent.updateOne({ key: 'home' }, { $setOnInsert: { key: 'home' } }, { upsert: true });

  logger.info('Seed complete (system records only — no demo content)');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
