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

  // Rooms: staff → 'staff' (+ any 'admin:*'); signed-in users → 'user:<id>' only.
  const user = socket.data.user;
  const isStaff = ['Admin', 'Manager'].includes(user?.role);
  if (isStaff) socket.join('staff');
  const ownRoom = user?.id ? `user:${user.id}` : null;
  if (ownRoom) socket.join(ownRoom);

  socket.on('join:room', (room) => {
    const name = typeof room === 'string' ? room.trim() : '';
    const allowed = (isStaff && name.startsWith('admin:')) || (ownRoom && name === ownRoom);
    if (!allowed) return socket.emit('error:room', { room: name, message: 'Not allowed' });
    socket.join(name);
    socket.emit('joined:room', { room: name });
  });
}

export default registerConnectionHandlers;
