import multer from 'multer';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';

/** @type {readonly string[]} */
export const DEFAULT_ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

/**
 * @typedef {object} UploadOptions
 * @property {number} [maxFileSizeMb] Max size per file in MB
 * @property {string[]} [allowedMimeTypes] Allowed Content-Types
 */

/**
 * Create a configured multer instance (memory storage).
 *
 * @param {UploadOptions} [options]
 * @returns {multer.Multer}
 */
export function createUploader(options = {}) {
  const maxFileSizeMb = options.maxFileSizeMb ?? config.storageMaxFileSizeMb;
  const allowedMimeTypes = options.allowedMimeTypes ?? [...DEFAULT_ALLOWED_MIME_TYPES];
  const maxBytes = maxFileSizeMb * 1024 * 1024;

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxBytes,
      files: 20,
    },
    fileFilter(_req, file, cb) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(
          ApiError.badRequest(
            `Unsupported file type "${file.mimetype}". Allowed: ${allowedMimeTypes.join(', ')}`,
          ),
        );
        return;
      }
      cb(null, true);
    },
  });
}

const defaultUploader = createUploader();

/**
 * Accept a single multipart file field.
 *
 * @param {string} [fieldName='file']
 * @param {UploadOptions} [options]
 * @returns {import('express').RequestHandler}
 */
export function uploadSingle(fieldName = 'file', options) {
  const uploader = options ? createUploader(options) : defaultUploader;
  return uploader.single(fieldName);
}

/**
 * Accept multiple files under one field name.
 *
 * @param {string} [fieldName='files']
 * @param {number} [maxCount=10]
 * @param {UploadOptions} [options]
 * @returns {import('express').RequestHandler}
 */
export function uploadMultiple(fieldName = 'files', maxCount = 10, options) {
  const uploader = options ? createUploader(options) : defaultUploader;
  return uploader.array(fieldName, maxCount);
}

/**
 * Accept multiple named fields.
 *
 * @param {{ name: string, maxCount?: number }[]} fields
 * @param {UploadOptions} [options]
 * @returns {import('express').RequestHandler}
 */
export function uploadFields(fields, options) {
  const uploader = options ? createUploader(options) : defaultUploader;
  return uploader.fields(fields);
}

export default {
  createUploader,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  DEFAULT_ALLOWED_MIME_TYPES,
};
