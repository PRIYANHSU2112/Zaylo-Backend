import dotenv from 'dotenv';

dotenv.config();

const BASE_REQUIRED_IN_PRODUCTION = ['MONGODB_URI', 'REDIS_HOST', 'JWT_SECRET'];

function parseClientUrls(value) {
  if (!value || value.trim() === '') {
    return ['http://localhost:3000'];
  }
  return value.split(',').map((url) => url.trim()).filter(Boolean);
}

function normalizeProvider(value) {
  const provider = (value || 'r2').toLowerCase().trim();
  if (provider !== 'r2' && provider !== 's3') {
    throw new Error(`Invalid STORAGE_PROVIDER "${value}". Use "r2" or "s3".`);
  }
  return provider;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

class Config {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.nodeEnv = this.env;
    this.isProduction = this.env === 'production';
    this.port = Number(process.env.PORT) || 5000;
    this.mongodbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zaylo';

    this.redis = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD?.trim() || undefined,
    };

    // Legacy URL (optional); host/port/password are preferred
    this.redisUrl =
      process.env.REDIS_URL ||
      (this.redis.password
        ? `redis://:${encodeURIComponent(this.redis.password)}@${this.redis.host}:${this.redis.port}`
        : `redis://${this.redis.host}:${this.redis.port}`);

    this.clientUrls = parseClientUrls(process.env.CLIENT_URL);
    this.jwtSecret = process.env.JWT_SECRET || 'dev-only-change-me';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

    this.storageProvider = normalizeProvider(process.env.STORAGE_PROVIDER);
    this.storageSignedUrlExpires = Number(process.env.STORAGE_SIGNED_URL_EXPIRES) || 3600;
    this.storagePresignExpires = Number(process.env.STORAGE_PRESIGN_EXPIRES) || 300;
    this.storageMaxFileSizeMb = Number(process.env.STORAGE_MAX_FILE_SIZE_MB) || 5;

    // Image → WebP (sharp). Background compress runs after the original is uploaded.
    this.webpEnabled = process.env.STORAGE_WEBP_ENABLED !== 'false';
    this.webpBackground = process.env.STORAGE_WEBP_BACKGROUND !== 'false';
    this.webpQuality = clampInt(process.env.STORAGE_WEBP_QUALITY, 80, 1, 100);
    this.webpMaxWidth = clampInt(process.env.STORAGE_WEBP_MAX_WIDTH, 1920, 0, 10000);

    this.r2 = {
      accountId: process.env.R2_ACCOUNT_ID || '',
      accessKey: process.env.R2_ACCESS_KEY || '',
      secretKey: process.env.R2_SECRET_KEY || '',
      bucket: process.env.R2_BUCKET || '',
      publicUrl: process.env.R2_PUBLIC_URL || '',
    };

    this.aws = {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      bucket: process.env.AWS_S3_BUCKET || '',
      publicUrl: process.env.AWS_S3_PUBLIC_URL || '',
    };

    this.#validate();
  }

  #storageRequiredKeys() {
    if (this.storageProvider === 'r2') {
      return [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY',
        'R2_SECRET_KEY',
        'R2_BUCKET',
        'R2_PUBLIC_URL',
      ];
    }
    return [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_S3_BUCKET',
      'AWS_S3_PUBLIC_URL',
    ];
  }

  #validate() {
    if (!this.isProduction) return;

    const required = [...BASE_REQUIRED_IN_PRODUCTION, ...this.#storageRequiredKeys()];
    const missing = required.filter((key) => {
      const value = process.env[key];
      return !value || value.trim() === '' || value.includes('change-me');
    });

    if (missing.length > 0) {
      throw new Error(
        `Missing or invalid required env vars in production: ${missing.join(', ')}`,
      );
    }
  }
}

export default new Config();
