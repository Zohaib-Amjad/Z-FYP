import { Router } from 'express';
import { detail, list, updateStatus } from '../controllers/adminCustomer.controller';
import { validate } from '../middleware/validate';
import { idParamsSchema } from '../validators/common';
import { customerListQuerySchema, customerStatusSchema } from '../validators/customer.validators';

const router = Router();

router.get('/', validate({ query: customerListQuerySchema }), list);
router.get('/:id', validate({ params: idParamsSchema }), detail);
router.patch(
  '/:id/status',
  validate({ params: idParamsSchema, body: customerStatusSchema }),
  updateStatus,
);

export default router;
