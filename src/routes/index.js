import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import productsRoutes, { adminRouter as productsAdmin } from './products.routes.js';
import categoriesRoutes, { adminRouter as categoriesAdmin } from './categories.routes.js';
import {
  addressesRouter,
  cartRouter,
  wishlistRouter,
  checkoutRouter,
  couponsRouter,
  ordersRouter,
  ordersAdminRouter,
  couponsAdminRouter,
  paymentsRouter,
} from './commerce.routes.js';
import contactsRoutes, { adminRouter as contactsAdmin } from './contacts.routes.js';
import dealersRoutes, { adminRouter as dealersAdmin } from './dealers.routes.js';
import bulkOrdersRoutes, { adminRouter as bulkOrdersAdmin } from './bulkOrders.routes.js';
import blogsRoutes, { adminRouter as blogsAdmin } from './blogs.routes.js';
import galleryRoutes, { adminRouter as galleryAdmin } from './gallery.routes.js';
import bannersRoutes, {
  announcementsAdminRouter,
  promosAdminRouter,
} from './banners.routes.js';
import settingsRoutes, { adminRouter as settingsAdmin } from './settings.routes.js';
import cmsRoutes, { adminRouter as cmsAdmin } from './cms.routes.js';
import usersRoutes from './users.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import uploadsRoutes from './uploads.routes.js';
import notificationsRoutes from './notifications.routes.js';
import homeRoutes, {
  landingImagesAdminRouter,
  bundlesAdminRouter,
} from './home.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/me/addresses', addressesRouter);
router.use('/me/cart', cartRouter);
router.use('/me/wishlist', wishlistRouter);
router.use('/checkout', checkoutRouter);
router.use('/coupons', couponsRouter);
router.use('/payments', paymentsRouter);

router.use('/products', productsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/orders', ordersRouter);
router.use('/contacts', contactsRoutes);
router.use('/dealers', dealersRoutes);
router.use('/bulk-orders', bulkOrdersRoutes);
router.use('/blogs', blogsRoutes);
router.use('/gallery', galleryRoutes);
router.use('/banners', bannersRoutes);
router.use('/home', homeRoutes);
router.use('/settings', settingsRoutes);
router.use('/cms', cmsRoutes);

const admin = Router();
admin.use(authenticate);
admin.use('/products', productsAdmin);
admin.use('/categories', categoriesAdmin);
admin.use('/orders', ordersAdminRouter);
admin.use('/coupons', couponsAdminRouter);
admin.use('/contacts', contactsAdmin);
admin.use('/dealers', dealersAdmin);
admin.use('/bulk-orders', bulkOrdersAdmin);
admin.use('/blogs', blogsAdmin);
admin.use('/gallery', galleryAdmin);
admin.use('/announcements', announcementsAdminRouter);
admin.use('/promos', promosAdminRouter);
admin.use('/landing-images', landingImagesAdminRouter);
admin.use('/bundles', bundlesAdminRouter);
admin.use('/settings', settingsAdmin);
admin.use('/cms', cmsAdmin);
admin.use('/users', usersRoutes);
admin.use('/dashboard', dashboardRoutes);
admin.use('/uploads', uploadsRoutes);
admin.use('/notifications', notificationsRoutes);
router.use('/admin', admin);

export default router;
