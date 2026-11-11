import { Router } from 'express';
import {
  approve,
  cancel,
  complete,
  detail,
  list,
  reject,
  reschedule,
} from '../controllers/adminBooking.controller';
import { validate } from '../middleware/validate';
import {
  approveSchema,
  cancelSchema,
  completeSchema,
  rejectSchema,
  rescheduleSchema,
} from '../validators/bookingAction.validators';
import { adminBookingsQuerySchema } from '../validators/adminBooking.validators';
import { idParamsSchema } from '../validators/common';

const router = Router();

router.get('/', validate({ query: adminBookingsQuerySchema }), list);
router.get('/:id', validate({ params: idParamsSchema }), detail);
router.patch('/:id/approve', validate({ params: idParamsSchema, body: approveSchema }), approve);
router.patch('/:id/reject', validate({ params: idParamsSchema, body: rejectSchema }), reject);
router.patch(
  '/:id/reschedule',
  validate({ params: idParamsSchema, body: rescheduleSchema }),
  reschedule,
);
router.patch('/:id/cancel', validate({ params: idParamsSchema, body: cancelSchema }), cancel);
router.patch('/:id/complete', validate({ params: idParamsSchema, body: completeSchema }), complete);

export default router;
