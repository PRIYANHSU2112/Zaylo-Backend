# Zaylo Backend

Monolithic Node.js API for Zaylo — Express, Socket.io, Redis, MongoDB/Mongoose, class-based MVC.

> **Deploy note:** This is a long-running Node process (HTTP + WebSockets). Host on Railway, Render, a VPS, or Docker — **not** Vercel serverless. Keep the Frontend on Vercel.

## Prerequisites

- Node.js >= 20
- MongoDB running locally or a cloud URI
- Redis running locally (`REDIS_HOST` / `REDIS_PORT` / optional `REDIS_PASSWORD`)

## Setup

```bash
cd Backend
cp .env.example .env
# edit .env with your MongoDB / Redis / CLIENT_URL values
npm install
npm run dev
```

## API v1

Design: [`docs/API_DESIGN_V1.md`](docs/API_DESIGN_V1.md)

```bash
npm run seed   # admin@zaylo.com / Admin123!  + sample product
npm run dev
```

Smoke checks:
- `GET /api/v1/health`
- `GET /api/v1/products`
- `POST /api/v1/auth/login` `{ "email":"admin@zaylo.com", "password":"Admin123!", "role":"Admin" }`

## Scripts

| Command       | Description                |
|---------------|----------------------------|
| `npm run dev` | Nodemon (hot reload)       |
| `npm start`   | Production process         |

## Folder roles

```
src/
  config/       Env, MongoDB, Redis, storage client (R2/S3)
  constants/    Shared constants (HTTP status)
  controllers/  Thin HTTP handlers (MVC)
  middlewares/  Auth, validate, upload, errors
  models/       Mongoose schemas
  routes/       Domain routes (public + adminRouter in same file)

Admin panel (`../admin`) uses `VITE_API_BASE_URL` → this API. Seed staff: `admin@zaylo.com` / `Admin123!`.
  services/     Business logic
  validations/  Joi schemas
  seed/         Bootstrap data (CMS from Frontend shapes)
  sockets/      Socket.io
  utils/        ApiError, ApiResponse, cache, pagination, logger
  app.js
  server.js
```

**Request flow:** `Route → Controller → Service → Model / Cache / Storage`

Public Frontend APIs (examples):
- `GET /api/v1/products`, `/products/:slug`, `/categories`
- `GET /api/v1/banners`, `/cms/home`, `/blogs`, `/gallery`, `/settings`
- `POST /api/v1/contacts`, `/dealers`, `/bulk-orders`, `/orders`
- `POST /api/v1/auth/register`, `POST /auth/login`, `GET|PATCH /auth/me`, `/me/addresses`

## Object storage (Cloudflare R2 / AWS S3)

Default production path: **Cloudflare R2** with **presigned PUT** (browser → R2). The API only issues short-lived upload URLs and confirms the object exists. Set `STORAGE_PROVIDER=s3` + AWS_* for Amazon S3 (same SDK code).

### R2 bucket setup

1. Create a bucket in Cloudflare R2.
2. Enable **public access** via a custom domain (preferred) or the `*.r2.dev` public URL → set `R2_PUBLIC_URL` to that origin (no trailing slash).
3. Create an API token with **Object Read & Write** on that bucket only (not account-wide Admin). Map to `R2_ACCESS_KEY` / `R2_SECRET_KEY` + `R2_ACCOUNT_ID` / `R2_BUCKET`.
4. Configure **CORS** on the bucket so the admin origin can PUT (required for browser uploads). Example (replace origins with your `CLIENT_URL` values):

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://admin.example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length", "Cache-Control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

5. Lifecycle (dashboard): abort incomplete multipart uploads after 1 day.
6. R2 encrypts at rest by default. Objects are public via the bucket/custom domain — do not rely on object ACLs.

### Env

| Env | Purpose |
|-----|---------|
| `STORAGE_PROVIDER` | `r2` (default) or `s3` |
| `R2_*` | Account, keys, bucket, public CDN URL |
| `AWS_*` | Region, keys, bucket, public URL |
| `STORAGE_MAX_FILE_SIZE_MB` | Max upload size (default 5) |
| `STORAGE_SIGNED_URL_EXPIRES` | Signed GET TTL seconds (default 3600) |
| `STORAGE_PRESIGN_EXPIRES` | Presigned PUT TTL seconds (default 300) |
| `STORAGE_WEBP_*` | Legacy multipart proxy WebP options only |

### Admin upload APIs

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/admin/uploads/presign` | Staff JWT → `{ uploadUrl, key, publicUrl, headers, expiresIn }` |
| `POST` | `/api/v1/admin/uploads/complete` | Staff JWT + `{ key }` → HeadObject → `{ key, url, size, contentType }` |
| `POST` | `/api/v1/admin/uploads` | Legacy multipart proxy (multer → API → R2) |

Presign body: `{ folder, contentType, contentLength, filename? }` — folders allowlisted: `products`, `categories`, `uploads`.

`StorageService` methods: `createPresignedUpload`, `confirmUpload`, `uploadFile`, `deleteFile`, `replaceFile`, `getSignedUrl`, `getPublicUrl`.

## Adding a new MVC module

1. Create `src/models/Product.js` (Mongoose schema)
2. Create `src/services/ProductService.js` (class with CRUD methods)
3. Create `src/controllers/ProductController.js` (class, call service)
4. Create `src/routes/product.routes.js` and mount in `src/routes/index.js`

Example mount:

```js
import productRoutes from './product.routes.js';
router.use('/products', productRoutes);
```
