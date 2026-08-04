import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import {
  productCreateSchema,
  productUpdateSchema,
  statusSchema,
  bulkActionSchema,
} from '../validations/index.js';
import ProductController from '../controllers/ProductController.js';

const router = Router();

router.get('/', asyncHandler(ProductController.listPublic.bind(ProductController)));
router.get('/:slug', asyncHandler(ProductController.getBySlug.bind(ProductController)));

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(ProductController.listAdmin.bind(ProductController)));
adminRouter.post(
  '/',
  staffOnly,
  validate(productCreateSchema),
  asyncHandler(ProductController.create.bind(ProductController)),
);
adminRouter.patch(
  '/:id',
  staffOnly,
  validate(productUpdateSchema),
  asyncHandler(ProductController.update.bind(ProductController)),
);
adminRouter.patch(
  '/:id/status',
  staffOnly,
  validate(statusSchema),
  asyncHandler(ProductController.setStatus.bind(ProductController)),
);
adminRouter.delete(
  '/:id',
  staffOnly,
  asyncHandler(ProductController.remove.bind(ProductController)),
);
adminRouter.post(
  '/bulk',
  staffOnly,
  validate(bulkActionSchema),
  asyncHandler(ProductController.bulk.bind(ProductController)),
);

export default router;
