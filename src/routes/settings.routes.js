import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { adminOnly } from '../middlewares/authorize.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { settingsUpdateSchema } from '../validations/index.js';
import SettingsController from '../controllers/SettingsController.js';

const router = Router();

router.get('/', asyncHandler(SettingsController.getPublic.bind(SettingsController)));

export const adminRouter = Router();

adminRouter.get('/', adminOnly, asyncHandler(SettingsController.getAdmin.bind(SettingsController)));
adminRouter.patch(
  '/',
  adminOnly,
  validate(settingsUpdateSchema),
  asyncHandler(SettingsController.update.bind(SettingsController)),
);

export default router;
