import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { contactCreateSchema, statusSchema, bulkActionSchema } from '../validations/index.js';
import ContactController from '../controllers/ContactController.js';

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
  validate(contactCreateSchema),
  asyncHandler(ContactController.create.bind(ContactController)),
);

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(ContactController.listAdmin.bind(ContactController)));
adminRouter.get('/:id', staffOnly, asyncHandler(ContactController.getAdmin.bind(ContactController)));
adminRouter.patch(
  '/:id/status',
  staffOnly,
  validate(statusSchema),
  asyncHandler(ContactController.setStatus.bind(ContactController)),
);
adminRouter.delete('/:id', staffOnly, asyncHandler(ContactController.remove.bind(ContactController)));
adminRouter.post(
  '/bulk',
  staffOnly,
  validate(bulkActionSchema),
  asyncHandler(ContactController.bulk.bind(ContactController)),
);

export default router;
