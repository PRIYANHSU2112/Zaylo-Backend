import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { categorySchema, statusSchema, bulkActionSchema } from '../validations/index.js';
import CategoryController from '../controllers/CategoryController.js';

const router = Router();

router.get('/', asyncHandler(CategoryController.listPublic.bind(CategoryController)));

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(CategoryController.listAdmin.bind(CategoryController)));
adminRouter.post(
  '/',
  staffOnly,
  validate(categorySchema),
  asyncHandler(CategoryController.create.bind(CategoryController)),
);
adminRouter.patch(
  '/:id',
  staffOnly,
  validate(categorySchema.fork(['name'], (s) => s.optional())),
  asyncHandler(CategoryController.update.bind(CategoryController)),
);
adminRouter.delete(
  '/:id',
  staffOnly,
  asyncHandler(CategoryController.remove.bind(CategoryController)),
);
adminRouter.patch(
  '/:id/status',
  staffOnly,
  validate(statusSchema),
  asyncHandler(CategoryController.setStatus.bind(CategoryController)),
);
adminRouter.post(
  '/bulk',
  staffOnly,
  validate(bulkActionSchema),
  asyncHandler(CategoryController.bulk.bind(CategoryController)),
);

export default router;
