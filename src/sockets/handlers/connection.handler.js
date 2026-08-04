import logger from '../../utils/logger.js';

/**
 * Registers base connection lifecycle handlers on a socket instance.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
export function registerConnectionHandlers(socket, io) {
  logger.info(`Socket connected: ${socket.id}`);

  socket.emit('welcome', {
    message: 'Connected to Zaylo realtime',
    socketId: socket.id,
  });

  socket.on('ping', (payload, ack) => {
    const response = { pong: true, at: new Date().toISOString(), payload };
    if (typeof ack === 'function') {
      ack(response);
    } else {
      socket.emit('pong', response);
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} (${reason})`);
  });

  socket.on('error', (err) => {
    logger.error(`Socket error [${socket.id}]`, err);
  });

  // Placeholder for room joins used by future order/admin features
  socket.on('join:room', (room) => {
    if (typeof room === 'string' && room.trim()) {
      socket.join(room.trim());
      socket.emit('joined:room', { room: room.trim() });
    }
  });
}

export default registerConnectionHandlers;
