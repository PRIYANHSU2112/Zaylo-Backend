import ApiError from '../utils/ApiError.js';

/**
 * Validate req.body / query / params with a Joi schema.
 * @param {import('joi').ObjectSchema} schema
 * @param {'body'|'query'|'params'} [source='body']
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map((d) => d.message);
    return next(ApiError.badRequest('Validation failed', details));
  }

  // Express 5: req.query is a getter — merge validated values in place
  if (source === 'query') {
    Object.keys(req.query).forEach((k) => delete req.query[k]);
    Object.assign(req.query, value);
  } else {
    req[source] = value;
  }
  return next();
};

export default validate;
