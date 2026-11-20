import joi from 'joi';

const url = joi.string().trim().max(1000);

/**
 * Admin product payload. Rating/review counts are NOT accepted (no fabricated
 * ratings); there is no protein field (content restriction).
 * Drafts (status Inactive) may be incomplete; publishing is checked in CatalogService.
 */
const fields = {
  name: joi.string().trim().min(2).max(120),
  slug: joi.string().allow(''),
  sku: joi
    .string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9][A-Z0-9_-]{1,39}$/)
    .allow('')
    .messages({ 'string.pattern.base': 'SKU may use letters, numbers, - and _ (2–40 chars)' }),
  category: joi.string().trim().allow(''),
  price: joi.number().min(0),
  mrp: joi.number().min(0),
  weight: joi.string().trim().max(60).allow(''),
  image: url.allow(''),
  images: joi.array().items(url).max(8),
  tagline: joi.string().trim().max(160).allow(''),
  description: joi.string().trim().max(5000).allow(''),
  isVeg: joi.boolean(),
  isNew: joi.boolean(),
  isPopular: joi.boolean(),
  isFeatured: joi.boolean(),
  homePosition: joi.number().integer().min(0),
  flavor: joi.string().trim().max(80).allow(''),
  nutrition: joi.object({
    calories: joi.number().min(0).allow(null),
    fat: joi.string().allow(''),
    carbs: joi.string().allow(''),
  }),
  ingredients: joi.array().items(joi.string().trim()),
  storage: joi.string().trim().max(500).allow(''),
  seoTitle: joi.string().trim().max(70).allow(''),
  seoDescription: joi.string().trim().max(170).allow(''),
  status: joi.string().valid('Active', 'Inactive'),
  stock: joi.number().integer().min(0),
};

const priceNotAboveMrp = (value, helpers) => {
  if (value.price != null && value.mrp != null && Number(value.price) > Number(value.mrp)) {
    return helpers.message('Selling price cannot be higher than MRP');
  }
  return value;
};

export const productCreateSchema = joi
  .object({ ...fields, name: fields.name.required(), price: fields.price.required(), mrp: fields.mrp.required() })
  .custom(priceNotAboveMrp);

export const productUpdateSchema = joi.object(fields).custom(priceNotAboveMrp);
