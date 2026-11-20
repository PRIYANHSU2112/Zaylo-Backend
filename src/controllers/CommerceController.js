import AccountService from '../services/AccountService.js';
import CommerceService from '../services/CommerceService.js';
import CouponService from '../services/CouponService.js';
import OrderService from '../services/OrderService.js';
import PaymentService from '../services/PaymentService.js';
import InvoiceService from '../services/InvoiceService.js';
import ApiResponse from '../utils/ApiResponse.js';

/** Thin HTTP layer for cart, wishlist, addresses, checkout, orders, coupons, payments. */
class CommerceController {
  // Addresses
  listAddresses = async (req, res) => ApiResponse.ok(res, await AccountService.listAddresses(req.user._id));
  addAddress = async (req, res) => ApiResponse.created(res, await AccountService.addAddress(req.user._id, req.body));
  updateAddress = async (req, res) =>
    ApiResponse.ok(res, await AccountService.updateAddress(req.user._id, req.params.id, req.body));
  deleteAddress = async (req, res) =>
    ApiResponse.ok(res, await AccountService.deleteAddress(req.user._id, req.params.id));

  // Cart
  getCart = async (req, res) => ApiResponse.ok(res, await AccountService.getCart(req.user._id));
  setCart = async (req, res) => ApiResponse.ok(res, await AccountService.setCart(req.user._id, req.body.items));
  mergeCart = async (req, res) => ApiResponse.ok(res, await AccountService.mergeCart(req.user._id, req.body.items));

  // Wishlist
  getWishlist = async (req, res) => ApiResponse.ok(res, await AccountService.getWishlist(req.user._id));
  addWishlist = async (req, res) =>
    ApiResponse.ok(res, await AccountService.addToWishlist(req.user._id, req.params.productId));
  removeWishlist = async (req, res) =>
    ApiResponse.ok(res, await AccountService.removeFromWishlist(req.user._id, req.params.productId));
  mergeWishlist = async (req, res) =>
    ApiResponse.ok(res, await AccountService.mergeWishlist(req.user._id, req.body.productIds));

  // Checkout
  quote = async (req, res) => {
    const q = await CommerceService.quote({ ...req.body, userId: req.user?._id }, { strict: false });
    const { lines, ...rest } = q;
    return ApiResponse.ok(res, { ...rest, items: lines.map(({ product: _p, ...l }) => l) });
  };

  validateCoupon = async (req, res) => {
    const { lines } = await CommerceService.resolveLines(req.body.items, { strict: false });
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    return ApiResponse.ok(res, await CouponService.evaluate(req.body.code, subtotal, req.user?._id));
  };

  // Orders (customer)
  createOrder = async (req, res) => {
    const { order, replayed } = await OrderService.createOrder(req.body, req.user, req.get('Idempotency-Key'));
    return replayed ? ApiResponse.ok(res, order, 'Order already placed') : ApiResponse.created(res, order, 'Order placed');
  };

  listMyOrders = async (req, res) => {
    const { data, meta } = await OrderService.listMine(req.user._id, req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  };

  getOrder = async (req, res) => ApiResponse.ok(res, await OrderService.getOne(req.params.id, req.user));

  cancelOrder = async (req, res) =>
    ApiResponse.ok(res, await OrderService.cancelByCustomer(req.params.id, req.user, req.body?.reason), 'Order cancelled');

  invoice = async (req, res) => {
    const order = await OrderService.getForInvoice(req.params.id, req.user);
    res.set('Cache-Control', 'private, no-store');
    return res.type('html').send(await InvoiceService.render(order));
  };

  // Orders (admin)
  listAdminOrders = async (req, res) => {
    const { data, meta } = await OrderService.listAdmin(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  };
  setOrderStatus = async (req, res) => ApiResponse.ok(res, await OrderService.setStatus(req.params.id, req.body, req.user));
  setOrderPayment = async (req, res) =>
    ApiResponse.ok(res, await OrderService.setPayment(req.params.id, req.body, req.user));
  removeOrder = async (req, res) => ApiResponse.ok(res, await OrderService.remove(req.params.id));
  bulkOrders = async (req, res) => ApiResponse.ok(res, await OrderService.bulk(req.body, req.user));

  // Coupons (admin)
  listCoupons = async (req, res) => {
    const { data, meta } = await CouponService.list(req.query);
    return ApiResponse.ok(res, data, 'OK', meta);
  };
  createCoupon = async (req, res) => ApiResponse.created(res, await CouponService.create(req.body));
  updateCoupon = async (req, res) => ApiResponse.ok(res, await CouponService.update(req.params.id, req.body));
  deleteCoupon = async (req, res) => ApiResponse.ok(res, await CouponService.remove(req.params.id));

  // Payments
  paymentConfig = async (_req, res) => ApiResponse.ok(res, PaymentService.getConfig());
  razorpayOrder = async (req, res) =>
    ApiResponse.ok(res, await PaymentService.createRazorpayOrder(req.body.orderId, req.user));
  razorpayVerify = async (req, res) => ApiResponse.ok(res, await PaymentService.verifyCheckout(req.body, req.user));
  razorpayWebhook = async (req, res) =>
    ApiResponse.ok(res, await PaymentService.handleWebhook(
        req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from('')),
        req.get('X-Razorpay-Signature'),
      ));
}

export default new CommerceController();
