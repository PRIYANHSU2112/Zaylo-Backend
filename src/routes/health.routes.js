import { Router } from 'express';
import HealthController from '../controllers/HealthController.js';
import asyncHandler from '../middlewares/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(HealthController.check.bind(HealthController)));

export default router;
