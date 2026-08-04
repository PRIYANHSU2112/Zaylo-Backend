import joi from 'joi';

export const loginSchema = joi.object({
  email: joi.string().email().required(),
  password: joi.string().min(4).required(),
  role: joi.string().valid('Admin', 'Manager', 'Customer', 'Distributor').optional(),
  rememberMe: joi.boolean().optional(),
});

export const registerSchema = joi.object({
  name: joi.string().min(2).required(),
  email: joi.string().email().required(),
  phone: joi.string().allow(''),
  password: joi.string().min(6).required(),
});

export const profileUpdateSchema = joi
  .object({
    name: joi.string().min(2),
    phone: joi.string().allow(''),
  })
  .min(1);
