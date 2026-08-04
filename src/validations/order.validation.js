import joi from 'joi';

export const orderCreateSchema = joi.object({
  customerName: joi.string().required(),
  customerEmail: joi.string().email().required(),
  customerPhone: joi.string().allow(''),
  paymentMethod: joi.string().valid('UPI', 'Card', 'COD').default('COD'),
  shippingAddress: joi.string().required(),
  items: joi
    .array()
    .items(
      joi.object({
        id: joi.string().allow(''),
        productId: joi.string().allow(''),
        name: joi.string().required(),
        price: joi.number().required(),
        quantity: joi.number().min(1).required(),
      }),
    )
    .min(1)
    .required(),
});

export const addressSchema = joi.object({
  type: joi.string().default('Home'),
  address: joi.string().required(),
});
