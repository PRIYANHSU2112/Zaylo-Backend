import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { adminOnly } from '../middlewares/authorize.middleware.js';
import CmsController from '../controllers/CmsController.js';

const router = Router();

router.get('/home', asyncHandler(CmsController.getHome.bind(CmsController)));

export const adminRouter = Router();

adminRouter.get('/', adminOnly, asyncHandler(CmsController.getAdmin.bind(CmsController)));
adminRouter.patch('/', adminOnly, asyncHandler(CmsController.update.bind(CmsController)));

export default router;
