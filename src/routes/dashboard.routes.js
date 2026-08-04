import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import { staffOnly } from '../middlewares/authorize.middleware.js';
import AdminController from '../controllers/AdminController.js';

const router = Router();

router.get('/', staffOnly, asyncHandler(AdminController.dashboard.bind(AdminController)));

export default router;
