import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import NotificationController from '../controllers/NotificationController.js';

const router = Router();

router.get('/', staffOnly, asyncHandler(NotificationController.list.bind(NotificationController)));
router.post(
  '/read-all',
  staffOnly,
  asyncHandler(NotificationController.markAllRead.bind(NotificationController)),
);
router.patch(
  '/:id/read',
  staffOnly,
  asyncHandler(NotificationController.markRead.bind(NotificationController)),
);
router.delete(
  '/:id',
  staffOnly,
  asyncHandler(NotificationController.remove.bind(NotificationController)),
);

export default router;
