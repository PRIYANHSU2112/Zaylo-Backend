import mongoose from 'mongoose';

/** Fulfilment lifecycle. Independent from payment status (see PAYMENT_STATUSES). */
export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'];
/** UPI / Card kept only so legacy orders still validate. New orders: COD or Razorpay. */
export const PAYMENT_METHODS = ['COD', 'Razorpay', 'UPI', 'Card'];

/** Allowed forward transitions for staff status updates. */
export const STATUS_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Shipped', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

const bundleComponentSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 }, // per ONE bundle unit
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['product', 'bundle'], default: 'product' },
    bundle: { type: mongoose.Schema.Types.ObjectId, ref: 'Bundle' },
    components: { type: [bundleComponentSchema], default: undefined },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    id: { type: String },
    slug: { type: String, default: '' },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    weight: { type: String, default: '' },
    price: { type: Number, required: true },
    mrp: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false },
);

const shippingDetailsSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
  },
  { _id: false },
);

const historySchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['status', 'payment'], default: 'status' },
    value: { type: String, required: true },
    note: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, index: true },
    customerPhone: { type: String, default: '' },

    // Money — always computed server-side from DB prices
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    codFee: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    couponCode: { type: String, default: '' },

    status: { type: String, enum: ORDER_STATUSES, default: 'Pending', index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'COD' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending', index: true },
    paidAt: { type: Date },
    razorpayOrderId: { type: String, index: { unique: true, sparse: true } },
    razorpayPaymentId: { type: String, default: '' },

    // Formatted single-line address (kept for legacy orders + admin search)
    shippingAddress: { type: String, required: true },
    shippingDetails: { type: shippingDetailsSchema, default: undefined },

    courier: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    history: { type: [historySchema], default: [] },

    items: { type: [orderItemSchema], required: true },
    stockReleased: { type: Boolean, default: false },
    idempotencyKey: { type: String, index: { unique: true, sparse: true } },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });

/**
 * Explicit invoice eligibility (single source of truth — also exposed to clients
 * as `invoiceAvailable`). Never for Pending or Cancelled orders.
 */
export const INVOICE_STATUSES = ['Confirmed', 'Packed', 'Shipped', 'Delivered'];
export function isInvoiceEligible(order) {
  if (!order || !INVOICE_STATUSES.includes(order.status)) return false;
  return order.paymentMethod === 'COD' || order.paymentStatus === 'Paid';
}

export default mongoose.model('Order', orderSchema);
