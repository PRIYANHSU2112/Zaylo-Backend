import joi from 'joi';

export const contactCreateSchema = joi.object({
  name: joi.string().required(),
  email: joi.string().email().required(),
  phone: joi.string().allow(''),
  subject: joi.string().required(),
  message: joi.string().required(),
});

export const dealerCreateSchema = joi.object({
  name: joi.string().required(),
  businessName: joi.string().required(),
  email: joi.string().email().required(),
  phone: joi.string().required(),
  location: joi.string().allow(''),
  city: joi.string().allow(''),
  state: joi.string().allow(''),
  investment: joi.string().allow(''),
  interestedProducts: joi.array().items(joi.string()),
  message: joi.string().allow(''),
});

export const bulkOrderCreateSchema = joi.object({
  name: joi.string().required(),
  organization: joi.string().allow(''),
  companyName: joi.string().allow(''),
  email: joi.string().email().required(),
  phone: joi.string().required(),
  quantity: joi.string().allow(''),
  eventDate: joi.string().allow(''),
  inquiryType: joi.string().valid('corporate', 'wholesale', 'export', 'events', '').allow(''),
  estimatedOrderValue: joi.string().valid('10k-50k', '50k-1L', '1L+', '').allow(''),
  message: joi.string().allow(''),
  details: joi.string().allow(''),
});
