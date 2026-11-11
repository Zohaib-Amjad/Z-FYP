import { Router } from 'express';
import {
  activate,
  create,
  deactivate,
  getAdmin,
  listAdmin,
  update,
} from '../controllers/dealership.controller';
import { validate } from '../middleware/validate';
import { idParamsSchema } from '../validators/common';
import {
  adminDealershipQuerySchema,
  createDealershipSchema,
  updateDealershipSchema,
} from '../validators/dealership.validators';

const router = Router();
const withId = validate({ params: idParamsSchema });

router.get('/', validate({ query: adminDealershipQuerySchema }), listAdmin);
router.post('/', validate({ body: createDealershipSchema }), create);
router.get('/:id', withId, getAdmin);
router.patch('/:id', validate({ params: idParamsSchema, body: updateDealershipSchema }), update);
router.patch('/:id/deactivate', withId, deactivate);
router.patch('/:id/activate', withId, activate);

export default router;
