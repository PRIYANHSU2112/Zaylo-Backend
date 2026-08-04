import joi from 'joi';

export const categorySchema = joi.object({
  name: joi.string().required(),
  slug: joi.string().allow(''),
  comingSoon: joi.boolean(),
  color: joi.string().allow(''),
  image: joi.string().allow(''),
  homePosition: joi.number().integer().min(0),
  status: joi.string().valid('Active', 'Inactive'),
});
