import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import {
  addressSchema,
  addressUpdateSchema,
  cartSetSchema,
  wishlistMergeSchema,
  checkoutQuoteSchema,
  couponValidateSchema,
  orderCreateSchema,
  orderCancelSchema,
  orderStatusSchema,
  orderPaymentSchema,
  couponSchema,
  couponUpdateSchema,
  bulkActionSchema,
  razorpayOrderSchema,
  razorpayVerifySchema,
} from '../validations/index.js';
import C from '../controllers/CommerceController.js';

const h = (fn) => asyncHandler(fn);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many requests, please slow down' },
});

/** /me/addresses */
export const addressesRouter = Router();
addressesRouter.use(authenticate);
addressesRouter.get('/', h(C.listAddresses));
addressesRouter.post('/', validate(addressSchema), h(C.addAddress));
addressesRouter.patch('/:id', validate(addressUpdateSchema), h(C.updateAddress));
addressesRouter.delete('/:id', h(C.deleteAddress));

/** /me/cart */
export const cartRouter = Router();
cartRouter.use(authenticate);
cartRouter.get('/', h(C.getCart));
cartRouter.put('/', validate(cartSetSchema), h(C.setCart));
cartRouter.post('/merge', validate(cartSetSchema), h(C.mergeCart));

/** /me/wishlist */
export const wishlistRouter = Router();
wishlistRouter.use(authenticate);
wishlistRouter.get('/', h(C.getWishlist));
wishlistRouter.post('/merge', validate(wishlistMergeSchema), h(C.mergeWishlist));
wishlistRouter.post('/:productId', h(C.addWishlist));
wishlistRouter.delete('/:productId', h(C.removeWishlist));

/** /checkout + /coupons */
export const checkoutRouter = Router();
checkoutRouter.post('/quote', optionalAuth, validate(checkoutQuoteSchema), h(C.quote));
export const couponsRouter = Router();
couponsRouter.post('/validate', writeLimiter, optionalAuth, validate(couponValidateSchema), h(C.validateCoupon));

/** /orders (customer) */
export const ordersRouter = Router();
ordersRouter.post('/', writeLimiter, authenticate, validate(orderCreateSchema), h(C.createOrder));
ordersRouter.get('/me', authenticate, h(C.listMyOrders));
ordersRouter.get('/:id', authenticate, h(C.getOrder));
ordersRouter.post('/:id/cancel', authenticate, validate(orderCancelSchema), h(C.cancelOrder));
ordersRouter.get('/:id/invoice', authenticate, h(C.invoice));

/** /admin/orders */
export const ordersAdminRouter = Router();
ordersAdminRouter.use(staffOnly);
ordersAdminRouter.get('/', h(C.listAdminOrders));
ordersAdminRouter.get('/:id', h(C.getOrder));
ordersAdminRouter.get('/:id/invoice', h(C.invoice));
ordersAdminRouter.patch('/:id/status', validate(orderStatusSchema), h(C.setOrderStatus));
ordersAdminRouter.patch('/:id/payment', validate(orderPaymentSchema), h(C.setOrderPayment));
ordersAdminRouter.delete('/:id', h(C.removeOrder));
ordersAdminRouter.post('/bulk', validate(bulkActionSchema), h(C.bulkOrders));

/** /admin/coupons */
export const couponsAdminRouter = Router();
couponsAdminRouter.use(staffOnly);
couponsAdminRouter.get('/', h(C.listCoupons));
couponsAdminRouter.post('/', validate(couponSchema), h(C.createCoupon));
couponsAdminRouter.patch('/:id', validate(couponUpdateSchema), h(C.updateCoupon));
couponsAdminRouter.delete('/:id', h(C.deleteCoupon));

/** /payments — every action returns 503 while PAYMENTS_ENABLED is off */
export const paymentsRouter = Router();
paymentsRouter.get('/config', h(C.paymentConfig));
paymentsRouter.post('/razorpay/order', authenticate, validate(razorpayOrderSchema), h(C.razorpayOrder));
paymentsRouter.post('/razorpay/verify', authenticate, validate(razorpayVerifySchema), h(C.razorpayVerify));
paymentsRouter.post('/razorpay/webhook', express.raw({ type: '*/*', limit: '1mb' }), h(C.razorpayWebhook));
