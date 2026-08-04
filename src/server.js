import http from 'node:http';
import App from './app.js';
import config from './config/index.js';
import database from './config/database.js';
import redisClient from './config/redis.js';
import SocketManager from './sockets/SocketManager.js';
import logger from './utils/logger.js';

class Server {
  constructor() {
    this.app = new App().express;
    this.httpServer = http.createServer(this.app);
    this.isShuttingDown = false;
  }

  async start() {
    try {
      await database.connect();
      await redisClient.connect();

      SocketManager.init(this.httpServer);

      await new Promise((resolve) => {
        this.httpServer.listen(config.port, () => {
          logger.info(
            `Zaylo API listening on port ${config.port} [${config.env}]`,
          );
          resolve();
        });
      });

      this.#registerProcessHandlers();
    } catch (err) {
      logger.error('Failed to start server', err);
      process.exit(1);
    }
  }

  #registerProcessHandlers() {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', reason);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception', err);
      this.shutdown('uncaughtException');
    });
  }

  async shutdown(signal) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(`Shutting down (${signal})…`);

    const forceExit = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    try {
      await new Promise((resolve, reject) => {
        this.httpServer.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');

      await SocketManager.close();
      await redisClient.disconnect();
      await database.disconnect();

      clearTimeout(forceExit);
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err);
      process.exit(1);
    }
  }
}

const server = new Server();
server.start();
