import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { uploadSingle } from '../middlewares/upload.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { uploadPresignSchema, uploadCompleteSchema } from '../validations/index.js';
import AdminController from '../controllers/AdminController.js';

const router = Router();

router.post(
  '/presign',
  staffOnly,
  validate(uploadPresignSchema),
  asyncHandler(AdminController.presignUpload.bind(AdminController)),
);

router.post(
  '/complete',
  staffOnly,
  validate(uploadCompleteSchema),
  asyncHandler(AdminController.completeUpload.bind(AdminController)),
);

router.post(
  '/',
  staffOnly,
  uploadSingle('file'),
  asyncHandler(AdminController.upload.bind(AdminController)),
);

export default router;
