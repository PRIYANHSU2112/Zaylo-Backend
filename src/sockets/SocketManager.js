import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { registerConnectionHandlers } from './handlers/connection.handler.js';

class SocketManager {
  constructor() {
    this.io = null;
  }

  /**
   * Attach Socket.io to an existing HTTP server.
   * @param {import('http').Server} httpServer
   */
  init(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.clientUrls,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 25000,
    });

    // Verify JWT on handshake. Guests may connect but can only join their own rooms.
    this.io.use((socket, next) => {
      const raw = socket.handshake.auth?.token || socket.handshake.headers?.authorization || '';
      const token = String(raw).replace(/^Bearer\s+/i, '');
      if (!token) {
        socket.data.user = null;
        return next();
      }
      try {
        const payload = jwt.verify(token, config.jwtSecret);
        socket.data.user = { id: payload.sub, role: payload.role };
        return next();
      } catch {
        return next(new Error('Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket) => {
      registerConnectionHandlers(socket, this.io);
    });

    logger.info('Socket.io initialized');
    return this.io;
  }

  getIO() {
    if (!this.io) {
      throw new Error('Socket.io not initialized. Call init() first.');
    }
    return this.io;
  }

  /**
   * Emit to a named room (orders, admin dashboards, etc.).
   */
  toRoom(room, event, payload) {
    this.getIO().to(room).emit(event, payload);
  }

  /**
   * Emit globally if Socket.io is ready; no-op otherwise.
   *
   * @param {string} event
   * @param {unknown} payload
   */
  emit(event, payload) {
    if (!this.io) return;
    this.io.emit(event, payload);
  }

  /** Room emit that is a no-op before init (background jobs). */
  toRoomSafe(room, event, payload) {
    if (!this.io) return;
    this.io.to(room).emit(event, payload);
  }

  async close() {
    if (!this.io) return;

    await new Promise((resolve) => {
      this.io.close(() => {
        logger.info('Socket.io closed');
        resolve();
      });
    });
    this.io = null;
  }
}

export default new SocketManager();
