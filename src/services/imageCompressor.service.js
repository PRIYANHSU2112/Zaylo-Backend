import path from 'node:path';
import sharp from 'sharp';
import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

/** Raster types we convert to WebP (GIF skipped to preserve animation). */
export const COMPRESSIBLE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * Image → WebP compressor (sharp).
 */
class ImageCompressorService {
  /**
   * @param {string} mimetype
   * @returns {boolean}
   */
  isCompressible(mimetype) {
    return COMPRESSIBLE_MIME_TYPES.includes(mimetype);
  }

  /**
   * Convert an in-memory multer file to WebP.
   *
   * @param {Express.Multer.File} file
   * @param {{ quality?: number, maxWidth?: number }} [options]
   * @returns {Promise<Express.Multer.File>}
   */
  async toWebp(file, options = {}) {
    if (!file?.buffer?.length) {
      throw ApiError.badRequest('File is required for compression');
    }

    if (!this.isCompressible(file.mimetype)) {
      return file;
    }

    const quality = options.quality ?? config.webpQuality;
    const maxWidth = options.maxWidth ?? config.webpMaxWidth;

    try {
      let pipeline = sharp(file.buffer, { failOn: 'none' }).rotate();

      if (maxWidth > 0) {
        pipeline = pipeline.resize({
          width: maxWidth,
          height: maxWidth,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      const buffer = await pipeline
        .webp({
          quality,
          effort: 4,
        })
        .toBuffer();

      const baseName = path.parse(file.originalname || 'image').name || 'image';

      return {
        ...file,
        buffer,
        size: buffer.length,
        mimetype: 'image/webp',
        originalname: `${baseName}.webp`,
      };
    } catch (err) {
      logger.error('WebP compression failed', err);
      throw ApiError.badRequest('Unable to compress image to WebP');
    }
  }
}

export default new ImageCompressorService();
