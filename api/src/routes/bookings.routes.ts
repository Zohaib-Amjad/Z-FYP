import { Router } from 'express';
import {
  cancel,
  counts,
  create,
  detail,
  listMine,
  slotPreview,
} from '../controllers/booking.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createBookingSchema } from '../validators/booking.validators';
import { idParamsSchema } from '../validators/common';
import { cancelMyBookingSchema, myBookingsQuerySchema } from '../validators/myBooking.validators';

const router = Router();

router.use(authenticate, requireRole('CUSTOMER'));
router.post('/', validate({ body: createBookingSchema }), create);
router.get('/mine', validate({ query: myBookingsQuerySchema }), listMine);
router.get('/mine/counts', validate({}), counts);
router.get('/slots/:id', validate({ params: idParamsSchema }), slotPreview);
router.get('/:id', validate({ params: idParamsSchema }), detail);
router.patch(
  '/:id/cancel',
  validate({ params: idParamsSchema, body: cancelMyBookingSchema }),
  cancel,
);

export default router;
