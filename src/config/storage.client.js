import { S3Client } from '@aws-sdk/client-s3';
import config from './index.js';
import logger from '../utils/logger.js';

/**
 * Build provider-specific S3-compatible client options.
 * Switch between Cloudflare R2 and AWS S3 via STORAGE_PROVIDER only.
 *
 * @returns {{
 *   client: S3Client,
 *   bucket: string,
 *   publicUrl: string,
 *   provider: 'r2' | 's3',
 *   signedUrlExpires: number,
 * }}
 */
function createStorageClient() {
  const provider = config.storageProvider;
  const signedUrlExpires = config.storageSignedUrlExpires;

  if (provider === 'r2') {
    const { accountId, accessKey, secretKey, bucket, publicUrl } = config.r2;

    if (!accountId || !accessKey || !secretKey || !bucket) {
      logger.warn(
        'R2 storage credentials incomplete — uploads will fail until R2_* env vars are set',
      );
    }

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    return {
      client,
      bucket,
      publicUrl: stripTrailingSlash(publicUrl),
      provider,
      signedUrlExpires,
    };
  }

  const { region, accessKeyId, secretAccessKey, bucket, publicUrl } = config.aws;

  if (!accessKeyId || !secretAccessKey || !bucket) {
    logger.warn(
      'AWS S3 credentials incomplete — uploads will fail until AWS_* env vars are set',
    );
  }

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return {
    client,
    bucket,
    publicUrl: stripTrailingSlash(publicUrl),
    provider,
    signedUrlExpires,
  };
}

/**
 * @param {string} url
 * @returns {string}
 */
function stripTrailingSlash(url) {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

const storage = createStorageClient();

export const { client, bucket, publicUrl, provider, signedUrlExpires } = storage;
export default storage;
