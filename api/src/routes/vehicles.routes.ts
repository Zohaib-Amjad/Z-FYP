import { Router } from 'express';
import { detail, filters, list } from '../controllers/catalog.controller';
import { available } from '../controllers/slot.controller';
import { validate } from '../middleware/validate';
import { catalogQuerySchema } from '../validators/catalog.validators';
import { idParamsSchema } from '../validators/common';
import { availableSlotsQuerySchema, vehicleSlotsParamsSchema } from '../validators/slot.validators';

const router = Router();

router.get('/', validate({ query: catalogQuerySchema }), list);
router.get('/filters', validate({}), filters);
router.get(
  '/:vehicleId/slots',
  validate({ params: vehicleSlotsParamsSchema, query: availableSlotsQuerySchema }),
  available,
);
router.get('/:id', validate({ params: idParamsSchema }), detail);

export default router;
