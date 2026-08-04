import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import {
  landingImageSchema,
  landingImageUpdateSchema,
  bundleSchema,
  bundleUpdateSchema,
} from '../validations/index.js';
import HomeController from '../controllers/HomeController.js';

const router = Router();

router.get('/', asyncHandler(HomeController.getPublic.bind(HomeController)));

export const landingImagesAdminRouter = Router();

landingImagesAdminRouter.get(
  '/',
  staffOnly,
  asyncHandler(HomeController.listLandingImages.bind(HomeController)),
);
landingImagesAdminRouter.post(
  '/',
  staffOnly,
  validate(landingImageSchema),
  asyncHandler(HomeController.createLandingImage.bind(HomeController)),
);
landingImagesAdminRouter.patch(
  '/:id',
  staffOnly,
  validate(landingImageUpdateSchema),
  asyncHandler(HomeController.updateLandingImage.bind(HomeController)),
);
landingImagesAdminRouter.delete(
  '/:id',
  staffOnly,
  asyncHandler(HomeController.deleteLandingImage.bind(HomeController)),
);

export const bundlesAdminRouter = Router();

bundlesAdminRouter.get('/', staffOnly, asyncHandler(HomeController.listBundles.bind(HomeController)));
bundlesAdminRouter.post(
  '/',
  staffOnly,
  validate(bundleSchema),
  asyncHandler(HomeController.createBundle.bind(HomeController)),
);
bundlesAdminRouter.patch(
  '/:id',
  staffOnly,
  validate(bundleUpdateSchema),
  asyncHandler(HomeController.updateBundle.bind(HomeController)),
);
bundlesAdminRouter.delete(
  '/:id',
  staffOnly,
  asyncHandler(HomeController.deleteBundle.bind(HomeController)),
);

export default router;
