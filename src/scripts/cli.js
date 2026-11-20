/** Shared CLI helpers for maintenance scripts. */
import mongoose from 'mongoose';
import config from '../config/index.js';
import { redactUri, collectionCounts } from './dbTools.js';

export const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);

export async function connect() {
  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  console.log(`\nTarget : ${redactUri(config.mongodbUri)}`);
  console.log(`Database: ${db.databaseName}   NODE_ENV: ${config.env}`);
  console.table(await collectionCounts(db));
  return db;
}

export async function run(main) {
  try {
    await main();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`\n✖ ${err.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}
