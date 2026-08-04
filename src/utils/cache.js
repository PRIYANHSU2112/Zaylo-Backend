import NodeCache from 'node-cache';

/** In-memory cache (no Redis) for rarely-changing reads. */
const cache = new NodeCache({
  stdTTL: 120,
  checkperiod: 60,
  useClones: false,
});

export function cacheGet(key) {
  return cache.get(key);
}

export function cacheSet(key, value, ttlSeconds) {
  return cache.set(key, value, ttlSeconds);
}

export function cacheDel(key) {
  return cache.del(key);
}

export function cacheDelPrefix(prefix) {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length) cache.del(keys);
}

export function cacheInvalidate(...keys) {
  keys.forEach((k) => cache.del(k));
}

export default cache;
