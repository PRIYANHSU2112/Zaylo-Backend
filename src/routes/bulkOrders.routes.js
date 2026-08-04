import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { bulkOrderCreateSchema, statusSchema, bulkActionSchema } from '../validations/index.js';
import BulkOrderController from '../controllers/BulkOrderController.js';

const router = Router();

const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions' },
});

router.post(
  '/',
  leadLimiter,
  validate(bulkOrderCreateSchema),
  asyncHandler(BulkOrderController.create.bind(BulkOrderController)),
);

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(BulkOrderController.listAdmin.bind(BulkOrderController)));
adminRouter.patch(
  '/:id/status',
  staffOnly,
  validate(statusSchema),
  asyncHandler(BulkOrderController.setStatus.bind(BulkOrderController)),
);
adminRouter.delete(
  '/:id',
  staffOnly,
  asyncHandler(BulkOrderController.remove.bind(BulkOrderController)),
);
adminRouter.post(
  '/bulk',
  staffOnly,
  validate(bulkActionSchema),
  asyncHandler(BulkOrderController.bulk.bind(BulkOrderController)),
);

export default router;
