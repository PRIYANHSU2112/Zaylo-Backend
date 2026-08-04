import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { optionalAuth, authenticate } from '../middlewares/auth.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { orderCreateSchema, statusSchema, bulkActionSchema } from '../validations/index.js';
import OrderController from '../controllers/OrderController.js';

const router = Router();

router.post(
  '/',
  optionalAuth,
  validate(orderCreateSchema),
  asyncHandler(OrderController.create.bind(OrderController)),
);
router.get('/me', authenticate, asyncHandler(OrderController.listMine.bind(OrderController)));
router.get('/:id', authenticate, asyncHandler(OrderController.getOne.bind(OrderController)));

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(OrderController.listAdmin.bind(OrderController)));
adminRouter.patch(
  '/:id/status',
  staffOnly,
  validate(statusSchema),
  asyncHandler(OrderController.setStatus.bind(OrderController)),
);
adminRouter.delete('/:id', staffOnly, asyncHandler(OrderController.remove.bind(OrderController)));
adminRouter.post(
  '/bulk',
  staffOnly,
  validate(bulkActionSchema),
  asyncHandler(OrderController.bulk.bind(OrderController)),
);

export default router;
