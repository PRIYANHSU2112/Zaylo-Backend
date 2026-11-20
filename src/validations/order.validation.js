import joi from 'joi';

const objectId = joi.string().hex().length(24);
/** A cart/order line is either a single product or a bundle pack (exactly one id). */
const lineItem = joi
  .object({
    productId: objectId,
    bundleId: objectId,
    quantity: joi.number().integer().min(1).max(999).required(),
  })
  .xor('productId', 'bundleId');

const addressFields = {
  type: joi.string().max(30).default('Home'),
  name: joi.string().trim().min(2).max(80).required(),
  phone: joi
    .string()
    .trim()
    .pattern(/^[0-9+\-\s]{7,15}$/)
    .required()
    .messages({ 'string.pattern.base': 'Enter a valid phone number' }),
  line1: joi.string().trim().min(3).max(200).required(),
  line2: joi.string().trim().max(200).allow(''),
  city: joi.string().trim().min(2).max(80).required(),
  state: joi.string().trim().min(2).max(80).required(),
  pincode: joi
    .string()
    .trim()
    .pattern(/^[1-9][0-9]{5}$/)
    .required()
    .messages({ 'string.pattern.base': 'Enter a valid 6-digit pincode' }),
  isDefault: joi.boolean(),
};

export const addressSchema = joi.object(addressFields);
export const addressUpdateSchema = joi
  .object(Object.fromEntries(Object.entries(addressFields).map(([k, v]) => [k, v.optional()])))
  .min(1);

export const orderCreateSchema = joi
  .object({
    items: joi.array().items(lineItem).min(1).max(50).required(),
    addressId: objectId,
    address: joi.object(addressFields),
    couponCode: joi.string().trim().max(40).allow(''),
    paymentMethod: joi.string().valid('COD', 'Razorpay').default('COD'),
  })
  .xor('addressId', 'address');

export const checkoutQuoteSchema = joi.object({
  items: joi.array().items(lineItem).min(1).max(50).required(),
  couponCode: joi.string().trim().max(40).allow(''),
  paymentMethod: joi.string().valid('COD', 'Razorpay').default('COD'),
});

export const orderStatusSchema = joi.object({
  status: joi.string().valid('Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled').required(),
  courier: joi.string().trim().max(80).allow(''),
  trackingNumber: joi.string().trim().max(80).allow(''),
  note: joi.string().trim().max(300).allow(''),
});

export const orderPaymentSchema = joi.object({
  action: joi.string().valid('cod-collected').required(),
  note: joi.string().trim().max(300).allow(''),
});

export const orderCancelSchema = joi.object({
  reason: joi.string().trim().max(300).allow(''),
});

export const cartSetSchema = joi.object({
  items: joi.array().items(lineItem).max(50).required(),
});

export const wishlistMergeSchema = joi.object({
  productIds: joi.array().items(objectId).max(200).required(),
});

export const couponValidateSchema = joi.object({
  code: joi.string().trim().max(40).required(),
  items: joi.array().items(lineItem).min(1).max(50).required(),
});

export const couponSchema = joi.object({
  code: joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{3,30}$/).required(),
  description: joi.string().max(200).allow(''),
  type: joi.string().valid('percent', 'flat').required(),
  value: joi
    .number()
    .min(1)
    .required()
    .when('type', { is: 'percent', then: joi.number().max(100) }),
  minOrder: joi.number().min(0),
  maxDiscount: joi.number().min(0),
  usageLimit: joi.number().integer().min(0),
  perUserLimit: joi.number().integer().min(0),
  validFrom: joi.date().allow(null),
  validTo: joi.date().allow(null).when('validFrom', { is: joi.date(), then: joi.date().min(joi.ref('validFrom')) }),
  status: joi.string().valid('Active', 'Inactive'),
});
export const couponUpdateSchema = couponSchema.fork(['code', 'type', 'value'], (s) => s.optional());

export const changePasswordSchema = joi.object({
  currentPassword: joi.string().required(),
  newPassword: joi.string().min(8).max(128).invalid(joi.ref('currentPassword')).required().messages({
    'any.invalid': 'New password must be different from the current one',
  }),
});

export const razorpayOrderSchema = joi.object({ orderId: objectId.required() });
export const razorpayVerifySchema = joi.object({
  orderId: objectId.required(),
  razorpay_order_id: joi.string().required(),
  razorpay_payment_id: joi.string().required(),
  razorpay_signature: joi.string().required(),
});
