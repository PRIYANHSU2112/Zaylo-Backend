import ApiError from '../utils/ApiError.js';

/**
 * Restrict route to one or more roles.
 * @param {...string} roles
 */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }
    return next();
  };

export const adminOnly = authorize('Admin');
export const staffOnly = authorize('Admin', 'Manager');

export default authorize;
