import database from '../config/database.js';
import redisClient from '../config/redis.js';

class HealthService {
  async getStatus() {
    const [mongo, redis] = await Promise.all([
      database.ping(),
      redisClient.ping(),
    ]);

    const healthy = mongo.ok && redis.ok;

    return {
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongo,
        redis,
      },
    };
  }
}

export default new HealthService();
