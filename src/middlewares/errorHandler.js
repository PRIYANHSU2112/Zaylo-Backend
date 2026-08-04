import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Internal server error';
  let errors = err.errors || [];
  let code = err.code && typeof err.code === 'string' ? err.code : 'ERROR';

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = Object.values(err.errors).map((e) => e.message);
  }

  if (err.code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    message = 'Duplicate key error';
    code = 'DUPLICATE';
    const fields = Object.keys(err.keyValue || {});
    errors = fields.map((field) => `${field} already exists`);
  }

  if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = `Invalid ${err.path}: ${err.value}`;
    code = 'CAST_ERROR';
  }

  if (err.name === 'MulterError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    code = 'UPLOAD_ERROR';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large';
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Too many files or unexpected field';
    } else {
      message = err.message || 'Upload failed';
    }
  }

  if (!(err instanceof ApiError) && statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error('Unhandled error', err);
  }

  const payload = {
    success: false,
    message,
    data: null,
    meta: null,
    error: {
      code,
      details: errors.length ? errors : undefined,
    },
  };

  if (!config.isProduction && err.stack) {
    payload.error.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};

export default errorHandler;
