import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { dealerCreateSchema, statusSchema, bulkActionSchema } from '../validations/index.js';
import DealerController from '../controllers/DealerController.js';

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
  validate(dealerCreateSchema),
  asyncHandler(DealerController.create.bind(DealerController)),
);

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(DealerController.listAdmin.bind(DealerController)));
adminRouter.patch(
  '/:id/status',
  staffOnly,
  validate(statusSchema),
  asyncHandler(DealerController.setStatus.bind(DealerController)),
);
adminRouter.delete('/:id', staffOnly, asyncHandler(DealerController.remove.bind(DealerController)));
adminRouter.post(
  '/bulk',
  staffOnly,
  validate(bulkActionSchema),
  asyncHandler(DealerController.bulk.bind(DealerController)),
);

export default router;
