/**
 * Strip keys that start with `$` or contain `.` (NoSQL operator injection).
 * Express 5: do not reassign `req.query` (getter-only).
 */

function sanitizeValue(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    out[key] = sanitizeValue(val);
  }
  return out;
}

function sanitizeInPlace(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        obj[key] = val.map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? sanitizeValue(item)
            : item,
        );
      } else {
        sanitizeInPlace(val);
      }
    }
  }
}

const mongoSanitize = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeInPlace(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeInPlace(req.params);
  }
  // Mutate query object in place when possible
  if (req.query && typeof req.query === 'object') {
    sanitizeInPlace(req.query);
  }
  next();
};

export default mongoSanitize;
