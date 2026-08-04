# Zaylo API Design v1 — Analysis + Endpoint Map

## Decisions locked

- No Admin UI changes
- CMS API + `/admin/cms` OK (Admin CMS UI later)
- Contact includes `phone`
- Bulk + dealer field unions (separate routes/models)
- Product `isVeg`/`isNew` API defaults
- Blog list-only (no body/slug)
- Addresses API-only
- Category FK: `namkeen` in seed
- Cart/wishlist local; no bundles API

---

## Step 1 — Frontend summary

| Section | Network | Persist | Admin owner |
|---------|---------|---------|-------------|
| Home catalog | GET products/categories | — | Products, Categories |
| Banners | GET banners | — | Banners |
| CMS (about, FAQ, testimonials, whyChoose, dealer) | GET cms/home | — | CMS API |
| BundlePacks | none | — | none |
| Products / Detail | GET products, :slug | cart/wishlist local | Products |
| Cart / Wishlist | none until checkout | localStorage | — |
| Checkout | POST orders | JWT optional | Orders |
| Profile | me, orders/me, addresses | JWT | Users (no address UI) |
| Contact / Dealer / Bulk | POST leads | — | Contacts, Dealers, Bulk |
| Blog / Gallery | GET lists | — | Blogs, Gallery |
| Settings/contact | GET settings | — | Settings |

**Not in Frontend:** OTP, payment gateway, coupons, review CRUD, order tracking, blog detail, dealer portal, server cart.

---

## Step 2 — Admin summary

Staff (Admin+Manager): Dashboard, Products, Categories, Orders, Dealers, Bulk, Contacts, Blogs, Gallery, Banners.  
Admin-only: Users, Settings, CMS.  
Images: URL strings (presigned: `POST /admin/uploads/presign` → PUT to R2 → `POST /admin/uploads/complete`; legacy `POST /admin/uploads`).  
List query: `q`, `page`, `limit`, `sort`, `order`, entity filters.

---

## Step 3 — Dependencies

| Frontend need | Gap? | Resolution |
|---------------|------|------------|
| Bundles | yes | FE hardcoded |
| CMS editors | yes | API + seed; UI later |
| Contact phone | minor | stored in API |
| Bulk/dealer FE fields | minor | union models |
| isVeg/isNew | minor | defaults |
| Blog body | no for list | list-only |
| Addresses | yes | `/me/addresses` |
| Category FK | fixed | seed `namkeen` |
| Cart | no | local |

---

## Step 4 — Endpoint map

| Frontend section | Admin section | APIs |
|------------------|---------------|------|
| Catalog | Products / Categories | `GET /products`, `/products/:slug`, `/categories`; admin CRUD + status + bulk |
| Banners | Banners | `GET /banners`; admin announcements/promos CRUD |
| CMS home | CMS | `GET /cms/home`; `GET|PATCH /admin/cms` |
| Checkout / Profile orders | Orders | `POST /orders`, `GET /orders/me`, `GET /orders/:id`; admin status/bulk |
| Profile addresses | — | `/me/addresses` CRUD |
| Contact | Contacts | `POST /contacts`; admin list/status/bulk |
| Dealer | Dealers | `POST /dealers`; admin status (+ provision) |
| Bulk order | Bulk orders | `POST /bulk-orders`; admin status/bulk |
| Blog / Gallery | Blogs / Gallery | public GET; admin CRUD |
| Contact info | Settings | `GET /settings`; `GET|PATCH /admin/settings` |
| Future auth | Auth / Users | `POST /auth/register`, `/auth/login`, `GET|PATCH /auth/me` |
| — | Dashboard / Uploads | `GET /admin/dashboard`, `POST /admin/uploads/presign`, `POST /admin/uploads/complete`, `POST /admin/uploads` |
| — | Notifications | `GET/PATCH/DELETE /admin/notifications*` |

### Admin dashboard query

`GET /admin/dashboard?range=7d|30d|month|year|custom&from=&to=`

- Default `range=30d`. Custom requires ISO `from` + `to`.
- Returns KPIs (`totalRevenue`, `activeOrders`, `cancelledOrders`, `pendingDealers`, `approvedDealers`, `pendingBulk`, `newContacts`), `revenueSeries`, `stockByCategory`, `alertCounts`, `range`.

### Admin notifications

| Method | Path | Notes |
|--------|------|--------|
| GET | `/admin/notifications` | `page`, `limit`, `unreadOnly=true`; `meta.unreadCount` |
| PATCH | `/admin/notifications/:id/read` | per-user read |
| POST | `/admin/notifications/read-all` | mark all read for actor |
| DELETE | `/admin/notifications/:id` | staff delete |

Created on order/dealer/bulk/contact create (and dealer approve).

Envelope: `{ success, message, data, meta, error }`.

---

## Step 5 — MVC layout

```
Backend/src/
  controllers/   # one per domain
  services/
  models/
  routes/        # public + adminRouter exports per domain
  validations/   # domain *.validation.js + index.js
  seed/seed.js
```

---

## Step 6 — Run

```bash
cd Backend
npm run seed
npm run dev
```

Smoke:

```bash
curl http://localhost:5000/api/v1/products
curl http://localhost:5000/api/v1/cms/home
curl -X POST http://localhost:5000/api/v1/contacts \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\",\"email\":\"t@example.com\",\"phone\":\"9999999999\",\"subject\":\"Hi\",\"message\":\"Hello\"}"
```

Staff login (seeded):

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@zaylo.com\",\"password\":\"Admin123!\",\"role\":\"Admin\"}"
```

Seeded: 7 Active products (FE slugs), `namkeen` category, CMS/settings/banners/blogs/gallery, admin@zaylo.com / Admin123!.
