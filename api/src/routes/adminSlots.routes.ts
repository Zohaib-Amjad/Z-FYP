import { Router } from 'express';
import {
  activate,
  bulk,
  create,
  deactivate,
  detail,
  list,
  update,
} from '../controllers/slot.controller';
import { validate } from '../middleware/validate';
import { idParamsSchema } from '../validators/common';
import {
  adminSlotQuerySchema,
  bulkQuerySchema,
  bulkSlotsSchema,
  createSlotSchema,
  updateSlotSchema,
} from '../validators/slot.validators';

const router = Router();
const withId = validate({ params: idParamsSchema });

router.get('/', validate({ query: adminSlotQuerySchema }), list);
router.post('/', validate({ body: createSlotSchema }), create);
router.post('/bulk', validate({ query: bulkQuerySchema, body: bulkSlotsSchema }), bulk);
router.get('/:id', withId, detail);
router.patch('/:id', validate({ params: idParamsSchema, body: updateSlotSchema }), update);
router.patch('/:id/deactivate', withId, deactivate);
router.patch('/:id/activate', withId, activate);

export default router;
