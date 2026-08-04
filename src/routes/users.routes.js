import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { adminOnly } from '../middlewares/authorize.middleware.js';
import { userCreateSchema, bulkActionSchema } from '../validations/index.js';
import AdminController from '../controllers/AdminController.js';

const router = Router();

router.get('/', adminOnly, asyncHandler(AdminController.listUsers.bind(AdminController)));
router.post(
  '/',
  adminOnly,
  validate(userCreateSchema),
  asyncHandler(AdminController.createUser.bind(AdminController)),
);
router.patch('/:id', adminOnly, asyncHandler(AdminController.updateUser.bind(AdminController)));
router.delete('/:id', adminOnly, asyncHandler(AdminController.deleteUser.bind(AdminController)));
router.post(
  '/bulk',
  adminOnly,
  validate(bulkActionSchema),
  asyncHandler(AdminController.bulkUsers.bind(AdminController)),
);

export default router;
