/**
 * npm run db:reset -- --confirm=<databaseName> [--allow-remote] [--dry-run]
 *
 * Clears demo/business content (products, categories, banners, blogs, gallery, leads,
 * orders, coupons, CMS demo text…). Keeps users, settings and indexes.
 * ALWAYS writes and verifies a full backup first. Refuses to run unless the database
 * name is typed back, and requires --allow-remote for non-local / production targets.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/index.js';
import User from '../models/User.js';
import { backupDatabase, resetContent, isLocalHost } from './dbTools.js';
import { args, connect, run } from './cli.js';

const BACKUP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backups');

run(async () => {
  const db = await connect();
  const dryRun = Boolean(args['dry-run']);

  if (args.confirm !== db.databaseName) {
    throw new Error(`Refusing to reset. Re-run with --confirm=${db.databaseName} to confirm the target database.`);
  }
  if ((config.isProduction || !isLocalHost(config.mongodbUri)) && !args['allow-remote']) {
    throw new Error('Target is a remote/production database. Add --allow-remote if you really intend to reset it.');
  }

  if (dryRun) {
    console.log('\nDRY RUN — nothing will be deleted. Would clear:');
    console.table(await resetContent(db, { dryRun: true }));
    return;
  }

  const { dir } = await backupDatabase(db, BACKUP_ROOT);
  console.log(`✔ Verified backup: ${dir}`);

  const cleared = await resetContent(db);
  console.log('✔ Cleared:');
  console.table(cleared);

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (email && password && !(await User.exists({ email }))) {
    await User.create({ name: 'Zaylo Admin', email, password, role: 'Admin', status: 'Active' });
    console.log(`✔ Admin account created for ${email}`);
  }
  console.log(`\nDone. Users and Settings were kept. Restore if needed from: ${dir}`);
});
