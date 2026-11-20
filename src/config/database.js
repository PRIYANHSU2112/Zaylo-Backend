import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from './index.js';

class Database {
  constructor() {
    this.connection = null;
    this.supportsTransactions = false;
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
    await this.detectTransactionSupport();
    return this.connection;
  }

  /**
   * Multi-document transactions need a replica set / sharded cluster.
   * Probed once at startup; order services read `database.supportsTransactions`.
   */
  async detectTransactionSupport() {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      this.supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
    } catch {
      this.supportsTransactions = false;
    }
    if (this.supportsTransactions) {
      logger.info('MongoDB transactions: supported (replica set detected)');
    } else {
      logger.warn(
        'MongoDB transactions: NOT supported (standalone server). Orders use atomic conditional ' +
          'stock updates with compensating rollback. Use a replica set (e.g. Atlas) in production.',
      );
    }
    return this.supportsTransactions;
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
