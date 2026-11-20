import NodeCache from 'node-cache';
import redisClient from '../config/redis.js';
import logger from './logger.js';

/**
 * Read-through cache for rarely-changing public reads (home page, settings,
 * categories, CMS, commerce rules).
 *
 * - Redis connected → Redis is the shared source of truth (all server instances see
 *   the same data, admin changes invalidate it everywhere, survives restarts).
 * - Redis disabled/down → per-process in-memory cache (previous behaviour).
 *
 * Every function is safe to call when Redis is unavailable; failures never reach
 * request handlers. Deletes clear memory synchronously, then Redis.
 */
const memory = new NodeCache({ stdTTL: 120, checkperiod: 60, useClones: false });
const PREFIX = 'zaylo:cache:';

const redis = () => (redisClient.isAvailable ? redisClient.client : null);

export async function cacheGet(key) {
  const r = redis();
  if (r) {
    try {
      const raw = await r.get(PREFIX + key);
      if (raw != null) return JSON.parse(raw);
      return undefined;
    } catch (err) {
      logger.debug(`[cache] redis get failed for ${key}: ${err.message}`);
    }
  }
  return memory.get(key);
}

export async function cacheSet(key, value, ttlSeconds = 120) {
  memory.set(key, value, ttlSeconds);
  const r = redis();
  if (!r) return;
  try {
    await r.set(PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.debug(`[cache] redis set failed for ${key}: ${err.message}`);
  }
}

export async function cacheDel(...keys) {
  keys.forEach((k) => memory.del(k));
  const r = redis();
  if (!r || !keys.length) return;
  try {
    await r.del(...keys.map((k) => PREFIX + k));
  } catch (err) {
    logger.debug(`[cache] redis del failed: ${err.message}`);
  }
}

export async function cacheDelPrefix(prefix) {
  const local = memory.keys().filter((k) => k.startsWith(prefix));
  if (local.length) memory.del(local);
  const r = redis();
  if (!r) return;
  try {
    let cursor = '0';
    do {
      const [next, found] = await r.scan(cursor, 'MATCH', `${PREFIX}${prefix}*`, 'COUNT', 100);
      cursor = next;
      if (found.length) await r.del(...found);
    } while (cursor !== '0');
  } catch (err) {
    logger.debug(`[cache] redis prefix delete failed: ${err.message}`);
  }
}

export const cacheInvalidate = (...keys) => cacheDel(...keys);

/** Which backend is serving the cache (for health/diagnostics). */
export const cacheBackend = () => (redis() ? 'redis' : 'memory');

export default memory;
