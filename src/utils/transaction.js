import mongoose from 'mongoose';
import database from '../config/database.js';

/**
 * Run `fn(session)` inside a MongoDB transaction when the deployment supports it
 * (replica set). On a standalone server `fn(null)` runs without a session and the
 * caller is responsible for compensating writes on failure.
 */
export async function withTransaction(fn) {
  if (!database.supportsTransactions) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export const transactionsEnabled = () => database.supportsTransactions;
