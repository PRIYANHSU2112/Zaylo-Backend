import database from '../config/database.js';
import redisClient from '../config/redis.js';
import { cacheBackend } from '../utils/cache.js';

class HealthService {
  async getStatus() {
    const [mongo, redis] = await Promise.all([
      database.ping(),
      redisClient.ping(),
    ]);

    // Redis is optional: a configured-but-down Redis is reported, but only MongoDB decides health.
    const healthy = mongo.ok;

    return {
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongo,
        redis,
        cache: { backend: cacheBackend() },
      },
    };
  }
}

export default new HealthService();
