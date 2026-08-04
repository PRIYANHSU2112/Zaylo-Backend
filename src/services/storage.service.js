import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as createSignedUrl } from '@aws-sdk/s3-request-presigner';
import storage from '../config/storage.client.js';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { imageCompressionQueue } from '../utils/backgroundQueue.js';
import imageCompressor from './imageCompressor.service.js';
import SocketManager from '../sockets/SocketManager.js';

const CACHE_CONTROL = 'public,max-age=31536000,immutable';

/** Folders allowed for browser presigned uploads */
export const PRESIGN_ALLOWED_FOLDERS = Object.freeze([
  'products',
  'categories',
  'uploads',
  'banners',
  'home',
]);

/** Image MIME types for catalog media (presigned path) */
export const PRESIGN_ALLOWED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Object storage service (Cloudflare R2 or AWS S3 via S3-compatible API).
 *
 * Images (jpeg/png/webp) are converted to WebP. By default compression runs
 * in the background: the original is uploaded immediately, then replaced with
 * WebP off the request path (`storage:compressed` / `storage:compress-failed` events).
 *
 * ```js
 * router.post('/upload', uploadSingle('file'), asyncHandler(async (req, res) => {
 *   const result = await storageService.uploadFile(req.file, 'products');
 *   // { success, key, url, size, processing?, jobId? }
 *   return ApiResponse.ok(res, result);
 * }));
 * ```
 */
class StorageService {
  /**
   * Upload a multer memory file to object storage.
   *
   * @param {Express.Multer.File} file
   * @param {string} [folder='uploads']
   * @param {{
   *   compress?: boolean,
   *   background?: boolean,
   *   quality?: number,
   *   maxWidth?: number,
   * }} [options]
   * @returns {Promise<{
   *   success: true,
   *   key: string,
   *   url: string,
   *   size: number,
   *   processing?: boolean,
   *   jobId?: string,
   * }>}
   */
  async uploadFile(file, folder = 'uploads', options = {}) {
    assertFile(file);

    const shouldCompress =
      (options.compress ?? config.webpEnabled) &&
      imageCompressor.isCompressible(file.mimetype);

    if (!shouldCompress) {
      return this.#putObject(file, folder);
    }

    const background = options.background ?? config.webpBackground;
    const compressOpts = {
      quality: options.quality ?? config.webpQuality,
      maxWidth: options.maxWidth ?? config.webpMaxWidth,
    };

    if (!background) {
      const webpFile = await imageCompressor.toWebp(file, compressOpts);
      return this.#putObject(webpFile, folder);
    }

    return this.#uploadWithBackgroundWebp(file, folder, compressOpts);
  }

  /**
   * Upload original immediately, then compress → WebP → replace in background.
   *
   * @param {Express.Multer.File} file
   * @param {string} folder
   * @param {{ quality?: number, maxWidth?: number }} compressOpts
   */
  async #uploadWithBackgroundWebp(file, folder, compressOpts) {
    const original = await this.#putObject(file, folder);
    const jobId = randomUUID();

    // Clone buffer so request GC / reuse cannot corrupt the job
    const bufferCopy = Buffer.from(file.buffer);
    const snapshot = {
      ...file,
      buffer: bufferCopy,
      size: bufferCopy.length,
    };

    imageCompressionQueue.enqueue(async () => {
      try {
        const webpFile = await imageCompressor.toWebp(snapshot, compressOpts);
        const compressed = await this.#putObject(webpFile, folder);

        try {
          await this.deleteFile(original.key);
        } catch (err) {
          logger.warn(`Failed to delete original after WebP compress: ${original.key}`, err);
        }

        SocketManager.emit('storage:compressed', {
          jobId,
          oldKey: original.key,
          oldUrl: original.url,
          ...compressed,
        });

        logger.info(`Background WebP ready [${jobId}] ${compressed.key}`);
      } catch (err) {
        logger.error(`Background WebP failed [${jobId}]`, err);
        SocketManager.emit('storage:compress-failed', {
          jobId,
          key: original.key,
          url: original.url,
          message: err.message || 'Compression failed',
        });
      }
    });

    return {
      ...original,
      processing: true,
      jobId,
    };
  }

  /**
   * @param {Express.Multer.File} file
   * @param {string} folder
   */
  async #putObject(file, folder) {
    const key = buildObjectKey(folder, file.originalname);
    const { client, bucket } = storage;

    if (!bucket) {
      throw ApiError.internal('Storage bucket is not configured');
    }

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: CACHE_CONTROL,
        }),
      );
    } catch (err) {
      logger.error('Storage upload failed', err);
      throw ApiError.internal('Failed to upload file to storage');
    }

    return normalizeStorageResult({
      key,
      size: file.size ?? file.buffer.length,
      url: this.getPublicUrl(key),
    });
  }

  /**
   * Delete an object by key.
   *
   * @param {string} key
   * @returns {Promise<{ success: true, key: string }>}
   */
  async deleteFile(key) {
    const objectKey = assertKey(key);
    const { client, bucket } = storage;

    if (!bucket) {
      throw ApiError.internal('Storage bucket is not configured');
    }

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
    } catch (err) {
      logger.error('Storage delete failed', err);
      throw ApiError.internal('Failed to delete file from storage');
    }

    return { success: true, key: objectKey };
  }

  /**
   * Upload a new file, then best-effort delete the previous object.
   *
   * @param {string|null|undefined} oldKey
   * @param {Express.Multer.File} file
   * @param {string} [folder='uploads']
   * @param {Parameters<StorageService['uploadFile']>[2]} [options]
   * @returns {Promise<{ success: true, key: string, url: string, size: number, processing?: boolean, jobId?: string }>}
   */
  async replaceFile(oldKey, file, folder = 'uploads', options = {}) {
    const uploaded = await this.uploadFile(file, folder, options);

    if (oldKey && typeof oldKey === 'string' && oldKey.trim() && oldKey !== uploaded.key) {
      try {
        await this.deleteFile(oldKey);
      } catch (err) {
        logger.warn(`Failed to delete replaced object "${oldKey}"`, err);
      }
    }

    return uploaded;
  }

  /**
   * Issue a short-lived presigned PUT URL for direct browser → R2/S3 upload.
   *
   * @param {{
   *   folder?: string,
   *   contentType: string,
   *   contentLength: number,
   *   filename?: string,
   * }} params
   * @returns {Promise<{
   *   success: true,
   *   uploadUrl: string,
   *   key: string,
   *   publicUrl: string,
   *   headers: { ContentType: string, CacheControl: string },
   *   expiresIn: number,
   * }>}
   */
  async createPresignedUpload({ folder = 'uploads', contentType, contentLength, filename }) {
    const safeFolder = sanitizeFolder(folder);
    if (!PRESIGN_ALLOWED_FOLDERS.includes(safeFolder)) {
      throw ApiError.badRequest(
        `Invalid folder. Allowed: ${PRESIGN_ALLOWED_FOLDERS.join(', ')}`,
      );
    }

    if (!contentType || !PRESIGN_ALLOWED_MIME_TYPES.includes(contentType)) {
      throw ApiError.badRequest(
        `Unsupported content type. Allowed: ${PRESIGN_ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const size = Number(contentLength);
    const maxBytes = config.storageMaxFileSizeMb * 1024 * 1024;
    if (!Number.isFinite(size) || size <= 0) {
      throw ApiError.badRequest('contentLength must be a positive number');
    }
    if (size > maxBytes) {
      throw ApiError.badRequest(`File exceeds max size of ${config.storageMaxFileSizeMb} MB`);
    }

    const { client, bucket } = storage;
    if (!bucket) {
      throw ApiError.internal('Storage bucket is not configured');
    }

    const key = buildObjectKey(safeFolder, filename || extensionForMime(contentType));
    const expiresIn = config.storagePresignExpires || 300;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        CacheControl: CACHE_CONTROL,
      });
      const uploadUrl = await createSignedUrl(client, command, { expiresIn });

      return {
        success: true,
        uploadUrl,
        key,
        publicUrl: this.getPublicUrl(key),
        headers: {
          ContentType: contentType,
          CacheControl: CACHE_CONTROL,
        },
        expiresIn,
      };
    } catch (err) {
      logger.error('Presigned upload URL generation failed', err);
      throw ApiError.internal('Failed to generate upload URL');
    }
  }

  /**
   * Confirm a direct upload exists and return its public URL metadata.
   *
   * @param {string} key
   * @returns {Promise<{ success: true, key: string, url: string, size: number, contentType: string }>}
   */
  async confirmUpload(key) {
    const objectKey = assertKey(key);
    const folder = objectKey.split('/')[0];
    if (!PRESIGN_ALLOWED_FOLDERS.includes(folder)) {
      throw ApiError.badRequest('Object key is outside an allowed folder');
    }

    const { client, bucket } = storage;
    if (!bucket) {
      throw ApiError.internal('Storage bucket is not configured');
    }

    try {
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );

      return {
        success: true,
        key: objectKey,
        url: this.getPublicUrl(objectKey),
        size: Number(head.ContentLength) || 0,
        contentType: head.ContentType || '',
      };
    } catch (err) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchKey') {
        throw ApiError.badRequest('Upload not found. Complete the PUT to storage first.');
      }
      logger.error('Confirm upload (HeadObject) failed', err);
      throw ApiError.internal('Failed to confirm upload');
    }
  }

  /**
   * Generate a temporary signed GET URL for a private object.
   *
   * @param {string} key
   * @param {number} [expiresIn] seconds — defaults to STORAGE_SIGNED_URL_EXPIRES
   * @returns {Promise<{ success: true, key: string, url: string, expiresIn: number }>}
   */
  async getSignedUrl(key, expiresIn = storage.signedUrlExpires) {
    const objectKey = assertKey(key);
    const { client, bucket, signedUrlExpires } = storage;
    const ttl = Number(expiresIn) || signedUrlExpires;

    if (!bucket) {
      throw ApiError.internal('Storage bucket is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      });
      const url = await createSignedUrl(client, command, { expiresIn: ttl });

      return {
        success: true,
        key: objectKey,
        url,
        expiresIn: ttl,
      };
    } catch (err) {
      logger.error('Signed URL generation failed', err);
      throw ApiError.internal('Failed to generate signed URL');
    }
  }

  /**
   * Build the CDN / public URL for an object key.
   *
   * @param {string} key
   * @returns {string}
   */
  getPublicUrl(key) {
    const objectKey = assertKey(key);
    const base = storage.publicUrl;

    if (!base) {
      throw ApiError.internal('Storage public URL is not configured');
    }

    return `${base}/${objectKey}`;
  }
}

/**
 * @param {string} folder
 * @returns {string}
 */
export function sanitizeFolder(folder) {
  if (!folder || typeof folder !== 'string') {
    return 'uploads';
  }

  const cleaned = folder
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');

  if (!cleaned) {
    return 'uploads';
  }

  if (cleaned.includes('..')) {
    throw ApiError.badRequest('Invalid storage folder path');
  }

  return cleaned;
}

/**
 * Build a unique object key: folder/YYYY/MM/uuid_timestamp.ext
 *
 * @param {string} folder
 * @param {string} originalname
 * @returns {string}
 */
export function buildObjectKey(folder, originalname) {
  const safeFolder = sanitizeFolder(folder);
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = getExtension(originalname);
  const timestamp = now.getTime();
  const id = randomUUID().replace(/-/g, '');

  return `${safeFolder}/${year}/${month}/${id}_${timestamp}${ext}`;
}

/**
 * @param {{ key: string, size: number, url: string }} params
 * @returns {{ success: true, key: string, url: string, size: number }}
 */
export function normalizeStorageResult({ key, size, url }) {
  return {
    success: true,
    key,
    url,
    size: Number(size) || 0,
  };
}

/**
 * @param {Express.Multer.File|undefined|null} file
 */
export function assertFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw ApiError.badRequest('File is required');
  }
  if (!file.mimetype) {
    throw ApiError.badRequest('File MIME type is missing');
  }
}

/**
 * @param {string} key
 * @returns {string}
 */
function assertKey(key) {
  if (!key || typeof key !== 'string' || !key.trim()) {
    throw ApiError.badRequest('Object key is required');
  }
  const trimmed = key.trim().replace(/^\/+/, '');
  if (trimmed.includes('..')) {
    throw ApiError.badRequest('Invalid object key');
  }
  return trimmed;
}

/**
 * @param {string} originalname
 * @returns {string} including leading dot, or empty string
 */
function getExtension(originalname) {
  if (!originalname || typeof originalname !== 'string') {
    return '';
  }
  const ext = path.extname(originalname).toLowerCase();
  if (!ext || ext.length > 16 || !/^\.[a-z0-9]+$/.test(ext)) {
    return '';
  }
  return ext;
}

/**
 * @param {string} contentType
 * @returns {string} fake filename used only to derive extension
 */
function extensionForMime(contentType) {
  const map = {
    'image/jpeg': 'image.jpg',
    'image/png': 'image.png',
    'image/webp': 'image.webp',
    'image/gif': 'image.gif',
  };
  return map[contentType] || 'image.bin';
}

export default new StorageService();
