import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';
import asyncHandler from './asyncHandler.js';

/**
 * Require valid Bearer JWT. Attaches `req.user` (lean).
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication required');
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub)
    .select('_id name email role status phone')
    .lean();

  if (!user || user.status === 'Suspended') {
    throw ApiError.unauthorized('Account unavailable');
  }

  req.user = user;
  next();
});

/**
 * Optional auth — sets req.user if token present, otherwise continues.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    const user = await User.findById(payload.sub)
      .select('_id name email role status phone')
      .lean();
    if (user && user.status !== 'Suspended') {
      req.user = user;
    }
  } catch {
    // ignore invalid optional token
  }
  next();
});

export default authenticate;
