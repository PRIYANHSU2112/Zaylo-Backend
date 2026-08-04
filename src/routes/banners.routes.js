import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { announcementSchema, promoSchema } from '../validations/index.js';
import BannerController from '../controllers/BannerController.js';

const router = Router();

router.get('/', asyncHandler(BannerController.listPublic.bind(BannerController)));

export const announcementsAdminRouter = Router();

announcementsAdminRouter.get(
  '/',
  staffOnly,
  asyncHandler(BannerController.listAnnouncements.bind(BannerController)),
);
announcementsAdminRouter.post(
  '/',
  staffOnly,
  validate(announcementSchema),
  asyncHandler(BannerController.createAnnouncement.bind(BannerController)),
);
announcementsAdminRouter.patch(
  '/:id',
  staffOnly,
  validate(announcementSchema.fork(['text'], (s) => s.optional())),
  asyncHandler(BannerController.updateAnnouncement.bind(BannerController)),
);
announcementsAdminRouter.delete(
  '/:id',
  staffOnly,
  asyncHandler(BannerController.deleteAnnouncement.bind(BannerController)),
);

export const promosAdminRouter = Router();

promosAdminRouter.get('/', staffOnly, asyncHandler(BannerController.listPromos.bind(BannerController)));
promosAdminRouter.post(
  '/',
  staffOnly,
  validate(promoSchema),
  asyncHandler(BannerController.createPromo.bind(BannerController)),
);
promosAdminRouter.patch(
  '/:id',
  staffOnly,
  validate(promoSchema.fork(['title'], (s) => s.optional())),
  asyncHandler(BannerController.updatePromo.bind(BannerController)),
);
promosAdminRouter.delete(
  '/:id',
  staffOnly,
  asyncHandler(BannerController.deletePromo.bind(BannerController)),
);

export default router;
