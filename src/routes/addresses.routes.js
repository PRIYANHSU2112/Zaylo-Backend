import { Router } from 'express';
import asyncHandler from '../middlewares/asyncHandler.js';
import validate from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { addressSchema } from '../validations/index.js';
import AddressController from '../controllers/AddressController.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(AddressController.list.bind(AddressController)));
router.post(
  '/',
  validate(addressSchema),
  asyncHandler(AddressController.create.bind(AddressController)),
);
router.patch(
  '/:id',
  validate(addressSchema),
  asyncHandler(AddressController.update.bind(AddressController)),
);
router.delete('/:id', asyncHandler(AddressController.remove.bind(AddressController)));

export default router;
