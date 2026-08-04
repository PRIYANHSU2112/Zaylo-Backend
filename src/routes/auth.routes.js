import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import AuthController from '../controllers/AuthController.js';
import validate from '../middlewares/validate.middleware.js';
import { loginSchema, registerSchema, profileUpdateSchema } from '../validations/index.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts' },
});

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(AuthController.register.bind(AuthController)),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(AuthController.login.bind(AuthController)),
);

router.get('/me', authenticate, asyncHandler(AuthController.me.bind(AuthController)));

router.patch(
  '/me',
  authenticate,
  validate(profileUpdateSchema),
  asyncHandler(AuthController.updateProfile.bind(AuthController)),
);

export default router;
