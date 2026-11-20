import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { profileUpdateSchema, changePasswordSchema } from '../validations/index.js';
import AuthController from '../controllers/AuthController.js';

/** Profile routes mounted at /me (alias of auth/me for Frontend). */
const router = Router();

router.get('/', authenticate, asyncHandler(AuthController.me.bind(AuthController)));

router.patch(
  '/',
  authenticate,
  validate(profileUpdateSchema),
  asyncHandler(AuthController.updateProfile.bind(AuthController)),
);

router.patch(
  '/password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(AuthController.changePassword.bind(AuthController)),
);

export default router;
