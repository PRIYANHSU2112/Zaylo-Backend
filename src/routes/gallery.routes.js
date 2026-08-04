import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { gallerySchema } from '../validations/index.js';
import GalleryController from '../controllers/GalleryController.js';

const router = Router();

router.get('/', asyncHandler(GalleryController.listPublic.bind(GalleryController)));

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(GalleryController.listAdmin.bind(GalleryController)));
adminRouter.post(
  '/',
  staffOnly,
  validate(gallerySchema),
  asyncHandler(GalleryController.create.bind(GalleryController)),
);
adminRouter.patch(
  '/:id',
  staffOnly,
  validate(gallerySchema.fork(['url', 'title'], (s) => s.optional())),
  asyncHandler(GalleryController.update.bind(GalleryController)),
);
adminRouter.delete('/:id', staffOnly, asyncHandler(GalleryController.remove.bind(GalleryController)));

export default router;
