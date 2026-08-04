import Redis from 'ioredis';
import logger from '../utils/logger.js';
import config from './index.js';

const SAFE_METHODS = [
  'get',
  'set',
  'setex',
  'del',
  'keys',
  'unlink',
  'hget',
  'hgetall',
  'hset',
  'hdel',
  'publish',
  'subscribe',
  'psubscribe',
  'unsubscribe',
  'punsubscribe',
];

/**
 * Build ioredis options from config (host/port/password).
 * lazyConnect: true — does not open a TCP connection until connect() is awaited.
 */
function buildRedisOptions() {
  /** @type {import('ioredis').RedisOptions} */
  const redisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
    keepAlive: 10000,
    lazyConnect: true,
    showFriendlyErrorStack: config.env === 'development',
    retryStrategy(times) {
      if (times > 3) {
        // Stop retrying after 3 attempts to prevent infinite connection loops
        return null;
      }
      logger.warn(`[Redis] Retrying connection... Attempt: ${times}`);
      return Math.min(times * 500, 2000);
    },
  };

  if (config.redis.password) {
    redisOptions.password = config.redis.password;
  }

  return redisOptions;
}

/**
 * Wrap common Redis commands so callers get `null` when Redis is down
 * instead of throwing and crashing request handlers.
 *
 * @param {import('ioredis').default} client
 */
function applySafeMethods(client) {
  client.isRedisAvailable = false;

  SAFE_METHODS.forEach((method) => {
    if (typeof client[method] !== 'function') return;

    const original = client[method].bind(client);

    client[method] = async (...args) => {
      if (!client.isRedisAvailable) return null;
      try {
        return await original(...args);
      } catch (err) {
        logger.debug(`[Redis] ${method} failed`, err);
        return null;
      }
    };
  });

  // Alias for backward compatibility (node-redis style)
  client.setEx = client.setex;
}

class RedisClient {
  constructor() {
    this.client = null;
  }

  /**
   * Create the client (if needed) and open the connection.
   * @returns {Promise<import('ioredis').default>}
   */
  async connect() {
    if (this.client?.status === 'ready') {
      return this.client;
    }

    if (!this.client) {
      const redisOptions = buildRedisOptions();
      this.client = new Redis(redisOptions);
      applySafeMethods(this.client);

      this.client.on('connect', () => {
        logger.info('[Redis] Connecting…');
      });

      this.client.on('ready', () => {
        this.client.isRedisAvailable = true;
        logger.info('[Redis] Ready');
      });

      this.client.on('error', (err) => {
        this.client.isRedisAvailable = false;
        logger.error('[Redis] Error', err);
      });

      this.client.on('close', () => {
        this.client.isRedisAvailable = false;
        logger.warn('[Redis] Connection closed');
      });

      this.client.on('end', () => {
        this.client.isRedisAvailable = false;
        logger.warn('[Redis] Connection ended');
      });

      this.client.on('reconnecting', () => {
        this.client.isRedisAvailable = false;
        logger.warn('[Redis] Reconnecting…');
      });
    }

    if (this.client.status === 'wait' || this.client.status === 'end') {
      try {
        await this.client.connect();
        this.client.isRedisAvailable = this.client.status === 'ready';
      } catch (err) {
        this.client.isRedisAvailable = false;
        logger.error(
          '[Redis] Failed to connect — API will run degraded until Redis is available',
          err,
        );
      }
    }

    return this.client;
  }

  getClient() {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /** @returns {boolean} */
  get isAvailable() {
    return Boolean(this.client?.isRedisAvailable);
  }

  async ping() {
    if (!this.client || !this.client.isRedisAvailable) {
      return { ok: false, status: 'disconnected' };
    }
    try {
      const result = await this.client.ping();
      return {
        ok: result === 'PONG',
        status: result === 'PONG' ? 'connected' : 'error',
      };
    } catch (err) {
      return { ok: false, status: 'error', message: err.message };
    }
  }

  async disconnect() {
    if (this.client) {
      this.client.isRedisAvailable = false;
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
      logger.info('[Redis] Disconnected gracefully');
    }
  }
}

export default new RedisClient();
