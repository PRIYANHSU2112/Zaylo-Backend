import joi from 'joi';

export const statusSchema = joi.object({
  status: joi.string().required(),
});

export const bulkActionSchema = joi.object({
  action: joi.string().valid('delete', 'status').required(),
  ids: joi.array().items(joi.string()).min(1).required(),
  status: joi.string().optional(),
});
