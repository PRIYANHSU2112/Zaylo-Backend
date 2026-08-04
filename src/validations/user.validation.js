import joi from 'joi';

export const userCreateSchema = joi.object({
  name: joi.string().required(),
  email: joi.string().email().required(),
  phone: joi.string().allow(''),
  password: joi.string().min(4).default('ChangeMe1!'),
  role: joi.string().valid('Customer', 'Distributor', 'Manager', 'Admin').required(),
  status: joi.string().valid('Active', 'Suspended'),
});
