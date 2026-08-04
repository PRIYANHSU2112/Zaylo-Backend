import joi from 'joi';

export const productCreateSchema = joi.object({
  name: joi.string().required(),
  slug: joi.string().allow(''),
  category: joi.string().required(),
  price: joi.number().min(0).required(),
  mrp: joi.number().min(0).required(),
  weight: joi.string().allow(''),
  image: joi.string().allow(''),
  tagline: joi.string().allow(''),
  description: joi.string().allow(''),
  rating: joi.number().min(0).max(5),
  reviewCount: joi.number().min(0),
  isVeg: joi.boolean(),
  isNew: joi.boolean(),
  isPopular: joi.boolean(),
  homePosition: joi.number().integer().min(0),
  flavor: joi.string().allow(''),
  nutrition: joi.object({
    calories: joi.number(),
    fat: joi.string().allow(''),
    protein: joi.string().allow(''),
    carbs: joi.string().allow(''),
  }),
  ingredients: joi.array().items(joi.string()),
  storage: joi.string().allow(''),
  status: joi.string().valid('Active', 'Inactive'),
  stock: joi.number().min(0),
});

export const productUpdateSchema = productCreateSchema.fork(
  ['name', 'category', 'price', 'mrp'],
  (s) => s.optional(),
);
