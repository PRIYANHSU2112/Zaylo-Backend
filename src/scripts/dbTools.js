/**
 * Database maintenance tools (backup / content reset / draft product import).
 * Pure functions over an open mongoose connection so they can be tested against
 * an in-memory MongoDB. CLI wrappers live in ./backup.js, ./reset.js, ./importProducts.js.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import sharp from 'sharp';

const { EJSON } = mongoose.mongo.BSON;

/** Collections cleared by the content reset (users, settings and indexes are kept). */
export const RESET_COLLECTIONS = [
  'products',
  'categories',
  'bundles',
  'promos',
  'homelandingimages',
  'announcements',
  'blogs',
  'galleries',
  'contacts',
  'dealers',
  'bulkorders',
  'orders',
  'notifications',
  'coupons',
  'refreshtokens',
];

/** CMS demo fields emptied by the reset. */
export const CMS_DEMO_FIELDS = {
  'about.story': '',
  'about.mission': '',
  'about.vision': '',
  'about.timeline': [],
  'about.values': [],
  'about.awards': [],
  testimonials: [],
  trustedBy: [],
  faqs: [],
  dealerFaqs: [],
  dealerBenefits: [],
  whyChoose: [],
  trustStats: [],
};

/** Hide credentials before printing a connection string. */
export function redactUri(uri = '') {
  return uri.replace(/\/\/([^@/]*)@/, '//***@').split('?')[0];
}

export function isLocalHost(uri = '') {
  return /^mongodb:\/\/(\*\*\*@)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(redactUri(uri));
}

export async function collectionCounts(db) {
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  const counts = {};
  for (const n of names) counts[n] = await db.collection(n).countDocuments();
  return counts;
}

/**
 * Export every collection to `<dir>/<collection>.json` (Extended JSON, lossless
 * ObjectIds/dates) + manifest.json, then re-read and verify document counts.
 * @returns {Promise<{dir: string, counts: Record<string, number>}>}
 */
export async function backupDatabase(db, rootDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(rootDir, `${db.databaseName}-${stamp}`);
  await fs.mkdir(dir, { recursive: true });

  const counts = await collectionCounts(db);
  for (const name of Object.keys(counts)) {
    const docs = await db.collection(name).find({}).toArray();
    await fs.writeFile(path.join(dir, `${name}.json`), EJSON.stringify(docs, { relaxed: false }), 'utf8');
  }
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ database: db.databaseName, createdAt: new Date().toISOString(), counts }, null, 2),
  );

  // Verify: every file parses and matches the counted documents
  for (const [name, expected] of Object.entries(counts)) {
    const parsed = EJSON.parse(await fs.readFile(path.join(dir, `${name}.json`), 'utf8'));
    if (!Array.isArray(parsed) || parsed.length < expected) {
      throw new Error(`Backup verification failed for "${name}" (expected ${expected}, got ${parsed?.length})`);
    }
  }
  return { dir, counts };
}

/** Restore a backup directory created by backupDatabase (replaces listed collections). */
export async function restoreBackup(db, dir) {
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
  for (const name of Object.keys(manifest.counts)) {
    const docs = EJSON.parse(await fs.readFile(path.join(dir, `${name}.json`), 'utf8'));
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs);
  }
  return manifest;
}

/**
 * Clear demo/business content. Keeps users (carts/wishlists emptied), settings and
 * all indexes (deleteMany, never drop). Caller must back up first.
 */
export async function resetContent(db, { dryRun = false } = {}) {
  const report = {};
  for (const name of RESET_COLLECTIONS) {
    const exists = (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
    if (!exists) continue;
    report[name] = await db.collection(name).countDocuments();
    if (!dryRun) await db.collection(name).deleteMany({});
  }
  if (!dryRun) {
    await db.collection('cmscontents').updateMany({}, { $set: CMS_DEMO_FIELDS });
    await db.collection('users').updateMany({}, { $set: { cart: [], wishlist: [] } });
  }
  return report;
}

// ---------------------------------------------------------------------------
// Draft product import (only facts printed on the pack — nothing invented)
// ---------------------------------------------------------------------------

/** Text taken verbatim from the pack artwork; MRP ₹5 is printed on every pack. */
export const PACK_PRODUCTS = [
  { file: 'zig-zac.png', slug: 'zig-zac', name: 'Zig Zac', flavor: 'Spicy Flavour', tagline: 'DeLicious' },
  { file: 'salted-pipe.png', slug: 'salted-pipe', name: 'Salted Pipe', flavor: 'Salted', tagline: 'Spicy & Yummy Yummy Taste' },
  { file: 'noodles.png', slug: 'noodles', name: 'Noodles', flavor: '', tagline: 'Crispy & Crunchy' },
  { file: '5pm-pasta.png', slug: '5pm-pasta', name: '5PM Italian Pastaa', flavor: 'Peri Peri Masala', tagline: '' },
  { file: 'moon-lite.png', slug: 'moon-lite', name: 'Moon Lite', flavor: '', tagline: 'Crispy Delight' },
  { file: 'scoops.png', slug: 'scoops', name: 'Scoops', flavor: 'Masala Flavours', tagline: '' },
  { file: 'dhamal-chokdi.png', slug: 'dhamal-chokdi', name: 'Dhamal Chokdi', flavor: '', tagline: '' },
];
export const PACK_MRP = 5;

/** Trim screenshot bars / borders and convert to WebP (max 1200px). */
export async function preparePackImage(filePath) {
  const trimmed = await sharp(filePath).trim({ background: '#000000', threshold: 30 }).toBuffer();
  return sharp(trimmed)
    .trim({ threshold: 8 })
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
}

/**
 * Upload pack images and upsert DRAFT products (status Inactive, stock 0, no category,
 * description, weight or nutrition — the admin fills those in before publishing).
 * Idempotent by slug; an existing product's image is only set if it has none.
 * @param {{ uploadFile: Function }} storage storage service (mockable)
 */
export async function importDraftProducts(Product, storage, assetsDir, { dryRun = false } = {}) {
  const results = [];
  for (const p of PACK_PRODUCTS) {
    const filePath = path.join(assetsDir, p.file);
    await fs.access(filePath);
    const existing = await Product.findOne({ slug: p.slug }).lean();
    if (existing?.image) {
      results.push({ slug: p.slug, action: 'skipped (already has an image)' });
      continue;
    }
    if (dryRun) {
      results.push({ slug: p.slug, action: existing ? 'would set image' : 'would create draft' });
      continue;
    }
    const buffer = await preparePackImage(filePath);
    const uploaded = await storage.uploadFile(
      { buffer, originalname: `${p.slug}.webp`, mimetype: 'image/webp', size: buffer.length },
      'products',
      { compress: false },
    );
    if (existing) {
      await Product.updateOne({ _id: existing._id }, { $set: { image: uploaded.url, images: [uploaded.url] } });
      results.push({ slug: p.slug, action: 'image set', url: uploaded.url });
    } else {
      await Product.create({
        slug: p.slug,
        name: p.name,
        flavor: p.flavor,
        tagline: p.tagline,
        price: PACK_MRP,
        mrp: PACK_MRP,
        stock: 0,
        status: 'Inactive',
        image: uploaded.url,
        images: [uploaded.url],
      });
      results.push({ slug: p.slug, action: 'draft created', url: uploaded.url });
    }
  }
  return results;
}
