import joi from 'joi';
import {
  PRESIGN_ALLOWED_FOLDERS,
  PRESIGN_ALLOWED_MIME_TYPES,
} from '../services/storage.service.js';

export const uploadPresignSchema = joi.object({
  folder: joi
    .string()
    .valid(...PRESIGN_ALLOWED_FOLDERS)
    .default('uploads'),
  contentType: joi
    .string()
    .valid(...PRESIGN_ALLOWED_MIME_TYPES)
    .required(),
  contentLength: joi.number().integer().positive().required(),
  filename: joi.string().max(255).allow('', null),
});

export const uploadCompleteSchema = joi.object({
  key: joi.string().required().max(512),
});

export const uploadDeleteSchema = joi.object({ url: joi.string().uri().max(1000).required() });
