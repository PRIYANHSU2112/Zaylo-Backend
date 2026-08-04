import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from './index.js';

class Database {
  constructor() {
    this.connection = null;
  }

  async connect(uri = config.mongodbUri) {
    mongoose.set('strictQuery', true);

    this.connection = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    logger.info('MongoDB connected');
    return this.connection;
  }

  async disconnect() {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info('MongoDB disconnected gracefully');
    }
  }

  get readyState() {
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    return mongoose.connection.readyState;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  async ping() {
    if (!this.isConnected()) {
      return { ok: false, status: 'disconnected' };
    }
    await mongoose.connection.db.admin().ping();
    return { ok: true, status: 'connected' };
  }
}

export default new Database();
