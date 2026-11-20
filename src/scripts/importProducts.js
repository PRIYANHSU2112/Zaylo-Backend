/**
 * npm run db:import-products [-- --dry-run]
 * Uploads the pack images in Backend/seed-assets/products to storage (R2/S3) and creates
 * DRAFT products (Inactive, stock 0) using only text printed on the packs.
 * Complete weight, stock, category and description in Admin, then publish.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Product from '../models/Product.js';
import storageService from '../services/storage.service.js';
import { importDraftProducts } from './dbTools.js';
import { args, connect, run } from './cli.js';

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../seed-assets/products');

run(async () => {
  await connect();
  const results = await importDraftProducts(Product, storageService, ASSETS, { dryRun: Boolean(args['dry-run']) });
  console.table(results);
  console.log('\nDrafts are Inactive. Fill weight, stock, category and description in Admin → Products, then set Active.');
});
