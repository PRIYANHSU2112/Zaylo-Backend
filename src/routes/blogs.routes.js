import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import { blogSchema } from '../validations/index.js';
import BlogController from '../controllers/BlogController.js';

const router = Router();

router.get('/', asyncHandler(BlogController.listPublic.bind(BlogController)));

export const adminRouter = Router();

adminRouter.get('/', staffOnly, asyncHandler(BlogController.listAdmin.bind(BlogController)));
adminRouter.post(
  '/',
  staffOnly,
  validate(blogSchema),
  asyncHandler(BlogController.create.bind(BlogController)),
);
adminRouter.patch(
  '/:id',
  staffOnly,
  validate(blogSchema.fork(['title'], (s) => s.optional())),
  asyncHandler(BlogController.update.bind(BlogController)),
);
adminRouter.delete('/:id', staffOnly, asyncHandler(BlogController.remove.bind(BlogController)));

export default router;
